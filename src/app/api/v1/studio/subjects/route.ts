import { NextResponse } from "next/server";

import { readJson, readQuery, studio } from "@/lib/http/studio";
import { createSubject, listSubjectsAdmin } from "@/lib/services/taxonomy-admin";
import { subjectCreateSchema, subjectListQuerySchema } from "@/lib/validation/taxonomy";

/**
 * `GET`/`POST /api/v1/studio/subjects` (`API_CONTRACTS.md` §7.1).
 *
 * The list is the first cursor-paginated studio set: filters, an allow-listed sort and an
 * opaque cursor (§10), all rejected when they are not in the schema.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = studio("content:read:studio", async ({ request }) => {
  const query = readQuery(subjectListQuerySchema, request);
  return NextResponse.json(await listSubjectsAdmin(query));
});

export const POST = studio("taxonomy:write", async ({ actor, request }) => {
  const input = await readJson(subjectCreateSchema, request);
  return NextResponse.json({ data: await createSubject(actor, input) }, { status: 201 });
});
