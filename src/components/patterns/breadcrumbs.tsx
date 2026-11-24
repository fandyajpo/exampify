import Link from "next/link";

import { cn } from "@/lib/utils";
import type { Crumb } from "@/lib/seo/breadcrumbs";

/**
 * Visible breadcrumb (`INFORMATION_ARCHITECTURE.md` §6): `<nav aria-label="Breadcrumb">`
 * around an ordered list, last item plain text with `aria-current="page"`.
 *
 * It renders exactly the trail that `breadcrumbList()` turns into JSON-LD, so the two always
 * agree. Wrapping on narrow screens is preferred to the documented truncation rule until a
 * mobile-specific collapse lands.
 *
 * The separator lives inside the crumb that follows it, so a line break can never leave a
 * `/` dangling at the end of a row on a phone.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }): React.JSX.Element {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-ink-3">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((crumb, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={crumb.path}
              aria-current={isLast ? "page" : undefined}
              className={cn("flex items-center gap-2", isLast && "text-ink-2")}
            >
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {isLast ? (
                crumb.name
              ) : (
                <Link
                  href={crumb.path}
                  className="transition-colors hover:text-ink"
                >
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
