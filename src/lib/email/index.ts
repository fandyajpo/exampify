import "server-only";

import { env } from "@/lib/env";

import { stubEmailProvider } from "./stub";
import type { EmailMessage, EmailProvider, SendOutcome } from "./provider";

export type { EmailMessage, EmailProvider, EmailTemplate, SendOutcome, TransportStatus } from "./provider";

/**
 * `sendEmail()` — the only entry point application code uses
 * (`EMAIL_AND_NOTIFICATIONS.md` §2.1). The transport is chosen by `EMAIL_PROVIDER`.
 *
 * Auth mail must be enqueued through `job_runs` and the QStash worker, never sent inline
 * from a request handler (§4, NFR-18); this function exists for that worker.
 */
let provider: EmailProvider | null = null;

/**
 * The transport module is imported on first send, not when this file loads: `@sendust/ts`
 * loads its native addon at import time, so a static import would pull the binary into
 * boot for every environment, including local development and tests where `EMAIL_PROVIDER`
 * is `stub`. The provider's `name` stays a constant because selection already decided it.
 */
class LazySendustEmailProvider implements EmailProvider {
  readonly name = "sendust" as const;

  private transport: EmailProvider | null = null;

  async send(message: EmailMessage): Promise<SendOutcome> {
    if (!this.transport) {
      const { SendustEmailProvider } = await import("./sendust");
      this.transport = new SendustEmailProvider();
    }
    return this.transport.send(message);
  }
}

export function getEmailProvider(): EmailProvider {
  if (!provider) {
    provider = env.EMAIL_PROVIDER === "sendust" ? new LazySendustEmailProvider() : stubEmailProvider;
  }
  return provider;
}

export async function sendEmail(message: EmailMessage): Promise<SendOutcome> {
  return getEmailProvider().send(message);
}
