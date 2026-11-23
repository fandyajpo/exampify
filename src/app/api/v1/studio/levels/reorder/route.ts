import { NextResponse } from "next/server";

import { readJson, studio } from "@/lib/http/studio";
import { reorderEntity } from "@/lib/services/taxonomy-admin";
import { reorderSchema } from "@/lib/validation/taxonomy";

/** `POST /api/v1/studio/{entity}/reorder` for levels, scoped by `parentId` (`§7.1`). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = studio("taxonomy:write", async ({ actor, request }) => {
  const input = await readJson(reorderSchema, request);
  await reorderEntity("levels", actor, input);
  return new NextResponse(null, { status: 204 });
});
