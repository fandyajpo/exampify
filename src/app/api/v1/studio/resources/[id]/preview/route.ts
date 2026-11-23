import { NextResponse } from "next/server";

import { notFound } from "@/lib/http/errors";
import { studio } from "@/lib/http/studio";
import { getResourcePreview } from "@/lib/services/resources-admin";

/**
 * `GET /api/v1/studio/resources/{id}/preview` (`API_CONTRACTS.md` §7.2): rendered block
 * payloads for a staff preview. The preview page itself sends `noindex`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = studio<{ id: string }>("content:read:studio", async ({ params }) => {
  const preview = await getResourcePreview(params.id);
  if (!preview) throw notFound("resource");
  return NextResponse.json({
    data: {
      resource: preview.resource,
      blocks: preview.blocks,
      media: preview.media,
      noindex: true,
    },
  });
});
