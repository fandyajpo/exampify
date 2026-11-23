/**
 * Badge / FormatBadge (`DESIGN_SYSTEM.md` §9.3).
 *
 * `Badge` describes state, difficulty or subject identity. `FormatBadge` is the one
 * component allowed to describe content shape, and each of its three variants carries a
 * distinct icon *and* label, so the meaning never depends on colour.
 */
import type { ReactNode } from "react";

import { IconBookOpen, IconLayers, IconTimer } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type BadgeTone =
  | "neutral"
  | "draft"
  | "review"
  | "published"
  | "archived"
  | "easy"
  | "medium"
  | "hard"
  | "very-hard"
  | "subject";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-line-strong bg-paper-raised text-ink-2",
  draft: "border-line-strong bg-paper-sunk text-ink-2",
  review: "border-sunbeam/60 bg-sunbeam/25 text-ink",
  published: "border-leaf/30 bg-mint/35 text-leaf",
  archived: "border-line-soft bg-paper-sunk text-ink-3",
  easy: "border-leaf/30 bg-mint/30 text-leaf",
  medium: "border-sunbeam/50 bg-sunbeam/25 text-ink-2",
  hard: "border-coral/30 bg-blush/30 text-coral-ink",
  "very-hard": "border-coral/50 bg-blush/45 text-coral-ink",
  subject: "border-transparent bg-subject-fill text-subject-ink",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-xs border px-2 py-0.5 text-xs font-medium uppercase tracking-[0.04em]",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

type Format = "study" | "lesson" | "test";

const FORMATS: Record<Format, { label: string; className: string; Icon: typeof IconBookOpen }> = {
  study: {
    label: "Study material",
    className: "border-line-strong bg-paper-raised text-ink-2",
    Icon: IconBookOpen,
  },
  lesson: {
    label: "Lesson + practice",
    className: "border-ink/30 bg-sunbeam/35 text-ink",
    Icon: IconLayers,
  },
  test: {
    label: "Practice test",
    className: "border-cobalt/25 bg-cobalt/10 text-cobalt",
    Icon: IconTimer,
  },
};

export function FormatBadge({
  format,
  className,
}: {
  format: Format;
  className?: string;
}): React.JSX.Element {
  const { label, className: tone, Icon } = FORMATS[format];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xs border px-2 py-0.5 text-xs font-medium",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}
