import { NextResponse, type NextRequest } from "next/server";

import {
  MAX_EVENTS_BODY_BYTES,
  clientEventBatchSchema,
  redactProps,
} from "@/lib/analytics/events";
import { allowRequest } from "@/lib/analytics/rate-limit";
import { recordEvent } from "@/lib/analytics/record";

/**
 * `POST /api/v1/events` (`API_CONTRACTS.md` §16.1, `OBSERVABILITY_AND_ANALYTICS.md` §6.3) —
 * the only client analytics path.
 *
 * Rules that shape this handler:
 * - Only the client-safe names are accepted; server-side facts are never client-asserted.
 * - `204` for anything the student must not see: invalid events, malformed JSON, a rate
 *   limit hit. An analytics failure never surfaces as an error.
 * - A cross-origin request is rejected before the database is touched (`API-11`): that is
 *   a security refusal, not a dropped event.
 * - `received_at` is server time; the client timestamp is ordering-only.
 * - Props are redacted before storage, so no free text can enter `props_json`.
 *
 * The rate limit is the in-process fallback (`lib/analytics/rate-limit.ts`) until Upstash
 * Redis is provisioned in Phase 2.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANONYMOUS_COOKIE = "exampify_anon";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function readAnonymousId(request: NextRequest): string | null {
  const value = request.cookies.get(ANONYMOUS_COOKIE)?.value;
  return value && UUID_PATTERN.test(value) ? value : null;
}

function noContent(anonymousId?: string): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  if (anonymousId) {
    response.cookies.set(ANONYMOUS_COOKIE, anonymousId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN_ORIGIN", message: "Cross-origin requests are rejected." } },
      { status: 403 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_EVENTS_BODY_BYTES) return noContent();

  const anonymousId = readAnonymousId(request) ?? crypto.randomUUID();
  const clientKey =
    anonymousId ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!allowRequest(clientKey)) return noContent(anonymousId);

  const body = await request.text();
  if (body.length > MAX_EVENTS_BODY_BYTES) return noContent(anonymousId);

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return noContent(anonymousId);
  }

  const batch = clientEventBatchSchema.safeParse(parsed);
  if (!batch.success) return noContent(anonymousId);

  const requestId = crypto.randomUUID();

  try {
    for (const event of batch.data.events) {
      // The typed client schemas already restrict props; redaction is the second gate for
      // anything that slipped past a future schema change.
      await recordEvent({
        name: event.name,
        occurredAt: event.occurredAt,
        anonymousId,
        entityType: event.name === "search_result_clicked" ? "learning_resource" : null,
        entityId: null,
        props: redactProps(event.props),
        requestId,
      });
    }
  } catch (error) {
    // Analytics is never allowed to fail a student's request (§16.1, API-13).
    console.error(
      JSON.stringify({ level: "error", event: "analytics_ingest_failed", requestId, error: String(error) }),
    );
  }

  return noContent(anonymousId);
}
