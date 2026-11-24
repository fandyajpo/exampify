"use client";

/**
 * Navigation link with an active state (`DESIGN_SYSTEM.md` §9.7).
 *
 * Active state is the one thing a server component cannot know without reading the request
 * path, so this is a leaf client component and nothing else in the header moves into the
 * client bundle. `aria-current="page"` carries the same meaning to a screen reader that the
 * background carries visually, and the section prefix covers nested routes
 * (`/studio/questions/{id}` keeps Questions active).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function NavLink({
  href,
  label,
  exact = false,
  className,
  activeClassName,
}: {
  href: string;
  label: string;
  /** Match only the exact path — required for a section root such as `/studio`. */
  exact?: boolean;
  className?: string;
  activeClassName?: string;
}): React.JSX.Element {
  const pathname = usePathname();
  const active =
    pathname === href || (!exact && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      {...(active ? { "aria-current": "page" as const } : {})}
      className={cn(className, active && activeClassName)}
    >
      {label}
    </Link>
  );
}
