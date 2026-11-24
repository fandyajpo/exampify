"use client";

/**
 * Studio sidebar navigation (DESIGN_SYSTEM.md §9.7): grouped links, 264 px, active item marked
 * by an ink rule and a paper-sunk fill plus `aria-current="page"`.
 *
 * It is client-side only for the active state; the groups are the screen's map, not a second
 * toolbar, so a section never appears twice.
 */
import { NavLink } from "@/components/ui/nav-link";
import { cn } from "@/lib/utils";

const GROUPS = [
  {
    label: "Content",
    links: [
      { href: "/studio", label: "Overview" },
      { href: "/studio/subjects", label: "Subjects" },
      { href: "/studio/questions", label: "Questions" },
      { href: "/studio/assessments", label: "Assessments" },
    ],
  },
  {
    label: "Library",
    links: [{ href: "/studio/media", label: "Media" }],
  },
  {
    label: "Governance",
    links: [{ href: "/studio/audit", label: "Audit log" }],
  },
] as const;

export function StudioNav({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "panel";
}): React.JSX.Element {
  return (
    <nav aria-label="Studio" className="flex flex-col gap-6">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-3 text-xs font-medium uppercase tracking-[0.12em] text-ink-3">
            {group.label}
          </p>
          <ul className="mt-2 space-y-0.5">
            {group.links.map((link) => (
              <li key={link.href}>
                <NavLink
                  href={link.href}
                  label={link.label}
                  exact={link.href === "/studio"}
                  className={cn(
                    "flex min-h-11 items-center rounded-sm px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-paper-sunk hover:text-ink",
                    variant === "panel" && "min-h-12 text-base",
                  )}
                  /* Inset rule rather than a border: the row keeps its radius and the
                     selected section reads as a filed tab, not a bracket. */
                  activeClassName="bg-paper-sunk font-semibold text-ink [box-shadow:inset_3px_0_0_var(--ink)]"
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
