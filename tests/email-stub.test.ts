import { describe, expect, it } from "vitest";

import { StubEmailProvider } from "@/lib/email/stub";

describe("stub email provider", () => {
  it("accepts the message and keeps it for inspection", async () => {
    const provider = new StubEmailProvider();

    const outcome = await provider.send({
      to: "student@example.com",
      subject: "Confirm your email",
      text: "Confirm: https://exampify.test/verify?token=abc",
      html: "<p>Confirm your email</p>",
      idempotencyKey: "email:verify_email:abc",
      tags: { template: "verify_email" },
    });

    expect(provider.name).toBe("stub");
    expect(outcome.status).toBe("accepted");
    expect(outcome.recipients).toEqual([{ address: "student@example.com", status: "accepted" }]);
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]?.idempotencyKey).toBe("email:verify_email:abc");
  });

  it("bounds its in-memory buffer", async () => {
    const provider = new StubEmailProvider();

    for (let index = 0; index < 55; index += 1) {
      await provider.send({
        to: "student@example.com",
        subject: `Message ${index}`,
        text: "body",
        html: "<p>body</p>",
        idempotencyKey: `email:reset_password:${index}`,
      });
    }

    expect(provider.sent).toHaveLength(50);
    expect(provider.sent.at(-1)?.subject).toBe("Message 54");
  });
});
