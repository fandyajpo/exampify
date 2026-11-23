/**
 * `EmailProvider` (`EMAIL_AND_NOTIFICATIONS.md` §2.1). Application code depends on this
 * interface and calls `sendEmail()`; only the transport file imports `@sendust/ts`.
 *
 * `accepted` means the relay took responsibility, never that a mailbox received the
 * message. There is no delivery webhook: Google SMTP provides no delivery events
 * (ADR-037), so there is deliberately no `verifyWebhook` method to leave lying around.
 */

export type TransportStatus = "accepted" | "rejected" | "unknown";

export type EmailTemplate =
  | "verify_email"
  | "reset_password"
  | "password_changed"
  | "account_locked";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** The `job_runs` key: the correlation id in logs and the only duplicate guard. */
  idempotencyKey: string;
  tags?: { template: EmailTemplate };
}

export interface SendOutcome {
  status: TransportStatus;
  recipients: { address: string; status: TransportStatus }[];
  response?: { code: number; message: string };
}

export interface EmailProvider {
  readonly name: "sendust" | "stub";
  send(message: EmailMessage): Promise<SendOutcome>;
}
