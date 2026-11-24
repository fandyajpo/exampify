import { NextResponse } from "next/server";

import { readJson, studio } from "@/lib/http/studio";
import { validateQuestion } from "@/lib/services/questions-admin";
import { questionValidateSchema } from "@/lib/validation/questions";

/**
 * `POST /api/v1/studio/questions/validate` (`API_CONTRACTS.md` §7.4): the dry run for an
 * existing question. It runs the same `§10.1` gates the publish transition runs and writes
 * nothing.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = studio("content:read:studio", async ({ request }) => {
  const { id } = await readJson(questionValidateSchema, request);
  return NextResponse.json({ data: await validateQuestion(id) });
});
