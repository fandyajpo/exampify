import { z } from "zod";

/**
 * Response envelopes for the generated OpenAPI document
 * ([API_CONTRACTS.md](../../../docs/API_CONTRACTS.md) §2, §8, §16.2).
 *
 * These describe the shared success/error shapes the routes actually return; request
 * bodies come from the schema the handler parses (`lib/validation/*`).
 */

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    /** Present on `422`: one entry per offending path (§2.2). Absent on every other error. */
    details: z
      .array(
        z.object({
          path: z.string(),
          code: z.string(),
          message: z.string(),
        }),
      )
      .optional(),
    requestId: z.string(),
  }),
});

/** `{ data: { processed, skipped, failed } }` — the only success shape internal endpoints return (§8). */
export const countsEnvelopeSchema = z.object({
  data: z.object({
    processed: z.number().int().min(0),
    skipped: z.number().int().min(0),
    failed: z.number().int().min(0),
  }),
});

/** `GET /api/v1/health` (`DEPLOYMENT_AND_ENVIRONMENTS.md` §7, §11.9). No configuration, no secrets. */
export const healthEnvelopeSchema = z.object({
  data: z.object({
    status: z.enum(["ok", "degraded", "down"]),
    db: z.enum(["up", "down"]),
    qdrant: z.enum(["up", "down"]),
    /** `null` until `search_events` exists (Phase 6); the field is part of the contract from now on. */
    indexLagSeconds: z.number().int().nullable(),
    version: z.string(),
  }),
});
