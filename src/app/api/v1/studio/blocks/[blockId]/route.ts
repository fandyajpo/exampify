import { NextResponse } from "next/server";

import { readJson, studio } from "@/lib/http/studio";
import { deleteBlock, updateBlock } from "@/lib/services/resources-admin";
import { blockUpdateSchema } from "@/lib/validation/resources";

/**
 * `PATCH`/`DELETE /api/v1/studio/blocks/{blockId}` (`API_CONTRACTS.md` §7.2).
 *
 * The payload is replaced wholesale — there is no partial payload patch, because a
 * half-valid block cannot be rendered. Autosave sends `expectedUpdatedAt` and a stale value
 * is `409 CONTENT_CONFLICT` with the current timestamp (§12). Deleting renumbers positions.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = studio<{ blockId: string }>("content:write", async ({ actor, params, request }) => {
  const input = await readJson(blockUpdateSchema, request);
  return NextResponse.json({ data: await updateBlock(actor, params.blockId, input) });
});

export const DELETE = studio<{ blockId: string }>("content:write", async ({ actor, params }) => {
  await deleteBlock(actor, params.blockId);
  return new NextResponse(null, { status: 204 });
});
