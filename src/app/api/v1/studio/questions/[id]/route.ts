import { NextResponse } from "next/server";

import { notFound } from "@/lib/http/errors";
import { readJson, studio } from "@/lib/http/studio";
import {
  archiveQuestion,
  getQuestionAdmin,
  updateQuestion,
} from "@/lib/services/questions-admin";
import { questionUpdateSchema } from "@/lib/validation/questions";

/**
 * `GET`/`PATCH`/`DELETE /api/v1/studio/questions/{id}` (`API_CONTRACTS.md` §7.4).
 *
 * The detail read is the one response that carries `answerKey` and option feedback; the
 * patch requires `expectedUpdatedAt`; the delete archives, and refuses while a published
 * assessment still uses the question.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = studio<{ id: string }>("content:read:studio", async ({ params }) => {
  const question = await getQuestionAdmin(params.id);
  if (!question) throw notFound("question");
  return NextResponse.json({ data: question });
});

export const PATCH = studio<{ id: string }>("content:write", async ({ actor, params, request }) => {
  const input = await readJson(questionUpdateSchema, request);
  return NextResponse.json({ data: await updateQuestion(actor, params.id, input) });
});

export const DELETE = studio<{ id: string }>("content:write", async ({ actor, params }) => {
  await archiveQuestion(actor, params.id);
  return new NextResponse(null, { status: 204 });
});
