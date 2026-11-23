"use client";

import { useState } from "react";
import { useLiveEvent } from "@/lib/live/LiveEventProvider";
import { formatTime } from "@/lib/format";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function FullAgenda() {
  const { snapshot } = useLiveEvent();
  const { event, items, categories } = snapshot;
  const [filter, setFilter] = useState<string | null>(null);

  const sorted = [...items].sort((a, b) => a.display_order - b.display_order);
  const visible = filter ? sorted.filter((i) => i.category_id === filter) : sorted;
  const dimmed = (status: string) => status === "skipped" || status === "cancelled";

  return (
    <section id="full-agenda" className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-widest text-stage-muted">Full agenda</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter(null)}
            className={`rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${
              filter === null ? "bg-accent/15 text-accent ring-accent/30" : "text-stage-muted ring-stage-border"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={`rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${
                filter === c.id ? "bg-accent/15 text-accent ring-accent/30" : "text-stage-muted ring-stage-border"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <ul className="space-y-1.5">
        {visible.map((item) => {
          const category = categories.find((c) => c.id === item.category_id);
          return (
            <li
              key={item.id}
              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ring-1 ring-stage-border ${
                dimmed(item.status) ? "opacity-50" : "bg-stage-raised"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-8 shrink-0 tabular text-xs text-stage-muted">#{item.item_number}</span>
                <div className="min-w-0">
                  <p className={`font-sin truncate text-sm font-medium ${dimmed(item.status) ? "line-through" : ""}`}>
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-stage-muted">
                    {category && <CategoryChip name={category.name} color={category.color} />}
                    <span>{formatTime(item.scheduled_start_at, event.timezone)}</span>
                    <span>{item.duration_minutes}m</span>
                  </div>
                </div>
              </div>
              <StatusBadge status={item.status} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
