import { NextResponse } from "next/server";

import { readJson, studio } from "@/lib/http/studio";
import { archiveEntity, updateSubject } from "@/lib/services/taxonomy-admin";
import { subjectUpdateSchema } from "@/lib/validation/taxonomy";

/** `PATCH`/`DELETE /api/v1/studio/subjects/{id}` (`API_CONTRACTS.md` §7.1). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = studio<{ id: string }>("taxonomy:write", async ({ actor, params, request }) => {
  const input = await readJson(subjectUpdateSchema, request);
  return NextResponse.json({ data: await updateSubject(actor, params.id, input) });
});

export const DELETE = studio<{ id: string }>("taxonomy:write", async ({ actor, params }) => {
  await archiveEntity("subjects", params.id, actor);
  return new NextResponse(null, { status: 204 });
});
