"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { allowedTargets } from "@/lib/content/lifecycle";
import type { Role } from "@/lib/rbac";
import { transitionAction } from "@/lib/studio/actions";
import { initialTransitionState } from "@/lib/studio/transition-state";
import type { ContentStatus } from "@/lib/validation/taxonomy";
import type { TransitionEntity } from "@/lib/validation/transitions";

/**
 * The lifecycle control (`CONTENT_MODEL.md` §6): the buttons are the edges this role may
 * take from the row's current status, so a draft offers "Submit for review" and never
 * "Publish". The server re-checks every edge — this list only decides what to show.
 *
 * One form with one submit button per target: the clicked button carries `to`, and the
 * send-back edge picks up the reason field the reviewer had to write.
 */

const LABELS: Record<string, string> = {
  "draft:in_review": "Submit for review",
  "draft:published": "Publish now",
  "draft:archived": "Archive",
  "in_review:published": "Publish",
  "in_review:draft": "Send back",
  "in_review:archived": "Archive",
  "published:draft": "Unpublish",
  "published:archived": "Archive",
  "archived:draft": "Restore as draft",
};

type Props = {
  entity: TransitionEntity;
  id: string;
  status: ContentStatus;
  role: Role;
};

export function TransitionControls({ entity, id, status, role }: Props): React.JSX.Element | null {
  const [state, formAction, pending] = useActionState(transitionAction, initialTransitionState);
  // `ownerId: null` reads as "your own row": the server decides ownership for real, and an
  // author clicking a button on someone else's row gets the documented 403 rather than a
  // hidden control.
  const targets = allowedTargets({ id: "", role }, { status, ownerId: null });

  if (targets.length === 0 && state.status === "idle") return null;

  const needsReason = status === "in_review" && targets.includes("draft");
  // A lifecycle refusal repeats its sentence in `details`; showing both reads like a stutter.
  const fieldDetails =
    state.status === "error" ? state.details.filter((detail) => detail.message !== state.message) : [];

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="entity" value={entity} />
        <input type="hidden" name="id" value={id} />

        {needsReason ? (
          <label className="flex w-full max-w-[42ch] flex-col gap-1 text-sm">
            <span className="font-medium text-ink-2">Reason for sending back</span>
            <textarea
              name="reason"
              rows={2}
              minLength={10}
              maxLength={500}
              placeholder="What needs changing, in one sentence?"
              className="rounded-sm border border-line-strong bg-paper-raised px-3 py-2 text-sm text-ink"
            />
          </label>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {targets.map((to) => (
            <Button
              key={to}
              type="submit"
              name="to"
              value={to}
              size="sm"
              variant={to === "published" ? "primary" : "secondary"}
              disabled={pending}
            >
              {LABELS[`${status}:${to}`] ?? to}
            </Button>
          ))}
        </div>
      </form>

      {state.status === "error" ? (
        <div
          role="alert"
          className="rounded-sm border border-coral/40 bg-blush/30 px-3 py-2 text-sm text-coral-ink"
        >
          <p>{state.message}</p>
          {fieldDetails.length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {fieldDetails.map((detail) => (
                <li key={`${detail.path}-${detail.message}`}>{detail.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {state.status === "saved" ? (
        <p role="status" className="rounded-sm border border-leaf/30 bg-mint/25 px-3 py-2 text-sm text-leaf">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
