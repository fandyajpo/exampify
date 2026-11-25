/**
 * Text inputs and `FormField` (`DESIGN_SYSTEM.md` §9.6).
 *
 * Controls are filled rather than outlined: a quiet `paper-sunk` well that becomes a white
 * raised surface on focus, which is where the interaction is. Labels are always visible —
 * never placeholder-only — and the error slot is linked with `aria-describedby` and
 * announced politely. `FormField` is a render prop so the ids and ARIA wiring cannot be
 * forgotten at the call site.
 */
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

const CONTROL =
  "w-full rounded-md border border-transparent bg-paper-sunk px-4 text-base text-ink placeholder:text-ink-3 transition-[background-color,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.22,0.75,0.28,1)] hover:bg-line-soft focus:bg-paper-raised focus:shadow-sm disabled:bg-paper-sunk disabled:text-ink-3 aria-[invalid=true]:border-coral";

export function Input({ className, ...props }: ComponentProps<"input">): React.JSX.Element {
  return <input className={cn(CONTROL, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">): React.JSX.Element {
  return <textarea className={cn(CONTROL, "min-h-28 py-3", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">): React.JSX.Element {
  return <select className={cn(CONTROL, "h-11 pr-8", className)} {...props} />;
}

type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

export function FormField({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: (control: FieldControlProps) => ReactNode;
}): React.JSX.Element {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control: FieldControlProps = {
    id,
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(error ? { "aria-invalid": true as const } : {}),
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required ? (
          <span className="ml-1 text-coral-ink" aria-hidden="true">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-sm text-ink-3">
          {hint}
        </p>
      ) : null}
      {children(control)}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-coral-ink" aria-live="polite">
          {error}
        </p>
      ) : null}
    </div>
  );
}
