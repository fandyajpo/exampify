import { NextResponse } from "next/server";

import { buildOpenApiDocument } from "@/lib/openapi/document";

/**
 * `GET /api/v1/openapi.json` (`API_CONTRACTS.md` §16.2).
 *
 * The machine contract is generated from the registry and served **only outside
 * production**: `OQ-API2` (publish the document to third-party clients?) is unresolved, so
 * an unpublished surface is not assumed. The committed `openapi.json` is the artifact; this
 * route is how a reviewer reads it without checking out the file.
 */

// Not prerendered: the production branch returns a 404 envelope, and generating the
// document per request keeps that branch honest at runtime rather than baked at build.
export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Not found.", requestId: crypto.randomUUID() } },
      { status: 404 },
    );
  }

  return NextResponse.json(buildOpenApiDocument(), {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
