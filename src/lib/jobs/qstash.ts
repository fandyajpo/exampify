import "server-only";

import { Client, Receiver } from "@upstash/qstash";

import { env } from "@/lib/env";

/**
 * The QStash client and request verification (`BACKGROUND_JOBS.md` §2, §5.1).
 *
 * Workers are plain `POST /api/v1/internal/jobs/<name>` routes that QStash signs. The
 * signed body is the payload — `{ jobRunId }` only, so a replayed message cannot carry
 * stale content — and the durable row is the authority for both the work and the dedupe.
 *
 * Vercel Cron is not routed here: it authenticates with `CRON_SECRET` instead, because
 * Vercel does not speak QStash's signature.
 */

const JOB_PATH = "/api/v1/internal/jobs";

/** Absolute, because QStash calls from outside the deployment and has no notion of `Host`. */
export function jobUrl(name: string): string {
  return new URL(`${JOB_PATH}/${name}`, env.BETTER_AUTH_URL).toString();
}

let client: Client | null = null;

/** One client per instance; it holds no sockets, only a token and a base URL. */
function getClient(): Client {
  client ??= new Client({ token: env.QSTASH_TOKEN });
  return client;
}

export async function publishJobRun(name: string, jobRunId: string): Promise<void> {
  await getClient().publishJSON({
    url: jobUrl(name),
    body: { jobRunId },
    retries: 3,
  });
}

/**
 * Verifies `Upstash-Signature` against the raw body, not the parsed JSON: the signature
 * covers the exact bytes, and re-serialising would break it. Both signing keys are tried
 * so a rotation does not drop deliveries mid-window.
 */
export async function verifyQstashSignature(signature: string, body: string): Promise<boolean> {
  if (!signature) return false;

  const receiver = new Receiver({
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
  });

  try {
    return await receiver.verify({ signature, body });
  } catch {
    return false;
  }
}
