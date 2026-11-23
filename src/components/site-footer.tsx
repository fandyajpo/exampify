/**
 * Site footer. Link columns collapse from four to two (UI_UX_GUIDELINES.md §9); no legal
 * pages are linked because none of those routes exist yet.
 */
import Link from "next/link";

const COLUMNS = [
  {
    title: "Curriculum",
    links: [
      { href: "/cambridge-international", label: "Cambridge International" },
      { href: "/cambridge-international/igcse", label: "IGCSE" },
      { href: "/cambridge-international/as-and-a-level", label: "AS & A Level" },
    ],
  },
  {
    title: "Study",
    links: [
      { href: "/subjects", label: "Subjects" },
      { href: "/search", label: "Search" },
      { href: "/practice", label: "Practice" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/sign-in", label: "Sign in" },
      { href: "/sign-up", label: "Create account" },
    ],
  },
] as const;

export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="border-t border-line-strong bg-paper">
      <div className="mx-auto w-full max-w-[1240px] px-4 py-12 md:px-6 md:py-16 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:pr-10">
            <p className="font-display text-base font-semibold tracking-tight">
              Exampify<span className="text-cobalt">.</span>
            </p>
            <p className="mt-2 max-w-[32ch] text-sm text-ink-2">
              Syllabus-shaped study material, lessons and practice for exam candidates.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-labelledby={`footer-${column.title.toLowerCase()}`}>
              <h2
                id={`footer-${column.title.toLowerCase()}`}
                className="text-xs font-medium uppercase tracking-[0.12em] text-ink-3"
              >
                {column.title}
              </h2>
              <ul className="mt-3 space-y-0.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-10 items-center text-sm text-ink-2 transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="mt-10 border-t border-line pt-6 text-sm text-ink-3">
          © 2026 Exampify. All content is written for exam preparation.
        </p>
      </div>
    </footer>
  );
}
