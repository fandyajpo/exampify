import { NextResponse } from "next/server";

import { readJson, readQuery, studio } from "@/lib/http/studio";
import { createTopic, listTopicsAdmin } from "@/lib/services/taxonomy-admin";
import { topicCreateSchema, topicListQuerySchema } from "@/lib/validation/taxonomy";

/**
 * `GET`/`POST /api/v1/studio/topics` (`API_CONTRACTS.md` §7.1).
 *
 * One chapter's topics for the author, drafts included, plus the create that files a new
 * topic under a chapter. Learning objectives are stored as JSON text and returned as an
 * array; `status` is left to the `§7.5` transition.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = studio("content:read:studio", async ({ request }) => {
  const query = readQuery(topicListQuerySchema, request);
  return NextResponse.json(await listTopicsAdmin(query));
});

export const POST = studio("content:write", async ({ actor, request }) => {
  const input = await readJson(topicCreateSchema, request);
  return NextResponse.json({ data: await createTopic(actor, input) }, { status: 201 });
});
