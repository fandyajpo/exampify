"use client";

/**
 * Route-level error boundary. It never renders the thrown message: details belong in the
 * server log and Sentry, not in a page a visitor can read.
 */

import { Button, ButtonLink } from "@/components/ui/button";

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  return (
    <main id="main" className="flex-1">
      <div className="shell-narrow py-24 md:py-32">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">Something broke</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.03em]">
          This page could not load
        </h1>
        <p className="mt-4 max-w-[56ch] text-lg text-ink-2">
          The problem is on our side. Trying again usually works; if it does not, the subject
          directory is still available.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => reset()}>Try again</Button>
          <ButtonLink href="/subjects" variant="secondary">
            Browse subjects
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
