"use client";

/**
 * The one mobile navigation sheet, shared by the public header and the studio shell
 * (`DESIGN_SYSTEM.md` §5.4, §9.7).
 *
 * A native `<details>` keeps the menu usable without JavaScript; the effects and the panel's
 * click handler only add the dismissals `<details>` does not provide on its own — Escape, a
 * tap outside, arriving on a new route (a soft navigation keeps the header mounted), and
 * following a link that points at the page you are already on. The panel is a full-width
 * opaque sheet docked under the 64 px bar, so 48 px rows stay comfortable at 320 px. It is
 * opaque rather than a material on purpose: it opens inside the header's `backdrop-filter`,
 * and a nested backdrop filter has the bar — not the page — as its backdrop.
 *
 * The caller supplies the trigger's breakpoint (`hiddenFrom`) so the same sheet serves a bar
 * that collapses at `md` and one that collapses at `lg`. Links need no close callback: the
 * panel handles every anchor inside it.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { IconMenu } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/** Static class names: Tailwind must see them as literals. */
const HIDDEN_FROM = {
  md: "md:hidden",
  lg: "lg:hidden",
} as const;

export function MobileSheet({
  panelLabel,
  triggerLabel,
  hiddenFrom,
  children,
}: {
  /** Small caps heading at the top of the sheet, also used in the scrim's label. */
  panelLabel: string;
  triggerLabel: string;
  hiddenFrom: keyof typeof HIDDEN_FROM;
  children: ReactNode;
}): React.JSX.Element {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  function close(): void {
    ref.current?.removeAttribute("open");
  }

  useEffect(() => {
    close();
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") close();
    }
    function onPointerDown(event: PointerEvent): void {
      const element = ref.current;
      if (element?.open && !element.contains(event.target as Node)) close();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  const breakpoint = HIDDEN_FROM[hiddenFrom];

  return (
    <details ref={ref} className={cn("group relative", breakpoint)}>
      <summary
        className="press inline-flex size-10 cursor-pointer list-none items-center justify-center rounded-full bg-paper-sunk text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden"
        aria-label={triggerLabel}
      >
        <IconMenu className="size-5" />
      </summary>

      {/* A real dismiss target for touch: the scrim is a button, so it is reachable and
          labelled, not a decorative div with a click handler.

          The height is explicit rather than stretched with `bottom-0`: the sheet opens
          inside the header's `backdrop-filter`, which makes the header the containing
          block for fixed descendants. `top-16` and `bottom-0` then resolve against the
          64 px bar itself and collapse the scrim to nothing. */}
      <button
        type="button"
        aria-label={`Close ${panelLabel.toLowerCase()}`}
        onClick={close}
        className={cn(
          "fixed inset-x-0 top-16 z-30 h-[calc(100dvh-4rem)] cursor-default bg-[var(--scrim)]",
          breakpoint,
        )}
      />

      <div
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a"))
            close();
        }}
        className={cn(
          "motion-drawer fixed inset-x-0 top-16 z-40 max-h-[calc(100dvh-4rem)] overflow-y-auto rounded-b-lg border-b border-line bg-paper-raised shadow-lg",
          breakpoint,
        )}
      >
        <div className="flex items-center justify-between border-b border-line/70 px-4 py-1.5">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-3">
            {panelLabel}
          </span>
          <button
            type="button"
            onClick={close}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-ink-2 hover:text-ink"
          >
            Close
            <span aria-hidden="true" className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>

        {children}
      </div>
    </details>
  );
}
