import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Auth shell (`INFORMATION_ARCHITECTURE.md` §4.2): noindex, focused, one column. The site
 * navigation is deliberately replaced by a single way back, so a half-finished sign-up
 * cannot be abandoned by a stray nav click mid-form.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-col bg-paper">
      <header className="border-b border-line">
        <div className="shell flex h-16 items-center justify-between">
          <Link
            href="/"
            className="font-display text-lg font-semibold tracking-tight text-ink"
            aria-label="Exampify home"
          >
            Exampify<span className="text-cobalt">.</span>
          </Link>
          <Link
            href="/subjects"
            className="hidden text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline sm:inline"
          >
            Keep browsing without an account
          </Link>
        </div>
      </header>

      <main
        id="main"
        className="flex flex-1 justify-center px-[var(--gutter)] py-10 md:py-20"
      >
        <div className="w-full max-w-[440px]">{children}</div>
      </main>
    </div>
  );
}
