import Link from "next/link";
import { Fragment } from "react";

import type { Crumb } from "@/lib/seo/breadcrumbs";

/**
 * Visible breadcrumb (`INFORMATION_ARCHITECTURE.md` §6): `<nav aria-label="Breadcrumb">`
 * around an ordered list, last item plain text with `aria-current="page"`.
 *
 * It renders exactly the trail that `breadcrumbList()` turns into JSON-LD, so the two always
 * agree. Wrapping on narrow screens is preferred to the documented truncation rule until a
 * mobile-specific collapse lands.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }): React.JSX.Element {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-ink-3">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((crumb, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={crumb.path}>
              {index > 0 ? <li aria-hidden="true">/</li> : null}
              <li
                aria-current={isLast ? "page" : undefined}
                className={isLast ? "text-ink-2" : undefined}
              >
                {isLast ? (
                  crumb.name
                ) : (
                  <Link href={crumb.path} className="transition-colors hover:text-ink">
                    {crumb.name}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
