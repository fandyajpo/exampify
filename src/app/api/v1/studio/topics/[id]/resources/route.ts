import { NextResponse } from "next/server";

import { readJson, studio } from "@/lib/http/studio";
import { createResource, listResourcesAdmin } from "@/lib/services/resources-admin";
import { resourceCreateSchema } from "@/lib/validation/resources";

/**
 * `GET`/`POST /api/v1/studio/topics/{id}/resources` (`API_CONTRACTS.md` §7.2).
 * `author`+; the list includes drafts and the derived `format`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = studio<{ id: string }>("content:read:studio", async ({ params }) =>
  NextResponse.json({ data: await listResourcesAdmin(params.id) }),
);

export const POST = studio<{ id: string }>("content:write", async ({ actor, params, request }) => {
  const input = await readJson(resourceCreateSchema, request);
  return NextResponse.json({ data: await createResource(actor, params.id, input) }, { status: 201 });
});
