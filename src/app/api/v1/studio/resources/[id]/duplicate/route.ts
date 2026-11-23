import { NextResponse } from "next/server";

import { studio } from "@/lib/http/studio";
import { duplicateResource } from "@/lib/services/resources-admin";

/**
 * `POST /api/v1/studio/resources/{id}/duplicate` (`API_CONTRACTS.md` §7.2,
 * `CONTENT_MODEL.md` §7): a draft copy with fresh block ids and the same assessment links.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = studio<{ id: string }>("content:write", async ({ actor, params }) =>
  NextResponse.json({ data: await duplicateResource(actor, params.id) }, { status: 201 }),
);
