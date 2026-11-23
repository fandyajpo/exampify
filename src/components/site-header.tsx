/**
 * Site header (DESIGN_SYSTEM.md §9.7, UI_UX_GUIDELINES.md §9).
 *
 * Mobile is logo + search + a `<details>` menu, so the chrome stays a server component and
 * the menu still works with the keyboard and without JavaScript. Only the sticky shell is
 * client-side, because the scroll shadow is a state change.
 */
import Link from "next/link";
import { StickyHeader } from "@/components/motion/sticky-header";
import { ButtonLink } from "@/components/ui/button";
import { IconMenu, IconSearch } from "@/components/ui/icons";

const NAV_LINKS = [
  { href: "/subjects", label: "Subjects" },
  { href: "/search", label: "Search" },
] as const;

export function SiteHeader(): React.JSX.Element {
  return (
    <StickyHeader>
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-3 px-4 md:h-[72px] md:gap-10 md:px-6 lg:px-8">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight text-ink"
          aria-label="Exampify home"
        >
          Exampify<span className="text-cobalt">.</span>
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex h-11 items-center rounded-sm px-3 text-sm font-medium text-ink-2 transition-colors hover:text-ink"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/search"
            aria-label="Search"
            className="inline-flex size-11 items-center justify-center rounded-sm border border-line-strong text-ink-2 transition-colors hover:border-ink/40 hover:text-ink md:hidden"
          >
            <IconSearch className="size-5" />
          </Link>

          <ButtonLink href="/sign-in" variant="secondary" size="sm" className="hidden sm:inline-flex">
            Sign in
          </ButtonLink>

          <details className="group relative md:hidden">
            <summary
              className="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-sm border border-line-strong text-ink-2 transition-colors hover:border-ink/40 hover:text-ink [&::-webkit-details-marker]:hidden"
              aria-label="Menu"
            >
              <IconMenu className="size-5" />
            </summary>
            {/* CSS-only entrance: `<details>` needs no JavaScript, so the menu still works
                before hydration and with scripting off (`DESIGN_SYSTEM.md` §7). */}
            <ul className="motion-menu-panel absolute top-full right-0 mt-2 w-56 rounded-md border border-line bg-paper-raised p-2 shadow-md">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex min-h-11 items-center rounded-sm px-3 text-base font-medium text-ink transition-colors hover:bg-paper-sunk"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/sign-in"
                  className="flex min-h-11 items-center rounded-sm px-3 text-base font-medium text-ink transition-colors hover:bg-paper-sunk"
                >
                  Sign in
                </Link>
              </li>
            </ul>
          </details>
        </div>
      </div>
    </StickyHeader>
  );
}
