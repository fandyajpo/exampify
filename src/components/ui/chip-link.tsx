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
        "press inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-paper-raised px-4 text-sm font-medium text-ink-2 shadow-sm hover:border-line-strong hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}
