import type { SendOutcome } from "@/lib/email/provider";

/**
 * The `send-email` state machine (`EMAIL_AND_NOTIFICATIONS.md` §4.1,
 * `BACKGROUND_JOBS.md` §6–§7), as a pure function so every branch is testable without a
 * database or a socket.
 *
 * The rule that makes a retry safe: **only a failure that happened before `DATA` reached
 * the relay may be repeated.** `accepted` is terminal success, a refusal is terminal
 * failure (repeating it repeats the refusal), and `unknown` is quarantined for the manual
 * reconciliation in R10 because a second attempt could double-send.
 */

export const MAX_ATTEMPTS = 3;

export type EmailAttemptObservation =
  | { kind: "threw"; code: string }
  | { kind: "returned"; outcome: SendOutcome };

export type EmailAttemptDecision =
  | { action: "succeeded" }
  | { action: "retry"; code: string }
  | { action: "exhausted"; code: string }
  | { action: "uncertain"; code: string }
  | { action: "failed"; code: string; suppress: boolean };

/**
 * @param observation what the transport did, or the error it threw
 * @param attempts the attempt count **including** this one (`row.attempts + 1`)
 */
export function decideEmailAttempt(
  observation: EmailAttemptObservation,
  attempts: number,
): EmailAttemptDecision {
  if (observation.kind === "threw") {
    // Thrown before `DATA`: nothing reached the relay, so the same key may be delivered
    // again — until the budget is gone.
    return attempts >= MAX_ATTEMPTS
      ? { action: "exhausted", code: observation.code }
      : { action: "retry", code: observation.code };
  }

  const { outcome } = observation;

  if (outcome.status === "accepted") return { action: "succeeded" };
  if (outcome.status === "unknown") return { action: "uncertain", code: "UNKNOWN" };

  const code = `SMTP_${outcome.response?.code ?? "REJECTED"}`;
  // A 5xx during the conversation is the only bounce we can observe (ADR-037); a 4xx is a
  // protocol-level refusal and says nothing about the mailbox.
  return { action: "failed", code, suppress: (outcome.response?.code ?? 0) >= 500 };
}
