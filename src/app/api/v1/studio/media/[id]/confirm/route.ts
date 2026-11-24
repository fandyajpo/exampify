import { NextResponse } from "next/server";

import { studio } from "@/lib/http/studio";
import { confirmMedia } from "@/lib/services/media-admin";

/**
 * `POST /api/v1/studio/media/{mediaId}/confirm` (`API_CONTRACTS.md` §7.6).
 *
 * No body. The server `HEAD`s the object, checks the size and the magic bytes, scrubs an SVG,
 * then marks the row `ready`. Idempotent: a second confirm returns the same row (§7.6).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = studio<{ id: string }>("media:write", async ({ actor, params }) =>
  NextResponse.json({ data: await confirmMedia(actor, params.id) }),
);
