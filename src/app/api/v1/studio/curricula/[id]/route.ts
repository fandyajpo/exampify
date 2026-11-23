import { NextResponse } from "next/server";

import { readJson, studio } from "@/lib/http/studio";
import { archiveEntity, updateCurriculum } from "@/lib/services/taxonomy-admin";
import { curriculumUpdateSchema } from "@/lib/validation/taxonomy";

/** `PATCH`/`DELETE /api/v1/studio/curricula/{id}` (`API_CONTRACTS.md` §7.1). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = studio<{ id: string }>("taxonomy:write", async ({ actor, params, request }) => {
  const input = await readJson(curriculumUpdateSchema, request);
  return NextResponse.json({ data: await updateCurriculum(actor, params.id, input) });
});

/** `DELETE` archives; it never removes the row (§7.1). */
export const DELETE = studio<{ id: string }>("taxonomy:write", async ({ actor, params }) => {
  await archiveEntity("curricula", params.id, actor);
  return new NextResponse(null, { status: 204 });
});
