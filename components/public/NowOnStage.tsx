"use client";

import { useLiveEvent, useServerNow } from "@/lib/live/LiveEventProvider";
import { deriveTiming, formatDuration } from "@/lib/timing";
import { formatTime } from "@/lib/format";
import { CategoryChip } from "@/components/ui/CategoryChip";

export function NowOnStage() {
  const { snapshot, serverNow } = useLiveEvent();
  const now = useServerNow(serverNow);
  const { event, items, categories } = snapshot;

  const current = items.find((i) => i.status === "ongoing" || i.status === "paused");

  if (event.status === "completed") {
    return <Empty text="Event has ended" />;
  }
  if (event.status !== "live" && event.status !== "paused") {
    return <Empty text="Event has not started yet" />;
  }
  if (!current) {
    return <Empty text="Waiting for the next item" />;
  }

  const category = categories.find((c) => c.id === current.category_id);
  const timing = deriveTiming(current, now);

  return (
    <section id="now" className="mx-auto w-full max-w-2xl px-6 py-8">
      <p className="mb-2 text-xs uppercase tracking-widest text-stage-muted">Now on stage</p>
      <div className="rounded-2xl bg-stage-raised p-6 ring-1 ring-stage-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-stage-muted">
              <span>#{current.item_number}</span>
              {category && <CategoryChip name={category.name} color={category.color} />}
            </div>
            <h2 className="font-sin text-2xl font-semibold">{current.title}</h2>
            {current.description && <p className="mt-1 text-sm text-stage-muted">{current.description}</p>}
            <p className="mt-2 text-xs text-stage-muted">
              Scheduled {formatTime(current.scheduled_start_at, event.timezone)} · planned {current.duration_minutes} min
            </p>
          </div>
          <div className="text-right">
            <p
              className={`tabular text-4xl font-bold ${
                current.status === "paused" ? "text-amber" : timing.isOvertime ? "text-red" : "text-stage-foreground"
              }`}
            >
              {formatDuration(timing.elapsedMs)}
            </p>
            <p className={`tabular text-sm ${timing.isOvertime ? "text-red" : "text-stage-muted"}`}>
              {current.status === "paused"
                ? "Paused"
                : timing.isOvertime
                  ? `+${formatDuration(timing.overtimeMs)} overtime`
                  : `${formatDuration(timing.remainingMs)} remaining`}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-8 text-center text-stage-muted">
      <div className="rounded-2xl bg-stage-raised p-8 ring-1 ring-stage-border">{text}</div>
    </section>
  );
}
