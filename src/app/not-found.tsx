import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found — Exampify",
  robots: { index: false, follow: true },
};

export default function NotFound(): React.JSX.Element {
  return (
    <>
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto w-full max-w-[820px] px-4 py-20 md:px-6 md:py-28">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">404</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
            That page is not here
          </h1>
          <p className="mt-4 max-w-[56ch] text-lg text-ink-2">
            The page may have moved, or it may not be published yet. The subject directory is the
            quickest way back to something you can read.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/subjects" size="md">
              Browse subjects
            </ButtonLink>
            <ButtonLink href="/" variant="secondary" size="md">
              Go to the homepage
            </ButtonLink>
          </div>

          <p className="mt-10 text-sm text-ink-3">
            Looking for something specific?{" "}
            <Link href="/search" className="text-ink-2 underline-offset-4 hover:underline">
              Search the catalogue
            </Link>
            .
          </p>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
