import { NextResponse } from "next/server";

import { readJson, studio } from "@/lib/http/studio";
import { createBlock, listBlocks } from "@/lib/services/resources-admin";
import { blockCreateSchema } from "@/lib/validation/resources";

/**
 * `GET`/`POST /api/v1/studio/resources/{id}/blocks` (`API_CONTRACTS.md` §7.2). A payload
 * that does not match its `kind` is `422 INVALID_BLOCK` with the offending path (API-19).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = studio<{ id: string }>("content:read:studio", async ({ params }) =>
  NextResponse.json({ data: await listBlocks(params.id) }),
);

export const POST = studio<{ id: string }>("content:write", async ({ actor, params, request }) => {
  const input = await readJson(blockCreateSchema, request);
  return NextResponse.json({ data: await createBlock(actor, params.id, input) }, { status: 201 });
});
