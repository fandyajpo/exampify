/**
 * The publication lifecycle (`CONTENT_MODEL.md` §6) as pure rules.
 *
 * No database, no HTTP: this module answers one question — may this actor move this row from
 * `from` to `to`, and what does the move entail — so the route, the service and the tests
 * share one copy of the state machine instead of three drifting ones.
 *
 * The graph is deliberately small and closed. Anything not listed is refused, including
 * `published → published` and `archived → published`; a new edge is a deliberate edit here,
 * not a side effect of a generic "set status" write.
 */

import { can, type Actor } from "@/lib/rbac";

import type { ContentStatus } from "@/lib/validation/taxonomy";

/** The row facts the rules need. `ownerId` is `null` where a table has no `created_by`. */
export type TransitionRow = {
  status: ContentStatus;
  ownerId: string | null;
};

/** Audit verbs; the stored action is `<entity>.<action>` (`chapter.publish`). */
export type TransitionAction =
  | "submit"
  | "return_to_draft"
  | "publish"
  | "direct_publish"
  | "unpublish"
  | "archive"
  | "restore";

export type Edge = {
  to: ContentStatus;
  action: TransitionAction;
  /** Publish-gate validation runs before a submit or a publish (§6). */
  gate: boolean;
  /** The transactional search event this transition writes, if any (ADR-021). */
  search: "upsert" | "delete" | null;
  requiresReason: boolean;
};

type Rule = Edge & { allows: (actor: Actor, row: TransitionRow) => boolean };

/**
 * `author` reaches only their own rows; reviewer and admin reach everything (§6, "author
 * (own)"). A student never reaches a row through this helper — the capability check at each
 * call site still has to pass, and ownership only widens an author's reach, never a
 * student's.
 */
function staffOrOwn(actor: Actor, row: TransitionRow): boolean {
  if (actor.role === "reviewer" || actor.role === "admin") return true;
  if (actor.role !== "author") return false;
  return row.ownerId === null || row.ownerId === actor.id;
}

const RULES: Record<ContentStatus, readonly Rule[]> = {
  draft: [
    {
      to: "in_review",
      action: "submit",
      gate: true,
      search: null,
      requiresReason: false,
      allows: (actor) => can(actor, "content:submit"),
    },
    // Seeding and fixing a typo on live content: `admin` only, audited as `direct_publish`.
    {
      to: "published",
      action: "direct_publish",
      gate: true,
      search: "upsert",
      requiresReason: false,
      allows: (actor) => actor.role === "admin",
    },
    {
      to: "archived",
      action: "archive",
      gate: false,
      search: null,
      requiresReason: false,
      allows: (actor, row) => can(actor, "content:archive") && staffOrOwn(actor, row),
    },
  ],
  in_review: [
    {
      to: "draft",
      action: "return_to_draft",
      gate: false,
      search: null,
      requiresReason: true,
      allows: (actor) => can(actor, "content:publish"),
    },
    {
      to: "published",
      action: "publish",
      gate: true,
      search: "upsert",
      requiresReason: false,
      allows: (actor) => can(actor, "content:publish"),
    },
    {
      to: "archived",
      action: "archive",
      gate: false,
      search: null,
      requiresReason: false,
      allows: (actor, row) => can(actor, "content:archive") && staffOrOwn(actor, row),
    },
  ],
  published: [
    {
      to: "draft",
      action: "unpublish",
      gate: false,
      search: "delete",
      requiresReason: false,
      // An author may unpublish what they wrote; taking down someone else's work is a
      // reviewer/admin action, so the ownership path is gated on the author role.
      allows: (actor, row) =>
        can(actor, "content:unpublish") || (actor.role === "author" && staffOrOwn(actor, row)),
    },
    {
      to: "archived",
      action: "archive",
      gate: false,
      search: "delete",
      requiresReason: false,
      allows: (actor, row) => can(actor, "content:archive") && staffOrOwn(actor, row),
    },
  ],
  archived: [
    {
      to: "draft",
      action: "restore",
      gate: false,
      search: null,
      requiresReason: false,
      allows: (actor) => actor.role === "admin",
    },
  ],
};

export type RefusalCode = "INVALID_TRANSITION" | "FORBIDDEN" | "REASON_REQUIRED";

export type TransitionResolution =
  | { ok: true; edge: Edge }
  | { ok: false; code: RefusalCode; message: string };

const STATUS_WORDS: Record<ContentStatus, string> = {
  draft: "a draft",
  in_review: "in review",
  published: "published",
  archived: "archived",
};

/**
 * The one decision point. `reason` is only consulted for the edge that requires it; the
 * schema has already rejected a too-short one when it was sent.
 */
export function resolveTransition(
  actor: Actor,
  row: TransitionRow,
  to: ContentStatus,
  reason?: string,
): TransitionResolution {
  const rule = RULES[row.status].find((candidate) => candidate.to === to);
  if (!rule) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Can't move from ${STATUS_WORDS[row.status]} to ${STATUS_WORDS[to]}.`,
    };
  }

  if (!rule.allows(actor, row)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message:
        rule.action === "publish" || rule.action === "direct_publish" || rule.action === "return_to_draft"
          ? "Only a reviewer or an admin can review or publish content."
          : "Your role can't make that change.",
    };
  }

  if (rule.requiresReason && !reason) {
    return {
      ok: false,
      code: "REASON_REQUIRED",
      message: "Explain what needs changing, so the author knows what to fix.",
    };
  }

  return {
    ok: true,
    edge: {
      to: rule.to,
      action: rule.action,
      gate: rule.gate,
      search: rule.search,
      requiresReason: rule.requiresReason,
    },
  };
}

/** The statuses this actor may move the row to right now — what the studio menu offers. */
export function allowedTargets(actor: Actor, row: TransitionRow): ContentStatus[] {
  return RULES[row.status]
    .filter((rule) => rule.allows(actor, row))
    .map((rule) => rule.to);
}
