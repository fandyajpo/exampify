"use client";

/**
 * Sticky header shell (DESIGN_SYSTEM.md §5.4, §9.7): the bar is a translucent material with
 * content scrolling beneath it, and the hairline plus shadow only appear once content is
 * actually underneath — a scroll edge effect, not a permanent divider at the top of a page.
 */
import { useMotionValueEvent, useScroll } from "motion/react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StickyHeader({ children }: { children: ReactNode }): React.JSX.Element {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (value) => {
    setIsScrolled(value > 4);
  });

  return (
    <header
      className={cn(
        "material sticky top-0 z-40 border-b transition-[border-color,box-shadow] duration-300 ease-soft",
        isScrolled ? "border-line shadow-sm" : "border-transparent shadow-none",
      )}
    >
      {children}
    </header>
  );
}
