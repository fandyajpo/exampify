import { NextResponse } from "next/server";

import { readJson, studio } from "@/lib/http/studio";
import { deleteMedia, updateMediaAltText } from "@/lib/services/media-admin";
import { mediaAltTextSchema } from "@/lib/validation/media";

/**
 * `PATCH`/`DELETE /api/v1/studio/media/{id}` (`API_CONTRACTS.md` §7.6).
 *
 * Only `altText` is editable: the bytes, type and key are fixed once the object is confirmed.
 * A delete is soft and answers `409 MEDIA_IN_USE` while content still references the asset.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = studio<{ id: string }>("media:write", async ({ actor, params, request }) => {
  const input = await readJson(mediaAltTextSchema, request);
  return NextResponse.json({ data: await updateMediaAltText(actor, params.id, input.altText) });
});

export const DELETE = studio<{ id: string }>("media:write", async ({ actor, params }) => {
  await deleteMedia(actor, params.id);
  return new NextResponse(null, { status: 204 });
});
