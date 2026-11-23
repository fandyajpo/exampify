import { NextResponse } from "next/server";

import { readJson, studio } from "@/lib/http/studio";
import { reorderBlocks } from "@/lib/services/resources-admin";
import { blockReorderSchema } from "@/lib/validation/resources";

/**
 * `POST /api/v1/studio/resources/{id}/blocks/reorder` (`API_CONTRACTS.md` §7.2): a
 * whole-list operation, not a per-item ±1 shuffle (§5.2).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = studio<{ id: string }>("content:write", async ({ actor, params, request }) => {
  const input = await readJson(blockReorderSchema, request);
  await reorderBlocks(actor, params.id, input.orderedIds);
  return new NextResponse(null, { status: 204 });
});
