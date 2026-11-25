"use client";

/**
 * Hero entrance reveal (DESIGN_SYSTEM.md §7): a short fade and rise driven by a
 * critically damped spring, so it settles without overshoot and can be interrupted at any
 * frame. §11 forbids entrance animation on every section, so this is used for the hero only.
 *
 * The H1 is deliberately outside this wrapper: it paints immediately, so the animation
 * cannot delay the LCP text. Reduced motion keeps the same initial markup (so hydration
 * matches) and drops the duration to 0, which lands on the final state instead.
 */
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
};

export function Reveal({ children, delay = 0, className }: RevealProps): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { type: "spring", bounce: 0, duration: 0.6, delay }
      }
    >
      {children}
    </motion.div>
  );
}
