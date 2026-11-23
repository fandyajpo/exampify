/**
 * Chip links are the homepage pickers (UI_UX_GUIDELINES.md §3.1) — pills that navigate
 * rather than select, so they are links with a 44 px target, not toggle buttons.
 */
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function ChipLink({ className, ...props }: ComponentProps<typeof Link>): React.JSX.Element {
  return (
    <Link
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-paper-raised px-4 text-sm font-medium text-ink-2 transition-colors duration-[120ms] ease-[cubic-bezier(0.2,0.6,0.2,1)] hover:border-ink/40 hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}
