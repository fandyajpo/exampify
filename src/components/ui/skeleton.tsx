/**
 * `Skeleton` (`DESIGN_SYSTEM.md` §9.8): paper-sunk blocks that match the final layout's
 * footprint exactly, so a load causes no shift. It is decorative, so it is hidden from
 * assistive technology; the region that owns it announces loading in text.
 */
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-sm bg-paper-sunk", className)}
    />
  );
}
