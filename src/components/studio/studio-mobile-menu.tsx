"use client";

/**
 * Studio navigation below `lg`: the sidebar is hidden there, so the same grouped links open in
 * the shared `MobileSheet`. The desktop sidebar stays mounted, so its scroll position and
 * focus context survive opening and closing this panel.
 */
import Link from "next/link";

import { StudioNav } from "@/components/studio/studio-nav";
import { MobileSheet } from "@/components/ui/mobile-sheet";

export function StudioMobileMenu({
  role,
}: {
  role: string;
}): React.JSX.Element {
  return (
    <MobileSheet
      panelLabel="Studio menu"
      triggerLabel="Studio menu"
      hiddenFrom="lg"
    >
      <div className="p-4">
        <StudioNav variant="panel" />
      </div>

      <div className="mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
        <span className="capitalize text-ink-3">{role}</span>
        <Link
          href="/"
          className="min-h-10 text-ink-2 underline-offset-4 hover:text-ink hover:underline"
        >
          View site →
        </Link>
      </div>
    </MobileSheet>
  );
}
