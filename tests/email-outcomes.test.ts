import { describe, expect, it } from "vitest";

import { decideEmailAttempt, MAX_ATTEMPTS } from "@/lib/jobs/email-outcome";

/**
 * The `send-email` truth table (`EMAIL_AND_NOTIFICATIONS.md` §4.1, `BACKGROUND_JOBS.md` §6).
 *
 * Every branch of the delivery state machine is checked here, including the two that were
 * previously only reachable with a real database and a broken mail server: a refusal on the
 * last attempt, and an `unknown` disposition that must never be retried automatically.
 */

const ok = { status: "accepted" as const, recipients: [] };
const unknown = { status: "unknown" as const, recipients: [] };

describe("decideEmailAttempt", () => {
  it("succeeds on acceptance, whatever the attempt number", () => {
    expect(decideEmailAttempt({ kind: "returned", outcome: ok }, 1)).toEqual({ action: "succeeded" });
    expect(decideEmailAttempt({ kind: "returned", outcome: ok }, MAX_ATTEMPTS)).toEqual({ action: "succeeded" });
  });

  it("retries a throw before the budget is spent", () => {
    expect(decideEmailAttempt({ kind: "threw", code: "ECONNRESET" }, 1)).toEqual({
      action: "retry",
      code: "ECONNRESET",
    });
    expect(decideEmailAttempt({ kind: "threw", code: "ECONNRESET" }, MAX_ATTEMPTS - 1)).toEqual({
      action: "retry",
      code: "ECONNRESET",
    });
  });

  it("marks a throw on the last attempt exhausted instead of retrying forever", () => {
    expect(decideEmailAttempt({ kind: "threw", code: "ECONNRESET" }, MAX_ATTEMPTS)).toEqual({
      action: "exhausted",
      code: "ECONNRESET",
    });
  });

  it("quarantines an unknown disposition: DATA may have reached the relay", () => {
    expect(decideEmailAttempt({ kind: "returned", outcome: unknown }, 1)).toEqual({
      action: "uncertain",
      code: "UNKNOWN",
    });
  });

  it("fails a 5xx refusal and suppresses the address (the only observable bounce)", () => {
    expect(
      decideEmailAttempt(
        { kind: "returned", outcome: { status: "rejected", recipients: [], response: { code: 550, message: "no such user" } } },
        1,
      ),
    ).toEqual({ action: "failed", code: "SMTP_550", suppress: true });
  });

  it("fails a 4xx refusal without suppressing the address", () => {
    expect(
      decideEmailAttempt(
        { kind: "returned", outcome: { status: "rejected", recipients: [], response: { code: 421, message: "try later" } } },
        1,
      ),
    ).toEqual({ action: "failed", code: "SMTP_421", suppress: false });
  });

  it("refuses to retry a refusal even on the first attempt", () => {
    const decision = decideEmailAttempt(
      { kind: "returned", outcome: { status: "rejected", recipients: [] } },
      1,
    );
    expect(decision).toEqual({ action: "failed", code: "SMTP_REJECTED", suppress: false });
  });
});
