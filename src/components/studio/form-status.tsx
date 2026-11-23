"use client";

import type { StudioFormState } from "@/lib/studio/form-state";

/**
 * The success/error banner every studio form shows (`DESIGN_SYSTEM.md` §9.6). One component
 * keeps the wording, the ARIA roles and the colours from drifting between forms; a form
 * that only renders its fields never has to copy the markup.
 */
export function FormStatus({ state }: { state: StudioFormState }): React.JSX.Element | null {
  if (state.status === "error") {
    return (
      <p role="alert" className="rounded-sm border border-coral/40 bg-blush/30 px-3 py-2 text-sm text-coral-ink">
        {state.message}
      </p>
    );
  }

  if (state.status === "saved") {
    return (
      <p role="status" className="rounded-sm border border-leaf/30 bg-mint/25 px-3 py-2 text-sm text-leaf">
        {state.message}
      </p>
    );
  }

  return null;
}
