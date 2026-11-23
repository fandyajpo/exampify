import { NextResponse } from "next/server";

import { readJson, studio } from "@/lib/http/studio";
import { createCurriculum, listCurriculumTree } from "@/lib/services/taxonomy-admin";
import { curriculumCreateSchema } from "@/lib/validation/taxonomy";

/**
 * `GET`/`POST /api/v1/studio/curricula` (`API_CONTRACTS.md` §7.1).
 *
 * Reading is `author`+, because every author needs the tree to file content; writing is
 * `admin` only, like the rest of the taxonomy. The list includes drafts — this is the one
 * read path where that is the point.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = studio("content:read:studio", async () => {
  return NextResponse.json(await listCurriculumTree());
});

export const POST = studio("taxonomy:write", async ({ actor, request }) => {
  const input = await readJson(curriculumCreateSchema, request);
  return NextResponse.json({ data: await createCurriculum(actor, input) }, { status: 201 });
});
