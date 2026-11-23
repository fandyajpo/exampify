/**
 * Callout (`DESIGN_SYSTEM.md` §9.5): five semantic kinds, each with a label and a 4 px
 * left rule. The label is a `<p>`, not a heading — callouts are not sections
 * (`SEO_AND_CONTENT_STRATEGY.md` §3.3).
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type CalloutTone = "tip" | "warning" | "example" | "examtip" | "definition";

const TONES: Record<CalloutTone, { label: string; box: string; accent: string }> = {
  tip: { label: "Tip", box: "border-l-sunbeam bg-paper-raised", accent: "text-ink-2" },
  warning: {
    label: "Watch out",
    box: "border-l-coral bg-blush/20",
    accent: "text-coral-ink",
  },
  example: {
    label: "Worked example",
    box: "border-l-cobalt bg-paper-accent",
    accent: "text-cobalt",
  },
  examtip: { label: "Exam tip", box: "border-l-cobalt bg-cobalt/5", accent: "text-cobalt" },
  definition: { label: "Definition", box: "border-l-lilac bg-mint/20", accent: "text-ink-2" },
};

export function Callout({
  tone,
  children,
  className,
}: {
  tone: CalloutTone;
  children: ReactNode;
  className?: string;
}): React.JSX.Element {
  const { label, box, accent } = TONES[tone];

  return (
    <aside className={cn("max-w-[68ch] rounded-sm border-l-4 px-5 py-4", box, className)}>
      <p className={cn("text-xs font-medium uppercase tracking-[0.12em]", accent)}>{label}</p>
      <div className="mt-2 text-ink-2">{children}</div>
    </aside>
  );
}
