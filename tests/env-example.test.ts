import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { publicEnvSchema, serverEnvSchema } from "@/lib/env";

/**
 * Placeholder completeness (MVP_ROADMAP §4.6, last bullet): every variable `lib/env.ts`
 * validates must be present in `.env.example`, and nothing else may be.
 *
 * The failure this prevents was named in the roadmap — Phase 2 shipping a route whose key
 * nobody remembered to document, discovered only when the deployment 500s. It also fails
 * in the other direction, so a variable deleted from the schema cannot linger as a
 * placeholder that makes the file look complete.
 */

const example = readFileSync(new URL("../.env.example", import.meta.url), "utf8");

// A commented placeholder still counts as declared: `JOBS_DEV_BYPASS` is deliberately
// shipped commented out ("uncomment for local job testing").
const declared = new Set(
  [...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((match) => match[1]!),
);

const expected = new Set([
  ...Object.keys(publicEnvSchema.shape),
  ...Object.keys(serverEnvSchema.shape),
]);

describe(".env.example", () => {
  it("declares every variable the environment schema validates", () => {
    const missing = [...expected].filter((name) => !declared.has(name)).sort();
    expect(missing).toEqual([]);
  });

  it("declares no variable the environment schema does not validate", () => {
    const extra = [...declared].filter((name) => !expected.has(name)).sort();
    expect(extra).toEqual([]);
  });

  it("carries no real secret: every value is blank or an obvious placeholder", () => {
    for (const [, name, raw] of example.matchAll(/^([A-Z][A-Z0-9_]+)=(.*)$/gm)) {
      const value = raw ?? "";
      if (!value.trim()) continue;
      // Placeholders, local origins and the documented defaults are allowed; a value that
      // looks like a live credential is not.
      expect(value, `${name} holds what looks like a real value`).toMatch(
        /^(stub|tls|starttls|465|587|content_v1|content_preview|smtp\.gmail\.com|https?:\/\/localhost[^ ]*|"[^"]*example\.com>"|replace-with[-a-z0-9]*|libsql:\/\/your-database\.turso\.io|https:\/\/(your-cluster\.cloud\.qdrant\.io|t3\.storage\.dev|media\.example\.com|your-instance\.upstash\.io)|exampify-media|no-reply@mail\.example\.com)$/,
      );
    }
  });
});
