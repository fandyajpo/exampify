/**
 * `EmptyState` (`DESIGN_SYSTEM.md` §9.8): heading, one sentence, one primary action and an
 * optional secondary link. It is a region, not an error: nothing here apologises.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  secondary,
  icon,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  secondary?: ReactNode;
  icon?: ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <section
      className={cn(
        "rounded-md border border-dashed border-line-strong bg-paper-raised px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-paper-sunk text-ink-3">
          {icon}
        </div>
      ) : null}
      <h2 className="font-display text-xl font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-[46ch] text-ink-2">{description}</p>
      {action || secondary ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          {action}
          {secondary}
        </div>
      ) : null}
    </section>
  );
}
