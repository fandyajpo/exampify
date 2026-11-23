import type { EmailMessage, EmailProvider, SendOutcome } from "./provider";

/**
 * The `stub` transport (`EMAIL_AND_NOTIFICATIONS.md` §2.1, §4): selected by
 * `EMAIL_PROVIDER=stub` in local development and tests. It accepts everything and keeps
 * the last messages in memory so a test (or the dev console) can assert what would have
 * been sent. It never touches the network.
 */
export class StubEmailProvider implements EmailProvider {
  readonly name = "stub" as const;

  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<SendOutcome> {
    this.sent.push(message);
    if (this.sent.length > 50) this.sent.shift();

    return {
      status: "accepted",
      recipients: [{ address: message.to, status: "accepted" }],
      response: { code: 250, message: "stub: accepted" },
    };
  }
}

export const stubEmailProvider = new StubEmailProvider();
