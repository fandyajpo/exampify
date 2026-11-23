import { z } from "zod";

/**
 * Request bodies shared by a route handler and the OpenAPI registry
 * ([API_CONTRACTS.md](../../../docs/API_CONTRACTS.md) §5.1, §16.2).
 *
 * These live outside both so there is one definition: the registry publishes the schema the
 * handler parses, and `scripts/generate-openapi.ts` can import it without pulling in a
 * `server-only` module or a Next.js route file.
 */

/** The `job_runs` key a worker accepts — never the rendered message (§5.1). */
export const jobRunRequestSchema = z.object({
  jobRunId: z.string().min(1).max(200),
});
