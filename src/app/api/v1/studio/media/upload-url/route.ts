import { NextResponse } from "next/server";

import { readJson, studio } from "@/lib/http/studio";
import { createMediaUpload } from "@/lib/services/media-admin";
import { mediaUploadUrlSchema } from "@/lib/validation/media";

/**
 * `POST /api/v1/studio/media/upload-url` (`API_CONTRACTS.md` §7.6).
 *
 * `author`+. Creates the `pending` row and the presigned `PUT` together, signed for the exact
 * content type and length; the browser uploads straight to Tigris, never through a function.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = studio("media:write", async ({ actor, request }) => {
  const input = await readJson(mediaUploadUrlSchema, request);
  return NextResponse.json({ data: await createMediaUpload(actor, input) }, { status: 201 });
});
