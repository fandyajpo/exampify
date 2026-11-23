import "server-only";

import type { EmailTemplate } from "@/lib/email";
import { enqueueEmail } from "@/lib/jobs/email";

/**
 * The mail Better Auth asks us to send (`EMAIL_AND_NOTIFICATIONS.md` §3): verification and
 * password reset. The links are built from `BETTER_AUTH_URL` by the caller, never from the
 * request `Host` header; subject and expiry belong to the template, not the call site.
 *
 * This does not send. It renders the message and enqueues it — a `job_runs` row keyed by
 * the template and a hash of the token, then a QStash publish — so sign-up latency never
 * depends on the relay (§2.6, NFR-18). The token is the key's input, so a resend (a new
 * token) is a new message while a redelivery of the same one is a no-op.
 */
type AuthTemplate = Extract<EmailTemplate, "verify_email" | "reset_password">;

const TEMPLATES: Record<AuthTemplate, { subject: string; expiresIn: string }> = {
  verify_email: { subject: "Verify your Exampify email", expiresIn: "24 hours" },
  reset_password: { subject: "Reset your Exampify password", expiresIn: "1 hour" },
};

type AuthEmail = {
  to: string;
  template: AuthTemplate;
  url: string;
  /** The Better Auth token behind `url`; identifies the message, and is never stored. */
  token: string;
};

function body({ url, template }: Pick<AuthEmail, "template" | "url">): {
  text: string;
  html: string;
} {
  const { expiresIn } = TEMPLATES[template];

  const text = [
    "Open this link to continue:",
    "",
    url,
    "",
    `The link works once and expires in ${expiresIn}.`,
    "If you did not ask for this, you can ignore this email.",
  ].join("\n");

  const html = [
    "<p>Open this link to continue:</p>",
    `<p><a href="${url}">${url}</a></p>`,
    `<p>The link works once and expires in ${expiresIn}. If you did not ask for this, you can ignore this email.</p>`,
  ].join("");

  return { text, html };
}

export async function queueAuthEmail({ to, template, url, token }: AuthEmail): Promise<void> {
  const { text, html } = body({ template, url });

  await enqueueEmail(
    { to, template, subject: TEMPLATES[template].subject, text, html },
    token,
  );
}
