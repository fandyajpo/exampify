import { NextResponse } from "next/server";

import { readJson, studio } from "@/lib/http/studio";
import { getResourceAdmin, updateResource } from "@/lib/services/resources-admin";
import { resourceUpdateSchema } from "@/lib/validation/resources";
import { notFound } from "@/lib/http/errors";

/**
 * `GET`/`PATCH /api/v1/studio/resources/{id}` (`API_CONTRACTS.md` §7.2). The read returns
 * block payloads, never HTML; the write requires `expectedUpdatedAt` (§2, §12).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = studio<{ id: string }>("content:read:studio", async ({ params }) => {
  const resource = await getResourceAdmin(params.id);
  if (!resource) throw notFound("resource");
  return NextResponse.json({ data: resource });
});

export const PATCH = studio<{ id: string }>("content:write", async ({ actor, params, request }) => {
  const input = await readJson(resourceUpdateSchema, request);
  return NextResponse.json({ data: await updateResource(actor, params.id, input) });
});
