/**
 * Card (`DESIGN_SYSTEM.md` §9.4): paper-raised surface, hairline edge, soft elevation,
 * 24 px padding. Cards never nest — use a paper-sunk inset instead.
 */
import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const CARD =
  "rounded-md border border-line bg-paper-raised p-6 shadow-sm transition-[box-shadow,border-color] duration-[180ms] ease-[cubic-bezier(0.2,0.6,0.2,1)]";

// The press belongs to the interactive card only: a static surface must not lift.
const CARD_LINK = "lift block hover:border-line-strong hover:shadow-md";

export function Card({ className, ...props }: ComponentProps<"div">): React.JSX.Element {
  return <div className={cn(CARD, className)} {...props} />;
}

export function CardLink({ className, ...props }: ComponentProps<typeof Link>): React.JSX.Element {
  return (
    <Link
      className={cn(CARD, CARD_LINK, className)}
      {...props}
    />
  );
}
