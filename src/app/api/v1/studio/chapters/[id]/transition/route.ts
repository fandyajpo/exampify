import { NextResponse } from "next/server";

import { readJson, studio } from "@/lib/http/studio";
import { transitionEntity } from "@/lib/services/transitions";
import { transitionSchema } from "@/lib/validation/transitions";

/** `POST /api/v1/studio/chapters/{id}/transition` (`API_CONTRACTS.md` §7.5). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = studio<{ id: string }>("content:write", async ({ actor, params, request }) => {
  const input = await readJson(transitionSchema, request);
  return NextResponse.json({ data: await transitionEntity("chapters", params.id, actor, input) });
});
