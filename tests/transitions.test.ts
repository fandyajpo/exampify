import { describe, expect, it } from "vitest";

import { allowedTargets, resolveTransition } from "@/lib/content/lifecycle";
import type { Actor } from "@/lib/rbac";

/**
 * The lifecycle table of `CONTENT_MODEL.md` §6, asserted one edge at a time.
 *
 * These are the rules the transition route cannot enforce on its own — who may publish,
 * which edge needs a reason, which one queues a search event — so a regression here would
 * be a permission bug, not a formatting one.
 */

const author: Actor = { id: "user-author", role: "author" };
const otherAuthor: Actor = { id: "user-other", role: "author" };
const reviewer: Actor = { id: "user-reviewer", role: "reviewer" };
const admin: Actor = { id: "user-admin", role: "admin" };
const student: Actor = { id: "user-student", role: "student" };

const ownDraft = { status: "draft" as const, ownerId: author.id };
const ownReview = { status: "in_review" as const, ownerId: author.id };
const ownPublished = { status: "published" as const, ownerId: author.id };
const archived = { status: "archived" as const, ownerId: author.id };

function rejection(actor: Actor, row: Parameters<typeof resolveTransition>[1], to: Parameters<typeof resolveTransition>[2], reason?: string) {
  const result = resolveTransition(actor, row, to, reason);
  return result.ok ? null : result.code;
}

describe("publication lifecycle", () => {
  it("lets an author submit for review, with the gate running", () => {
    const result = resolveTransition(author, ownDraft, "in_review");
    expect(result.ok && result.edge).toMatchObject({ action: "submit", gate: true, search: null });
  });

  it("refuses a direct publish to anyone but an admin", () => {
    expect(rejection(author, ownDraft, "published")).toBe("FORBIDDEN");
    expect(rejection(reviewer, ownDraft, "published")).toBe("FORBIDDEN");

    const direct = resolveTransition(admin, ownDraft, "published");
    expect(direct.ok && direct.edge).toMatchObject({ action: "direct_publish", gate: true, search: "upsert" });
  });

  it("reserves approval for a reviewer or an admin", () => {
    expect(rejection(author, ownReview, "published")).toBe("FORBIDDEN");

    const approved = resolveTransition(reviewer, ownReview, "published");
    expect(approved.ok && approved.edge).toMatchObject({ action: "publish", gate: true, search: "upsert" });
  });

  it("requires a reason to send work back, and only staff can send it back", () => {
    expect(rejection(reviewer, ownReview, "draft")).toBe("REASON_REQUIRED");
    expect(rejection(author, ownReview, "draft", "Needs a worked example.")).toBe("FORBIDDEN");

    const sentBack = resolveTransition(reviewer, ownReview, "draft", "Add a worked example before we publish.");
    expect(sentBack.ok && sentBack.edge).toMatchObject({ action: "return_to_draft", requiresReason: true });
  });

  it("lets an author unpublish their own work but not someone else's", () => {
    const own = resolveTransition(author, ownPublished, "draft");
    expect(own.ok && own.edge).toMatchObject({ action: "unpublish", search: "delete" });

    expect(rejection(author, { ...ownPublished, ownerId: "user-someone-else" }, "draft")).toBe("FORBIDDEN");
    expect(rejection(reviewer, { ...ownPublished, ownerId: "user-someone-else" }, "draft")).toBeNull();
  });

  it("queues a search removal when published content leaves the site", () => {
    const unpublished = resolveTransition(reviewer, ownPublished, "draft");
    expect(unpublished.ok && unpublished.edge.search).toBe("delete");

    const archivedFromPublished = resolveTransition(reviewer, ownPublished, "archived");
    expect(archivedFromPublished.ok && archivedFromPublished.edge.search).toBe("delete");
  });

  it("allows archiving from draft and in_review without a search event", () => {
    for (const row of [ownDraft, ownReview]) {
      const result = resolveTransition(author, row, "archived");
      expect(result.ok && result.edge).toMatchObject({ action: "archive", search: null });
    }
  });

  it("only an admin restores from the archive", () => {
    expect(rejection(author, archived, "draft")).toBe("FORBIDDEN");
    expect(rejection(reviewer, archived, "draft")).toBe("FORBIDDEN");

    const restored = resolveTransition(admin, archived, "draft");
    expect(restored.ok && restored.edge).toMatchObject({ action: "restore", search: null });
  });

  it("refuses edges the graph does not have", () => {
    expect(rejection(admin, ownPublished, "in_review")).toBe("INVALID_TRANSITION");
    expect(rejection(admin, archived, "published")).toBe("INVALID_TRANSITION");
    expect(rejection(admin, ownDraft, "draft")).toBe("INVALID_TRANSITION");
  });

  it("denies a student every transition", () => {
    expect(rejection(student, ownDraft, "in_review")).toBe("FORBIDDEN");
    expect(rejection(student, ownPublished, "draft")).toBe("FORBIDDEN");
    expect(rejection(student, archived, "draft")).toBe("FORBIDDEN");
  });

  it("offers only the targets that role may take", () => {
    expect(allowedTargets(author, ownDraft)).toEqual(["in_review", "archived"]);
    expect(allowedTargets(reviewer, ownReview)).toEqual(["draft", "published", "archived"]);
    expect(allowedTargets(admin, ownDraft)).toEqual(["in_review", "published", "archived"]);
    expect(allowedTargets(admin, archived)).toEqual(["draft"]);
    expect(allowedTargets(student, ownDraft)).toEqual([]);
    expect(allowedTargets(otherAuthor, ownDraft)).toEqual(["in_review"]);
  });
});
