import { NextResponse } from "next/server";

import { readJson, studio } from "@/lib/http/studio";
import { transitionEntity } from "@/lib/services/transitions";
import { transitionSchema } from "@/lib/validation/transitions";

/**
 * `POST /api/v1/studio/questions/{id}/transition` (`API_CONTRACTS.md` §7.5): the shared
 * lifecycle, with the `QUESTION_ENGINE.md` §10.1 gates on submit and publish.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = studio<{ id: string }>("content:write", async ({ actor, params, request }) => {
  const input = await readJson(transitionSchema, request);
  return NextResponse.json({ data: await transitionEntity("questions", params.id, actor, input) });
});
