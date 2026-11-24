"use client";

/**
 * Public mobile navigation (UI revamp §3.1): the shared `MobileSheet` below `md`, carrying the
 * same list the desktop bar renders.
 *
 * The sheet's sign-in CTA is hidden from `sm` up, because the header's own button is visible
 * there — one sign-in affordance on a screen, not two.
 */
import Link from "next/link";

import { SITE_NAV_LINKS } from "@/components/site-nav-links";
import { MobileSheet } from "@/components/ui/mobile-sheet";
import { NavLink } from "@/components/ui/nav-link";

export function SiteMobileMenu(): React.JSX.Element {
  return (
    <MobileSheet panelLabel="Menu" triggerLabel="Menu" hiddenFrom="md">
      <nav aria-label="Mobile" className="px-4 pt-3 pb-5">
        <ul className="space-y-0.5">
          {SITE_NAV_LINKS.map((link) => (
            <li key={link.href}>
              <NavLink
                href={link.href}
                label={link.label}
                className="flex min-h-12 items-center gap-3 rounded-sm px-3 text-base font-medium text-ink-2 transition-colors hover:bg-paper-sunk hover:text-ink"
                activeClassName="bg-paper-sunk text-ink"
              />
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t border-line pt-4 sm:hidden">
          <Link
            href="/sign-in"
            className="flex min-h-12 items-center justify-center rounded-sm bg-cobalt px-4 text-base font-medium text-white"
          >
            Sign in
          </Link>
        </div>
      </nav>
    </MobileSheet>
  );
}
