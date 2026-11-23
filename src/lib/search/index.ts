import { env } from "@/lib/env";

/**
 * `lib/search` — FTS, fuzzy matching, fusion, vocabulary and the Qdrant integration
 * ([PRODUCT_ARCHITECTURE.md](../../../docs/PRODUCT_ARCHITECTURE.md) §6,
 * [SEARCH_ARCHITECTURE.md](../../../docs/SEARCH_ARCHITECTURE.md)).
 *
 * Phase 1 only needs the health probe: `GET /api/v1/health` reports the cluster so the
 * first runbook step and the post-deploy smoke check have something to read. The lexical
 * and vector query paths arrive in Phase 6 and stay behind this module.
 */

const PROBE_TIMEOUT_MS = 2000;

export type SearchProbe = "up" | "down";

/**
 * Asks Qdrant for the configured collection's metadata (`DEPLOYMENT_AND_ENVIRONMENTS.md`
 * §7). A paused free-tier cluster and a bad key both answer "not ok", which is exactly the
 * signal R3 needs; the distinction is not ours to guess here. Never throws and never
 * reports which URL or key was used.
 *
 * `QDRANT_COLLECTION` is required by `lib/env`, so there is no "not configured" answer to
 * report: a probe either reaches the cluster or it does not.
 */
export async function probeQdrant(): Promise<SearchProbe> {
  try {
    const response = await fetch(new URL(`/collections/${encodeURIComponent(env.QDRANT_COLLECTION)}`, env.QDRANT_URL), {
      headers: { "api-key": env.QDRANT_API_KEY },
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return response.ok ? "up" : "down";
  } catch {
    return "down";
  }
}
