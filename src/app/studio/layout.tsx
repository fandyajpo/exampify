/**
 * Studio shell (`INFORMATION_ARCHITECTURE.md` §4.3, DESIGN_SYSTEM.md §9.7): staff only and
 * `noindex`.
 *
 * Adaptive layout: a persistent 264 px grouped sidebar from `lg`, and a sticky top bar with a
 * sheet menu below it. Between those two the content column reflows on its own — the shell
 * never shrinks the sidebar into an unreadable strip, and no nav item overlaps the wordmark.
 *
 * The guard runs here, once, for every studio screen: no session redirects to sign-in with
 * `/studio` as the return path, and a signed-in account without `content:read:studio` gets a
 * `404` — the studio's existence is not confirmed to a student (`SEC §3.1`).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { StudioMobileMenu } from "@/components/studio/studio-mobile-menu";
import { StudioNav } from "@/components/studio/studio-nav";
import { getActor } from "@/lib/auth/actor";
import { withNext } from "@/lib/auth/next";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Studio", template: "%s | Exampify Studio" },
  robots: { index: false, follow: false },
};

function Wordmark(): React.JSX.Element {
  return (
    <Link href="/studio" className="font-display text-lg font-semibold tracking-tight text-ink">
      Exampify<span className="text-cobalt">.</span>{" "}
      <span className="font-sans text-sm font-medium tracking-normal text-ink-3">Studio</span>
    </Link>
  );
}

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const actor = await getActor();
  if (!actor) redirect(withNext("/sign-in", "/studio"));
  if (!can(actor, "content:read:studio")) notFound();

  return (
    <div className="min-h-screen bg-paper-sunk">
      <a
        href="#main"
        className="sr-only rounded-sm bg-paper-raised px-4 py-3 font-medium shadow-md focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

      <div className="lg:grid lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]">
        <aside className="hidden border-r border-line bg-paper lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div className="flex h-[72px] shrink-0 items-center border-b border-line px-5">
            <Wordmark />
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-5">
            <StudioNav />
          </div>

          <div className="shrink-0 border-t border-line px-5 py-4 text-sm">
            <p className="font-medium capitalize text-ink">{actor.role}</p>
            <Link
              href="/"
              className="mt-1 inline-flex min-h-9 items-center text-ink-3 underline-offset-4 hover:text-ink hover:underline"
            >
              View site →
            </Link>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-40 border-b border-line bg-paper lg:hidden">
            <div className="flex h-16 items-center gap-3 px-[var(--gutter)]">
              <Wordmark />

              <div className="ml-auto flex items-center gap-2">
                <Link
                  href="/"
                  className="hidden min-h-11 items-center text-sm text-ink-2 sm:inline-flex"
                >
                  View site
                </Link>
                <StudioMobileMenu role={actor.role} />
              </div>
            </div>
          </header>

          <main
            id="main"
            className="mx-auto w-full max-w-[var(--studio-max)] flex-1 px-[var(--gutter)] py-8 md:py-10"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
