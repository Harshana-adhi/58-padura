"use client";

import { useLiveEvent } from "@/lib/live/LiveEventProvider";
import { formatTime } from "@/lib/format";
import { CategoryChip } from "@/components/ui/CategoryChip";

export function ComingUp({ limit = 5 }: { limit?: number }) {
  const { snapshot } = useLiveEvent();
  const { event, items, categories } = snapshot;

  const upcoming = items
    .filter((i) => i.status === "upcoming")
    .sort((a, b) => a.display_order - b.display_order)
    .slice(1, 1 + limit);

  if (upcoming.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-stage-muted">Coming up</p>
        <a href="#full-agenda" className="text-xs text-accent hover:underline">
          See full agenda
        </a>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {upcoming.map((item) => {
          const category = categories.find((c) => c.id === item.category_id);
          return (
            <li key={item.id} className="rounded-lg bg-stage-raised p-3 ring-1 ring-stage-border">
              <div className="flex items-center gap-2 text-xs text-stage-muted">
                <span>#{item.item_number}</span>
                {category && <CategoryChip name={category.name} color={category.color} />}
              </div>
              <p className="font-sin text-sm font-medium">{item.title}</p>
              <p className="text-xs text-stage-muted">
                {formatTime(item.scheduled_start_at, event.timezone)} · {item.duration_minutes} min
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
