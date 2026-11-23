import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit tests (`TESTING_STRATEGY.md` §2.1, §11): fast, no network, no database.
 *
 * Modules that read `lib/env` are covered by supplying the one public variable they
 * need, so tests never depend on a developer's `.env.local`. Integration tests against a
 * migrated libSQL database are a separate suite and are not collected here yet.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      NEXT_PUBLIC_SITE_URL: "https://exampify.test",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
