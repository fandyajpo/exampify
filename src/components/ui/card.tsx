/**
 * Card (`DESIGN_SYSTEM.md` §9.4): a white raised surface with a generous continuous radius
 * and diffuse neutral depth, resting on the neutral canvas. Cards never nest — use a
 * `paper-sunk` inset instead.
 */
import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const CARD =
  "rounded-lg border border-line bg-paper-raised p-6 shadow-sm transition-[box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,0.75,0.28,1)]";

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
