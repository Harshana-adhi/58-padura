"use client";

import { useLiveEvent } from "@/lib/live/LiveEventProvider";
import { formatTime } from "@/lib/format";
import { CategoryChip } from "@/components/ui/CategoryChip";

export function UpNext() {
  const { snapshot } = useLiveEvent();
  const { event, items, categories } = snapshot;

  const next = items
    .filter((i) => i.status === "upcoming")
    .sort((a, b) => a.display_order - b.display_order)[0];

  if (!next) return null;
  const category = categories.find((c) => c.id === next.category_id);

  return (
    <section id="up-next" className="mx-auto w-full max-w-2xl px-6 py-4">
      <p className="mb-2 text-xs uppercase tracking-widest text-stage-muted">Up next</p>
      <div className="rounded-xl bg-stage-raised p-4 ring-1 ring-stage-border">
        <div className="flex items-center gap-2 text-sm text-stage-muted">
          <span>#{next.item_number}</span>
          {category && <CategoryChip name={category.name} color={category.color} />}
        </div>
        <h3 className="font-sin text-lg font-semibold">{next.title}</h3>
        {next.description && <p className="text-sm text-stage-muted">{next.description}</p>}
        <p className="mt-1 text-xs text-stage-muted">
          {formatTime(next.scheduled_start_at, event.timezone)} · {next.duration_minutes} min
        </p>
      </div>
    </section>
  );
}
