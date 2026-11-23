import { NextResponse } from "next/server";

import { probeDatabase } from "@/lib/db/client";
import { probeQdrant } from "@/lib/search";

/**
 * `GET /api/v1/health` (`DEPLOYMENT_AND_ENVIRONMENTS.md` §7, §11.9;
 * `OBSERVABILITY_AND_ANALYTICS.md` §2; `BACKGROUND_JOBS.md` §10).
 *
 * The first step of every runbook entry and of the post-deploy smoke check, so it has two
 * jobs: say whether each dependency answers, and leak nothing while doing it. No host, no
 * collection name, no token, no error message — only `up`/`down` and a commit prefix.
 *
 * `indexLagSeconds` is `null` until `search_events` exists (Phase 6). The field is in the
 * contract now so the alert and the smoke check can be written against a stable shape.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const [dbUp, qdrant] = await Promise.all([probeDatabase(), probeQdrant()]);
  const db = dbUp ? "up" : "down";

  const status = db === "down" ? "down" : qdrant === "up" ? "ok" : "degraded";

  return NextResponse.json(
    {
      data: {
        status,
        db,
        qdrant,
        indexLagSeconds: null,
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
      },
    },
    {
      status: dbUp ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
