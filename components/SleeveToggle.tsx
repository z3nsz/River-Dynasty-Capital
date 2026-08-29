"use client";

import type { SleeveOption } from "@/lib/data";

export function SleeveToggle({
  options,
  selected,
  onSelect,
}: {
  options: SleeveOption[];
  selected: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Select portfolio sleeve"
      className="inline-flex flex-wrap gap-1 rounded-sm border border-hairline bg-paper p-1"
    >
      {options.map((o) => {
        const active = o.slug === selected;
        return (
          <button
            key={o.slug}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onSelect(o.slug)}
            className={`tnum rounded-sm px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-navy text-paper"
                : "text-muted hover:bg-ink/5 hover:text-ink"
            }`}
          >
            {o.displayName}
          </button>
        );
      })}
    </div>
  );
}
