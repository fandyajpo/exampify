import { NextResponse } from "next/server";

import { readQuery, studio } from "@/lib/http/studio";
import { listMedia } from "@/lib/services/media-admin";
import { mediaListQuerySchema } from "@/lib/validation/media";

/**
 * `GET /api/v1/studio/media` (`API_CONTRACTS.md` §7.6): newest first, cursor-paginated,
 * `deleted` rows excluded unless `status=deleted` asks for them.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = studio("content:read:studio", async ({ request }) =>
  NextResponse.json(await listMedia(readQuery(mediaListQuerySchema, request))),
);
