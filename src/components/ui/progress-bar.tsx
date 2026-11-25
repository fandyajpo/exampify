/**
 * `ProgressBar` (`DESIGN_SYSTEM.md` §9.8): a thin sunk track with a rounded fill in the
 * subject colour, and the numeric value exposed through `role="progressbar"`. The visible
 * label lives outside; this component needs one for assistive technology, so `label` is
 * required.
 */
import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  label,
  max = 100,
  className,
}: {
  value: number;
  label: string;
  max?: number;
  className?: string;
}): React.JSX.Element {
  const clamped = Math.min(Math.max(value, 0), max);
  const percent = max > 0 ? (clamped / max) * 100 : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-line-soft", className)}
    >
      <div
        className="h-full rounded-full bg-subject-ink transition-[width] duration-[320ms] ease-[cubic-bezier(0.22,0.75,0.28,1)]"
        // The only dynamic value here is the measured percentage; the colour is a token.
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
