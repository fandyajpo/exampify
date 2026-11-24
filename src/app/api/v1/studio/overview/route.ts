import { NextResponse } from "next/server";

import { studio } from "@/lib/http/studio";
import { getStudioOverview } from "@/lib/services/overview";

/**
 * `GET /api/v1/studio/overview` (`API_CONTRACTS.md` §7.7): counts, the content-gap report
 * and recent edits. Recent edits are scoped by the audit rule: an `admin` sees every actor,
 * an `author` or `reviewer` only their own (`SEC §6`).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = studio("content:read:studio", async ({ actor }) =>
  NextResponse.json({ data: await getStudioOverview(actor) }),
);
