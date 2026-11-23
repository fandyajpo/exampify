import { NextResponse } from "next/server";

import { readJson, readQuery, studio } from "@/lib/http/studio";
import { createChapter, listChaptersAdmin } from "@/lib/services/taxonomy-admin";
import { chapterCreateSchema, chapterListQuerySchema } from "@/lib/validation/taxonomy";

/**
 * `GET`/`POST /api/v1/studio/chapters` (`API_CONTRACTS.md` §7.1).
 *
 * Reading one subject's chapters is `author`+; writing is `content:write`, which is also
 * `author`+ — chapters are content, not taxonomy. `status` is not accepted on write: it
 * moves through the `§7.5` transition, where the publish gates live.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = studio("content:read:studio", async ({ request }) => {
  const query = readQuery(chapterListQuerySchema, request);
  return NextResponse.json(await listChaptersAdmin(query));
});

export const POST = studio("content:write", async ({ actor, request }) => {
  const input = await readJson(chapterCreateSchema, request);
  return NextResponse.json({ data: await createChapter(actor, input) }, { status: 201 });
});
