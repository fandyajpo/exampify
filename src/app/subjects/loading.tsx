/**
 * Route-level loading state for the directory. It mirrors the reading pages' geometry (a title line, a lead
 * line, then list rows) so the transition does not shift layout.
 */
export default function Loading(): React.JSX.Element {
  return (
    <div aria-busy="true" aria-live="polite" className="shell-narrow py-16">
      <span className="sr-only">Loading</span>
      <div className="h-3 w-24 animate-pulse rounded-xs bg-paper-sunk" />
      <div className="mt-6 h-9 w-3/4 animate-pulse rounded-sm bg-paper-sunk" />
      <div className="mt-4 h-5 w-full max-w-[52ch] animate-pulse rounded-xs bg-paper-sunk" />
      <div className="mt-12 space-y-4">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="h-14 w-full animate-pulse rounded-sm bg-paper-sunk" />
        ))}
      </div>
    </div>
  );
}
