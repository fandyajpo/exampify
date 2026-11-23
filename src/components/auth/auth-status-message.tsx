import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A page-level auth message. `error` is announced (`role="alert"`), `success` is polite
 * (`role="status"`): a failure needs attention, a confirmation does not interrupt
 * (`UI_UX_GUIDELINES.md` §293 — field errors stay at the field, page errors become a
 * banner).
 */
export function AuthStatusMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}): React.JSX.Element {
  const isError = tone === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "rounded-sm border px-4 py-3 text-sm",
        isError ? "border-coral bg-paper" : "border-line-strong bg-paper",
      )}
    >
      <p className={cn("font-medium", isError ? "text-coral-ink" : "text-ink")}>{children}</p>
    </div>
  );
}
