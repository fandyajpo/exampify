import "server-only";

import { createTransport, type Transport } from "@sendust/ts";

import { env } from "@/lib/env";

import type { EmailMessage, EmailProvider, SendOutcome, TransportStatus } from "./provider";

/**
 * The `sendust` transport (`EMAIL_AND_NOTIFICATIONS.md` §2.3): `@sendust/ts` speaks SMTP to
 * the Google relay. Pinned exactly and listed in `serverExternalPackages` so the native
 * binary is traced into the function bundle instead of inlined.
 *
 * One module-scope transport per process: `send()` is internally queued, and closing it
 * inside a request would drop other recipients' mail. There is no `close()` anywhere in a
 * request path for that reason.
 */
type SendustTransport = Transport;

const STATUS = new Set<TransportStatus>(["accepted", "rejected", "unknown"]);

function toStatus(value: string): TransportStatus {
  return STATUS.has(value as TransportStatus) ? (value as TransportStatus) : "unknown";
}

let transport: SendustTransport | null = null;

function getTransport(): SendustTransport {
  transport ??= createTransport({
    host: env.EMAIL_SMTP_HOST,
    port: env.EMAIL_SMTP_PORT,
    secure: env.EMAIL_SMTP_SECURE,
    auth: { user: env.EMAIL_SMTP_USER, pass: env.EMAIL_SMTP_PASS },
  });
  return transport;
}

export class SendustEmailProvider implements EmailProvider {
  readonly name = "sendust" as const;

  async send(message: EmailMessage): Promise<SendOutcome> {
    const result = await getTransport().send({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
      headers: { "X-Exampify-Job": message.idempotencyKey },
    });

    return {
      status: toStatus(result.status),
      recipients: result.recipients.map((recipient) => ({
        address: recipient.address,
        status: toStatus(recipient.status),
      })),
      ...(result.response ? { response: result.response } : {}),
    };
  }
}
