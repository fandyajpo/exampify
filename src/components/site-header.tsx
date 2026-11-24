/**
 * Site header (DESIGN_SYSTEM.md §9.7, UI_UX_GUIDELINES.md §9).
 *
 * Adaptive by container: the full bar from `md`, and a logo + search + menu sheet below it, so
 * no link ever competes with the wordmark for width. Mobile navigation is a full-width sheet
 * (`SiteMobileMenu`) instead of a 224 px dropdown; only the sheet is client-side, because it
 * needs route-change dismissal. The bar itself stays a server component.
 */
import Link from "next/link";
import { StickyHeader } from "@/components/motion/sticky-header";
import { SiteMobileMenu } from "@/components/site-mobile-menu";
import { SITE_NAV_LINKS } from "@/components/site-nav-links";
import { ButtonLink } from "@/components/ui/button";
import { IconSearch } from "@/components/ui/icons";
import { NavLink } from "@/components/ui/nav-link";

export function SiteHeader(): React.JSX.Element {
  return (
    <StickyHeader>
      {/* One skip link for every public page, placed before the bar so it is the first tab
          stop. The studio shell carries its own. */}
      <a
        href="#main"
        className="sr-only rounded-sm bg-paper-raised px-4 py-3 font-medium shadow-md focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

      <div className="shell flex h-16 items-center gap-3 md:h-[72px] md:gap-8">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight text-ink"
          aria-label="Exampify home"
        >
          Exampify<span className="text-cobalt">.</span>
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {SITE_NAV_LINKS.map((link) => (
              <li key={link.href}>
                <NavLink
                  href={link.href}
                  label={link.label}
                  className="inline-flex h-11 items-center rounded-sm px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-paper-sunk hover:text-ink"
                  activeClassName="bg-paper-sunk text-ink"
                />
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

          <SiteMobileMenu />
        </div>
      </div>
    </StickyHeader>
  );
}
