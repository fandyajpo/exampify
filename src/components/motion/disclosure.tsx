"use client";

/**
 * Disclosure (`DESIGN_SYSTEM.md` §7): a spring-driven height and opacity reveal, so the
 * panel can be reversed mid-flight instead of waiting for a fixed-duration tween.
 *
 * A real button with `aria-expanded`/`aria-controls`, not a `<details>`, because a native
 * disclosure cannot animate its panel. The trigger swaps `+`/`−` rather than rotating, so a
 * reduced-motion reader still sees the state change as text (DS-05). Only used for short
 * panels, never inside a long list.
 */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Disclosure({
  label,
  children,
  className,
  defaultOpen = false,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const shouldReduceMotion = useReducedMotion();
  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, bounce: 0, duration: 0.4 };

  return (
    <div className={cn("rounded-lg border border-line bg-paper-raised", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-5 py-4 text-left font-medium text-ink transition-colors duration-200 hover:bg-paper"
      >
        {label}
        <span aria-hidden="true" className="text-lg leading-none text-ink-3">
          {open ? "−" : "+"}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="panel"
            id={panelId}
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition}
          >
            <div className="border-t border-line px-5 py-5">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
