"use client";

import { LiveEventProvider, useLiveEvent, useServerNow } from "@/lib/live/LiveEventProvider";
import { deriveTiming, scheduleDriftMs, formatDuration } from "@/lib/timing";
import type { PublicSnapshot } from "@/lib/types";

export function DashboardView({ initialSnapshot }: { initialSnapshot: PublicSnapshot }) {
  return (
    <LiveEventProvider initial={initialSnapshot}>
      <Dashboard />
    </LiveEventProvider>
  );
}

function Dashboard() {
  const { snapshot, serverNow } = useLiveEvent();
  const now = useServerNow(serverNow);
  const { event, items } = snapshot;

  const counts = {
    total: items.length,
    completed: items.filter((i) => i.status === "completed").length,
    remaining: items.filter((i) => i.status === "upcoming").length,
    skippedOrCancelled: items.filter((i) => i.status === "skipped" || i.status === "cancelled").length,
  };

  const current = items.find((i) => i.status === "ongoing" || i.status === "paused");
  const next = items.filter((i) => i.status === "upcoming").sort((a, b) => a.display_order - b.display_order)[0];

  let driftLabel: string | null = null;
  if (current) {
    const timing = deriveTiming(current, now);
    const drift = scheduleDriftMs({
      actualStartAtMs: new Date(current.actual_start_at!).getTime(),
      pausedTotalMs: current.paused_total_seconds * 1000,
      durationMs: current.duration_minutes * 60_000,
      elapsedMs: timing.elapsedMs,
      scheduledStartMs: new Date(current.scheduled_start_at).getTime(),
    });
    driftLabel = drift >= 0 ? `Running +${formatDuration(drift)} behind` : `Running ${formatDuration(-drift)} ahead`;
  }

  const progress = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Total items" value={counts.total} />
        <Stat label="Completed" value={counts.completed} />
        <Stat label="Remaining" value={counts.remaining} />
        <Stat label="Skipped / cancelled" value={counts.skippedOrCancelled} />
      </div>

      <div className="rounded-xl bg-stage-raised p-4 ring-1 ring-stage-border">
        <div className="h-2 w-full overflow-hidden rounded-full bg-stage-border">
          <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1 text-xs text-stage-muted">{progress}% complete</p>
      </div>

      {driftLabel && (
        <div className="w-fit rounded-full bg-amber/15 px-3 py-1 text-sm text-amber ring-1 ring-amber/30">{driftLabel}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-stage-raised p-4 ring-1 ring-stage-border">
          <p className="text-xs uppercase tracking-widest text-stage-muted">Current item</p>
          <p className="font-sin mt-1 font-medium">{current ? `#${current.item_number} ${current.title}` : "None running"}</p>
        </div>
        <div className="rounded-xl bg-stage-raised p-4 ring-1 ring-stage-border">
          <p className="text-xs uppercase tracking-widest text-stage-muted">Next item</p>
          <p className="font-sin mt-1 font-medium">{next ? `#${next.item_number} ${next.title}` : "No items remaining"}</p>
        </div>
      </div>

      <div className="flex gap-3 text-sm">
        <a href="/admin/live" className="rounded-md bg-accent px-3 py-1.5 font-medium text-accent-foreground">
          Go to Live control
        </a>
        <a href="/admin/agenda" className="rounded-md px-3 py-1.5 ring-1 ring-stage-border text-stage-muted hover:text-stage-foreground">
          Manage agenda
        </a>
      </div>

      <p className="text-xs text-stage-muted">Event status: {event.status}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-stage-raised p-4 ring-1 ring-stage-border">
      <p className="text-2xl font-bold tabular">{value}</p>
      <p className="text-xs text-stage-muted">{label}</p>
    </div>
  );
}
