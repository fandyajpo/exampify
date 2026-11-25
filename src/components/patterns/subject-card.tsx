/**
 * SubjectCard (DESIGN_SYSTEM.md §9.4): a white card with the subject identity carried by a
 * tinted icon tile and its label, not by a coloured band across the top edge.
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
        "subject-card lift group h-full rounded-lg border border-line bg-paper-raised shadow-sm hover:border-line-strong hover:shadow-md",
        className,
      )}
    >
      <span className="inline-flex size-11 items-center justify-center rounded-md bg-subject-fill text-subject-ink">
        <SubjectIcon iconKey={iconKey} className="size-5" />
      </span>
      <div className="subject-card-body">
        <div>
          {/* Long names clamp to two lines (DS-03); the full name stays in the link title. */}
          <p
            className="subject-card-title line-clamp-2 font-semibold text-ink"
            title={name}
          >
            {name}
          </p>
          <p className="mt-1 text-sm text-ink-3">
            {group} · {level}
          </p>
        </div>
        <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-cobalt">
          Browse chapters
          <IconArrowRight className="size-4 transition-transform duration-300 ease-[cubic-bezier(0.22,0.75,0.28,1)] group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
