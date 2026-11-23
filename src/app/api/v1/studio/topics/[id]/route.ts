import { NextResponse } from "next/server";

import { readJson, studio } from "@/lib/http/studio";
import { updateTopic } from "@/lib/services/taxonomy-admin";
import { topicUpdateSchema } from "@/lib/validation/taxonomy";

/** `PATCH /api/v1/studio/topics/{id}` (`API_CONTRACTS.md` §7.1). `author`+, `expectedUpdatedAt`. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = studio<{ id: string }>("content:write", async ({ actor, params, request }) => {
  const input = await readJson(topicUpdateSchema, request);
  return NextResponse.json({ data: await updateTopic(actor, params.id, input) });
});
