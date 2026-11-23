import "server-only";

import { createHash } from "node:crypto";

import { recordEvent } from "@/lib/analytics/record";
import { getDb } from "@/lib/db";
import { sendEmail, type EmailTemplate } from "@/lib/email";
import { isSuppressed, suppressEmail } from "@/lib/email/suppression";
import { env } from "@/lib/env";

import { decideEmailAttempt, MAX_ATTEMPTS, type EmailAttemptDecision } from "./email-outcome";
import { publishJobRun } from "./qstash";

/**
 * The `send-email` job (`EMAIL_AND_NOTIFICATIONS.md` §4, `BACKGROUND_JOBS.md` §6).
 *
 * Nothing sends mail from a request handler: the Better Auth callback writes a `job_runs`
 * row with the rendered message and publishes `{ jobRunId }`, and the worker
 * (`POST /api/v1/internal/jobs/send-email`) claims that row and sends it. The row is the
 * only duplicate guard, because Google SMTP offers no idempotency of its own (ADR-036).
 *
 * The status a delivery ends in is the transport's answer, never an inference:
 *
 * | Transport result | `job_runs` | Retried? |
 * |---|---|---|
 * | `accepted` | `succeeded` | no |
 * | `rejected` | `failed` | no — repeating a refusal repeats the refusal |
 * | `unknown` | `uncertain` | never automatically: `DATA` may have reached the relay |
 * | thrown before `DATA` | back to `pending` | yes, up to `MAX_ATTEMPTS` |
 */

export const EMAIL_JOB = "send-email";

/**
 * One window for both kinds of orphan: a `pending` row this old was never delivered (J-01,
 * so the sweeper re-publishes it), and a `started` row this old belongs to a worker that
 * died holding the claim (so the next attempt may take it over). Two separate constants
 * would only invite them to drift apart without a reason.
 */
const STALE_JOB_MS = 2 * 60 * 1000;

/** Rows one sweep looks at; it runs on a schedule, so a backlog drains over successive runs. */
const SWEEP_LIMIT = 100;

/** A row in one of these states is finished. Re-running the job is a no-op. */
const TERMINAL_STATUSES = new Set(["succeeded", "failed", "uncertain", "skipped"]);

/** Keeps `error` within the 1 kB the schema allows, and never stores a token. */
const MAX_ERROR_LENGTH = 500;

export type EmailJobPayload = {
  to: string;
  template: EmailTemplate;
  subject: string;
  text: string;
  html: string;
};

export type EmailJobOutcome = "sent" | "skipped" | "failed" | "uncertain" | "retry";

function jobRunId(template: EmailTemplate, token: string): string {
  const digest = createHash("sha256").update(token).digest("hex").slice(0, 32);
  return `email:${template}:${digest}`;
}

function describe(error: unknown): { code: string; message: string } {
  const code =
    typeof (error as { code?: unknown })?.code === "string"
      ? (error as { code: string }).code
      : "SEND_FAILED";
  return { code, message: String(error).slice(0, MAX_ERROR_LENGTH) };
}

/**
 * Writes the receipt and hands the work to the queue. Returns without throwing: the caller
 * is a sign-up or reset request, and a mail problem must not fail it.
 */
export async function enqueueEmail(payload: EmailJobPayload, token: string): Promise<void> {
  const id = jobRunId(payload.template, token);
  const now = Date.now();

  try {
    const db = await getDb();
    const inserted = await db
      .insertInto("job_runs")
      .values({
        idempotency_key: id,
        job: EMAIL_JOB,
        status: "pending",
        attempts: 0,
        payload: JSON.stringify(payload),
        created_at: now,
        started_at: null,
        finished_at: null,
        error: null,
        error_code: null,
      })
      .onConflict((conflict) => conflict.column("idempotency_key").doNothing())
      .executeTakeFirst();

    // A key that already exists belongs to an earlier delivery of the same token; the
    // second enqueue must not send a second message.
    if (Number(inserted.numInsertedOrUpdatedRows ?? 0) === 0) return;
  } catch (error) {
    console.error(
      JSON.stringify({ level: "error", event: "email_enqueue_failed", jobRunId: id, error: String(error) }),
    );
    return;
  }

  // Local development and tests use the stub transport and have no queue to publish to;
  // running the job in-process keeps one code path and opens no sockets (§2.5).
  if (env.EMAIL_PROVIDER === "stub") {
    void runEmailJob(id).catch((error: unknown) => {
      console.error(
        JSON.stringify({ level: "error", event: "email_job_failed", jobRunId: id, error: String(error) }),
      );
    });
    return;
  }

  try {
    await publishJobRun(EMAIL_JOB, id);
  } catch (error) {
    // §2.6 fallback: if the queue is unavailable, one bounded direct send is better than
    // a receipt nobody reads. The row still records the outcome.
    console.error(
      JSON.stringify({ level: "warn", event: "email_publish_failed", jobRunId: id, error: String(error) }),
    );
    void runEmailJob(id).catch(() => undefined);
  }
}

/**
 * The worker body. Safe to call twice: a row that is already finished, refused or
 * uncertain is a no-op, and the claim is an optimistic update on `attempts`.
 */
export async function runEmailJob(id: string): Promise<EmailJobOutcome> {
  const db = await getDb();
  const row = await db
    .selectFrom("job_runs")
    .selectAll()
    .where("idempotency_key", "=", id)
    .where("job", "=", EMAIL_JOB)
    .executeTakeFirst();

  if (!row || TERMINAL_STATUSES.has(row.status)) return "skipped";
  if (row.status === "started" && (row.started_at ?? 0) > Date.now() - STALE_JOB_MS) {
    return "skipped";
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await finish(id, "failed", "RETRY_EXHAUSTED");
    return "failed";
  }

  const now = Date.now();
  const claimed = await db
    .updateTable("job_runs")
    .set({
      status: "started",
      attempts: row.attempts + 1,
      started_at: now,
      error: null,
      error_code: null,
    })
    .where("idempotency_key", "=", id)
    // Optimistic claim: whoever moves `attempts` off the value it read owns the send.
    .where("attempts", "=", row.attempts)
    .executeTakeFirst();

  if (Number(claimed.numUpdatedRows ?? 0) === 0) return "skipped";

  const payload = parsePayload(row.payload);
  if (!payload) {
    await finish(id, "failed", "INVALID_PAYLOAD");
    return "failed";
  }

  if (await isSuppressed(payload.to)) {
    // A suppressed address is skipped and logged, never retried (§5).
    await finish(id, "skipped", "SUPPRESSED");
    return "skipped";
  }

  let decision: EmailAttemptDecision;
  let failure: { code: string; message: string } | null = null;

  try {
    const outcome = await sendEmail({
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      idempotencyKey: id,
      tags: { template: payload.template },
    });
    decision = decideEmailAttempt({ kind: "returned", outcome }, row.attempts + 1);
  } catch (error) {
    failure = describe(error);
    decision = decideEmailAttempt({ kind: "threw", code: failure.code }, row.attempts + 1);
  }

  switch (decision.action) {
    case "succeeded":
      await finish(id, "succeeded");
      await recordEvent({ name: "email_sent", props: { template: payload.template } });
      return "sent";

    case "retry":
      // Nothing reached the relay, so the same key may be delivered again.
      await db
        .updateTable("job_runs")
        .set({
          status: "pending",
          error_code: decision.code,
          error: failure?.message ?? null,
        })
        .where("idempotency_key", "=", id)
        .execute();
      return "retry";

    case "exhausted":
    case "uncertain": {
      // `exhausted`: the retry budget is gone. `uncertain`: `DATA` may have reached the
      // relay, so a retry could double-send and `R10` reconciles against the mailbox.
      await finish(
        id,
        decision.action === "exhausted" ? "failed" : "uncertain",
        decision.code,
        failure?.message ?? null,
      );
      await recordEvent({
        name: "email_failed",
        props: { template: payload.template, code: decision.code },
      });
      return decision.action === "exhausted" ? "failed" : "uncertain";
    }

    case "failed":
      await finish(id, "failed", decision.code);
      if (decision.suppress) await suppressEmail(payload.to, "hard_bounce", "smtp");
      await recordEvent({
        name: "email_failed",
        props: { template: payload.template, code: decision.code },
      });
      return "failed";
  }
}

async function finish(
  id: string,
  status: "succeeded" | "failed" | "uncertain" | "skipped",
  errorCode?: string,
  errorMessage?: string | null,
): Promise<void> {
  const db = await getDb();
  await db
    .updateTable("job_runs")
    .set({
      status,
      finished_at: Date.now(),
      error_code: errorCode ?? null,
      error: errorMessage ?? null,
    })
    .where("idempotency_key", "=", id)
    .execute();
}

/**
 * The backstop (`BACKGROUND_JOBS.md` §8, J-01, J-09): rows a failed publish or a crashed
 * worker left behind. A `pending` row past the sweep window is re-published; a `started`
 * row past the stale-claim window is re-claimed by the worker's optimistic update.
 *
 * Re-enqueueing is safe because the **claim** is the duplicate guard, not the publish.
 */
/** `olderThanMs` exists only so `bun run jobs:drain` can drain rows it just wrote. */
export async function sweepEmailJobs(
  options: { olderThanMs?: number } = {},
): Promise<{ processed: number; skipped: number; failed: number }> {
  const olderThanMs = options.olderThanMs ?? STALE_JOB_MS;
  const now = Date.now();
  const db = await getDb();

  const rows = await db
    .selectFrom("job_runs")
    .select(["idempotency_key"])
    .where("job", "=", EMAIL_JOB)
    .where((eb) =>
      eb.or([
        eb.and([eb("status", "=", "pending"), eb("created_at", "<", now - olderThanMs)]),
        eb.and([eb("status", "=", "started"), eb("started_at", "<", now - STALE_JOB_MS)]),
      ]),
    )
    .orderBy("created_at", "asc")
    .limit(SWEEP_LIMIT)
    .execute();

  // The stub transport has no queue to publish to, so the sweep runs the job in-process:
  // one code path in every environment (§2.5).
  const inProcess = env.EMAIL_PROVIDER === "stub";
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (inProcess) {
      const outcome = await runEmailJob(row.idempotency_key);
      if (outcome === "skipped") skipped += 1;
      else processed += 1;
      continue;
    }

    try {
      await publishJobRun(EMAIL_JOB, row.idempotency_key);
      processed += 1;
    } catch (error) {
      failed += 1;
      console.error(
        JSON.stringify({
          level: "warn",
          event: "email_sweep_publish_failed",
          jobRunId: row.idempotency_key,
          error: String(error),
        }),
      );
    }
  }

  return { processed, skipped, failed };
}

function parsePayload(raw: string | null): EmailJobPayload | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as Partial<EmailJobPayload>;
    const valid =
      typeof candidate.to === "string" &&
      typeof candidate.subject === "string" &&
      typeof candidate.text === "string" &&
      typeof candidate.html === "string" &&
      typeof candidate.template === "string";
    return valid ? (candidate as EmailJobPayload) : null;
  } catch {
    return null;
  }
}
