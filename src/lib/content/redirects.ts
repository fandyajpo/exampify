/**
 * Redirect resolution, kept pure so the matcher can be tested without a database
 * (`INFORMATION_ARCHITECTURE.md` §5.4, `SEO_AND_CONTENT_STRATEGY.md` §6).
 *
 * A row's `source_path` is either one exact path or the first segment of a subtree: renaming a
 * subject moves every chapter, topic and resource beneath it, and one row at the subject's own
 * path covers them all through the prefix rule.
 */

export type RedirectRow = { source_path: string; target_path: string };

/**
 * One hop: an exact match wins, otherwise the longest path prefix is used and the remainder
 * of the request is kept, so `/old/topic/learn/x` under a renamed subject lands on
 * `/new/topic/learn/x` rather than the subject page.
 */
function matchOnce(rows: readonly RedirectRow[], path: string): string | null {
  const exact = rows.find((row) => row.source_path === path);
  if (exact) return exact.target_path;

  let best: RedirectRow | null = null;
  for (const row of rows) {
    if (!path.startsWith(`${row.source_path}/`)) continue;
    if (!best || row.source_path.length > best.source_path.length) best = row;
  }

  return best ? `${best.target_path}${path.slice(best.source_path.length)}` : null;
}

/**
 * The target a missing path should go to, followed to a fixed point.
 *
 * Prefix rows compose: renaming a subject and then a chapter under it leaves the chapter's
 * target under the old subject prefix, which still matches the subject row. Following the
 * result means the browser makes one hop, not two (`INFORMATION_ARCHITECTURE.md` §5.3).
 */
export function matchRedirect(rows: readonly RedirectRow[], path: string): string | null {
  let current = path;
  let matched = false;

  for (let hops = 0; hops < 8; hops += 1) {
    const next = matchOnce(rows, current);
    if (!next || next === current) break;
    current = next;
    matched = true;
  }

  return matched ? current : null;
}

/**
 * The final target for a new `sourcePath → targetPath` row, or `null` when the move cannot be
 * recorded. Chains are collapsed here: when the target is itself redirected the row points at
 * that row's target, and a move that would loop back to the source is refused.
 */
export function collapseTarget(
  rows: readonly RedirectRow[],
  sourcePath: string,
  targetPath: string,
): string | null {
  let target = targetPath;

  for (let hops = 0; hops < 8; hops += 1) {
    if (target === sourcePath) return null;
    const next = rows.find((row) => row.source_path === target);
    if (!next) return target;
    target = next.target_path;
  }

  // Eight hops means the table already disagrees with its own "one hop" rule; refuse to add
  // to it rather than write a row nobody can follow.
  return null;
}
