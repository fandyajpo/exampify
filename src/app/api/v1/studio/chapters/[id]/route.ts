import { NextResponse } from "next/server";

import { readJson, studio } from "@/lib/http/studio";
import { updateChapter } from "@/lib/services/taxonomy-admin";
import { chapterUpdateSchema } from "@/lib/validation/taxonomy";

/** `PATCH /api/v1/studio/chapters/{id}` (`API_CONTRACTS.md` §7.1). `author`+, `expectedUpdatedAt`. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = studio<{ id: string }>("content:write", async ({ actor, params, request }) => {
  const input = await readJson(chapterUpdateSchema, request);
  return NextResponse.json({ data: await updateChapter(actor, params.id, input) });
});
