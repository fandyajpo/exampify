import { NextResponse } from "next/server";

import { readQuery, studio } from "@/lib/http/studio";
import { listAuditLogs } from "@/lib/services/audit-admin";
import { auditListQuerySchema } from "@/lib/validation/audit";

/**
 * `GET /api/v1/studio/audit` (`API_CONTRACTS.md` §7.7): `?entityType=&entityId=&actorId=&from=&to=&cursor=`,
 * newest first. `admin` reads every actor; an `author` or `reviewer` is scoped to their own
 * rows and a filter naming someone else is `403` (`SEC §6`).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = studio("content:read:studio", async ({ actor, request }) =>
  NextResponse.json(await listAuditLogs(actor, readQuery(auditListQuerySchema, request))),
);
