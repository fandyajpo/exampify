import { NextResponse } from "next/server";

import { studio } from "@/lib/http/studio";
import { duplicateQuestion } from "@/lib/services/questions-admin";

/**
 * `POST /api/v1/studio/questions/{id}/duplicate` (`API_CONTRACTS.md` §7.4): a draft copy
 * that keeps the options and the cross-listings, so a variation only edits what differs.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = studio<{ id: string }>("content:write", async ({ actor, params }) =>
  NextResponse.json({ data: await duplicateQuestion(actor, params.id) }, { status: 201 }),
);
