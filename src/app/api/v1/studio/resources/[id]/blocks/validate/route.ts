import { NextResponse } from "next/server";

import { studio } from "@/lib/http/studio";
import { validateResource } from "@/lib/services/resources-admin";

/**
 * `POST /api/v1/studio/resources/{id}/blocks/validate` (`API_CONTRACTS.md` §7.2): the dry
 * run of every block and publish gate, reusing the same evaluator the publish transition
 * runs, so the studio cannot show "passing" for content the publish would refuse.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = studio<{ id: string }>("content:read:studio", async ({ params }) =>
  NextResponse.json({ data: await validateResource(params.id) }),
);
