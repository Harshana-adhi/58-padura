"use client";

import { useState } from "react";
import { useLiveEvent } from "@/lib/live/LiveEventProvider";
import { formatTime } from "@/lib/format";
import { actualDurationMs, formatDuration } from "@/lib/timing";
import { CategoryChip } from "@/components/ui/CategoryChip";

export function CompletedList() {
  const { snapshot } = useLiveEvent();
  const { event, items, categories } = snapshot;
  const [showAll, setShowAll] = useState(false);

  const completed = items
    .filter((i) => i.status === "completed" && i.actual_start_at && i.actual_end_at)
    .sort((a, b) => new Date(a.actual_start_at!).getTime() - new Date(b.actual_start_at!).getTime());

  if (completed.length === 0) return null;
  const visible = showAll ? completed : completed.slice(-5);

  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-4">
      <p className="mb-2 text-xs uppercase tracking-widest text-stage-muted">Completed</p>
      <ul className="space-y-2">
        {visible.map((item) => {
          const category = categories.find((c) => c.id === item.category_id);
          const duration = actualDurationMs(
            new Date(item.actual_start_at!).getTime(),
            new Date(item.actual_end_at!).getTime(),
            item.paused_total_seconds * 1000
          );
          return (
            <li key={item.id} className="flex items-center justify-between rounded-lg bg-stage-raised p-3 ring-1 ring-stage-border">
              <div>
                <div className="flex items-center gap-2 text-xs text-stage-muted">
                  <span>#{item.item_number}</span>
                  {category && <CategoryChip name={category.name} color={category.color} />}
                </div>
                <p className="font-sin text-sm font-medium">{item.title}</p>
                <p className="text-xs text-stage-muted">
                  sched {formatTime(item.scheduled_start_at, event.timezone)} · actual{" "}
                  {formatTime(item.actual_start_at!, event.timezone)}–{formatTime(item.actual_end_at!, event.timezone)}
                </p>
              </div>
              <span className="tabular text-sm text-stage-muted">{formatDuration(duration)}</span>
            </li>
          );
        })}
      </ul>
      {completed.length > 5 && !showAll && (
        <button onClick={() => setShowAll(true)} className="mt-2 text-xs text-accent hover:underline">
          Show all
        </button>
      )}
    </section>
  );
}
