"use client";

/**
 * Route transition (`DESIGN_SYSTEM.md` §7).
 *
 * The wrapper is keyed on the pathname, so a client navigation remounts it and springs the
 * new page in from a short rise. The first paint is deliberately excluded: §7 forbids a
 * page-load animation beyond the hero, and an initial `opacity: 0` would delay LCP text.
 * `settled` only flips after the first commit, and both server and client start at `false`,
 * so hydration matches.
 *
 * Only `opacity` and `transform` animate — no reflow. Reduced motion drops the duration to
 * 0 and lands immediately on the final state.
 */
import { motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

/**
 * Whether this document has finished its first page load. A module flag rather than state:
 * the flip needs no re-render, and the first page must never animate (§7). It is also what
 * keeps server and client markup identical — the server never runs the effect, so it always
 * renders the unanimated branch.
 */
let hasLoaded = false;

export function PageTransition({ children }: { children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const animateIn = hasLoaded;

  useEffect(() => {
    hasLoaded = true;
  }, []);

  return (
    <motion.div
      key={pathname}
      className="flex flex-1 flex-col"
      initial={animateIn ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.45 }
      }
    >
      {children}
    </motion.div>
  );
}
