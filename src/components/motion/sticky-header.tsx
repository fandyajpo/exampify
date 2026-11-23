"use client";

/**
 * Sticky header shell (DESIGN_SYSTEM.md §9.7): the shadow appears only after 8 px of scroll.
 * A client leaf by necessity — the nav itself is still server-rendered children.
 */
import { useMotionValueEvent, useScroll } from "motion/react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StickyHeader({ children }: { children: ReactNode }): React.JSX.Element {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (value) => {
    setIsScrolled(value > 8);
  });

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-line-strong bg-paper transition-shadow duration-[180ms] ease-[cubic-bezier(0.2,0.6,0.2,1)]",
        isScrolled && "shadow-sm",
      )}
    >
      {children}
    </header>
  );
}
