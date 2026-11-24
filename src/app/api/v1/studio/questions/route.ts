import { NextResponse } from "next/server";

import { readJson, readQuery, studio } from "@/lib/http/studio";
import { createQuestion, listQuestions } from "@/lib/services/questions-admin";
import { questionCreateSchema, questionListQuerySchema } from "@/lib/validation/questions";

/**
 * `GET`/`POST /api/v1/studio/questions` (`API_CONTRACTS.md` §7.4).
 *
 * The list is filtered, sorted and keyset-paginated and never selects `answer_key`; the
 * create starts a draft and returns the detail read the editor needs. `status` moves through
 * the `§7.5` transition, not through this route.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = studio("content:read:studio", async ({ request }) =>
  NextResponse.json(await listQuestions(readQuery(questionListQuerySchema, request))),
);

export const POST = studio("content:write", async ({ actor, request }) => {
  const input = await readJson(questionCreateSchema, request);
  return NextResponse.json({ data: await createQuestion(actor, input) }, { status: 201 });
});
