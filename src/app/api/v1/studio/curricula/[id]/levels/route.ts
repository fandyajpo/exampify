import { NextResponse } from "next/server";

import { readJson, studio } from "@/lib/http/studio";
import { createLevel } from "@/lib/services/taxonomy-admin";
import { levelCreateSchema } from "@/lib/validation/taxonomy";

/** `POST /api/v1/studio/curricula/{id}/levels` (`API_CONTRACTS.md` §7.1). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = studio<{ id: string }>("taxonomy:write", async ({ actor, params, request }) => {
  const input = await readJson(levelCreateSchema, request);
  return NextResponse.json({ data: await createLevel(actor, params.id, input) }, { status: 201 });
});
