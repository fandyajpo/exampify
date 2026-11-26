"use client";

/**
 * `Tabs` (`DESIGN_SYSTEM.md` §9.7): a segmented control — a sunk track with the selected
 * segment raised on white — with arrow-key navigation and one tab stop. Panels are rendered
 * on the server and passed in, so the component owns only selection state.
 */
import { useId, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TabItem = { id: string; label: string; content: ReactNode };

export function Tabs({
  items,
  defaultId,
  className,
}: {
  items: TabItem[];
  defaultId?: string;
  className?: string;
}): React.JSX.Element {
  const baseId = useId();
  const [selected, setSelected] = useState(defaultId ?? items[0]?.id);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activeIndex = Math.max(
    items.findIndex((item) => item.id === selected),
    0,
  );
  const active = items[activeIndex];

  function move(delta: number): void {
    if (items.length === 0) return;
    const next = (activeIndex + delta + items.length) % items.length;
    setSelected(items[next]!.id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-full bg-paper-sunk p-1"
      >
        {items.map((item, index) => {
          const isActive = item.id === active?.id;
          return (
            <button
              key={item.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setSelected(item.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  move(1);
                } else if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  move(-1);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  setSelected(items[0]?.id);
                  tabRefs.current[0]?.focus();
                } else if (event.key === "End") {
                  event.preventDefault();
                  setSelected(items.at(-1)?.id);
                  tabRefs.current.at(-1)?.focus();
                }
              }}
              className={cn(
                "min-h-9 cursor-pointer rounded-full px-4 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 ease-soft",
                isActive
                  ? "bg-paper-raised text-ink shadow-sm"
                  : "text-ink-2 hover:text-ink",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {active ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${active.id}`}
          aria-labelledby={`${baseId}-tab-${active.id}`}
          tabIndex={0}
          className="pt-5"
        >
          {active.content}
        </div>
      ) : null}
    </div>
  );
}
