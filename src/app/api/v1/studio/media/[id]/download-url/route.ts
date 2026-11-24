import { NextResponse } from "next/server";

import { studio } from "@/lib/http/studio";
import { getMediaDownloadUrl } from "@/lib/services/media-admin";

/**
 * `GET /api/v1/studio/media/{id}/download-url` (`API_CONTRACTS.md` §7.6): a signed read for a
 * private asset, valid for at most 10 minutes.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = studio<{ id: string }>("content:read:studio", async ({ params }) =>
  NextResponse.json({ data: await getMediaDownloadUrl(params.id) }),
);
