"use client";

/**
 * Hero entrance reveal (DESIGN_SYSTEM.md §7): a 240 ms fade plus a 12 px rise on the
 * documented easing, and nothing else on load. §11 forbids entrance animation on every
 * section, so this is used for the hero only.
 *
 * The H1 is deliberately outside this wrapper: it paints immediately, so the animation
 * cannot delay the LCP text. Reduced motion keeps the same initial markup (so hydration
 * matches) and drops the duration to 0, which lands on the final state instead.
 */
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const EASE: [number, number, number, number] = [0.2, 0.6, 0.2, 1];

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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.24,
        delay: shouldReduceMotion ? 0 : delay,
        ease: EASE,
      }}
    >
      {children}
    </motion.div>
  );
}
