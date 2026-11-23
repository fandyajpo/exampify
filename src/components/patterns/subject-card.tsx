/**
 * SubjectCard (DESIGN_SYSTEM.md §9.4), refined: a 4 px identity rule instead of an 8 px
 * band, hairline edge, neutral elevation, and type at semibold rather than heavy.
 *
 * The whole card is one link, so the accessible name is the subject. Subject identity is
 * applied through `--subject-ink` / `--subject-fill` on the wrapper (§3.3); the theme maps
 * those to `bg-subject-ink` / `bg-subject-fill`, so no per-subject CSS exists anywhere.
 */
import Link from "next/link";
import type { CSSProperties } from "react";
import { IconArrowRight, SubjectIcon } from "@/components/ui/icons";
import type { SubjectColor } from "@/lib/subject-colors";
import { cn } from "@/lib/utils";

type SubjectCardProps = {
  href: string;
  name: string;
  level: string;
  group: string;
  color: SubjectColor;
  iconKey: string;
  className?: string;
};

export function SubjectCard({
  href,
  name,
  level,
  group,
  color,
  iconKey,
  className,
}: SubjectCardProps): React.JSX.Element {
  return (
    <Link
      href={href}
      // Dynamic design tokens are the documented exception to the no-inline-style rule
      // (TECHNICAL_STANDARDS.md §13, DESIGN_SYSTEM.md §8).
      style={
        {
          "--subject-ink": `var(--subject-${color})`,
          "--subject-fill": `var(--subject-${color}-fill)`,
        } as CSSProperties
      }
      className={cn(
        "lift group flex h-full flex-col overflow-hidden rounded-md border border-line bg-paper-raised shadow-sm hover:border-line-strong hover:shadow-md",
        className,
      )}
    >
      <span aria-hidden="true" className="h-1 w-full bg-subject-ink" />
      <div className="flex flex-1 flex-col gap-5 p-6">
        <span className="inline-flex size-10 items-center justify-center rounded-sm bg-subject-fill text-subject-ink">
          <SubjectIcon iconKey={iconKey} className="size-5" />
        </span>
        <div>
          <p className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">{name}</p>
          <p className="mt-1 text-sm text-ink-3">
            {group} · {level}
          </p>
        </div>
        <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 transition-colors group-hover:text-cobalt">
          Browse chapters
          <IconArrowRight className="size-4" />
        </span>
      </div>
    </Link>
  );
}
