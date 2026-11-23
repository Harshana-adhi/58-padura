"use client";

import { useState, useTransition } from "react";
import { LiveEventProvider, useLiveEvent, useServerNow } from "@/lib/live/LiveEventProvider";
import {
  startEventAction,
  pauseEventAction,
  resumeEventAction,
  completeEventAction,
  startItemAction,
  pauseItemAction,
  resumeItemAction,
  completeItemAction,
  skipItemAction,
  cancelItemAction,
  adjustScheduleAction,
  undoAction,
} from "@/server/actions/live";
import type { ActionResult } from "@/server/actions/helpers";
import { canPerformEventAction, canPerformItemAction } from "@/lib/transitions";
import { deriveTiming, scheduleDriftMs, formatDuration } from "@/lib/timing";
import { formatTime } from "@/lib/format";
import type { AdjustMode } from "@/lib/adjustPreview";
import type { AgendaItem, PublicSnapshot } from "@/lib/types";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { AdjustScheduleDialog } from "@/components/admin/AdjustScheduleDialog";

export function LiveControl({ initialSnapshot }: { initialSnapshot: PublicSnapshot }) {
  return (
    <LiveEventProvider initial={initialSnapshot}>
      <LiveControlInner />
    </LiveEventProvider>
  );
}

interface Toast {
  label: string;
  logId?: number;
}

function LiveControlInner() {
  const { snapshot, serverNow, applySnapshot } = useLiveEvent();
  const now = useServerNow(serverNow);
  const { event, items, categories } = snapshot;

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);

  const anyActive = items.some((i) => i.status === "ongoing" || i.status === "paused");
  const current = items.find((i) => i.status === "ongoing" || i.status === "paused");
  const upcoming = items.filter((i) => i.status === "upcoming").sort((a, b) => a.display_order - b.display_order);
  const next = upcoming[0];

  let driftMs = 0;
  if (current) {
    const timing = deriveTiming(current, now);
    driftMs = scheduleDriftMs({
      actualStartAtMs: new Date(current.actual_start_at!).getTime(),
      pausedTotalMs: current.paused_total_seconds * 1000,
      durationMs: current.duration_minutes * 60_000,
      elapsedMs: timing.elapsedMs,
      scheduledStartMs: new Date(current.scheduled_start_at).getTime(),
    });
  }

  function run(label: string, fn: () => Promise<ActionResult>, { silent = false }: { silent?: boolean } = {}) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "Action failed.");
        return;
      }
      if (result.snapshot) applySnapshot(result.snapshot);
      if (!silent) {
        setToast({ label, logId: result.logId });
        setTimeout(() => setToast((t) => (t?.logId === result.logId ? null : t)), 10_000);
      }
    });
  }

  function handleUndo() {
    if (!toast?.logId) return;
    const logId = toast.logId;
    setToast(null);
    startTransition(async () => {
      const result = await undoAction(logId);
      if (!result.ok) setError(result.error ?? "Could not undo.");
      else if (result.snapshot) applySnapshot(result.snapshot);
    });
  }

  function handleAdjust(mode: AdjustMode, minutes: number | null, itemIds: string[] | null) {
    setShowAdjust(false);
    run("Schedule adjusted", () => adjustScheduleAction(mode, minutes, itemIds), { silent: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Live event control</h1>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={pending || !canPerformEventAction("start", event.status)}
            onClick={() => run("Event started", () => startEventAction())}
            className="rounded-md bg-green/20 px-3 py-2 text-sm font-medium text-green ring-1 ring-green/40 disabled:opacity-30"
          >
            Start event
          </button>
          <button
            disabled={pending || !canPerformEventAction("pause", event.status)}
            onClick={() => run("Event paused", () => pauseEventAction())}
            className="rounded-md bg-amber/20 px-3 py-2 text-sm font-medium text-amber ring-1 ring-amber/40 disabled:opacity-30"
          >
            Pause event
          </button>
          <button
            disabled={pending || !canPerformEventAction("resume", event.status)}
            onClick={() => run("Event resumed", () => resumeEventAction())}
            className="rounded-md bg-stage-border px-3 py-2 text-sm font-medium disabled:opacity-30"
          >
            Resume event
          </button>
          <button
            disabled={pending || !canPerformEventAction("complete", event.status, { anyItemActive: anyActive })}
            onClick={() => {
              if (confirm("Complete the event? This marks it as finished.")) {
                const skip = upcoming.length > 0 ? confirm("Mark remaining upcoming items as skipped?") : false;
                run("Event completed", () => completeEventAction(skip), { silent: true });
              }
            }}
            className="rounded-md bg-red/20 px-3 py-2 text-sm font-medium text-red ring-1 ring-red/40 disabled:opacity-30"
          >
            Complete event
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red">{error}</p>}
      {toast && (
        <div className="flex items-center justify-between rounded-md bg-stage-raised px-3 py-2 text-sm ring-1 ring-stage-border">
          <span className="text-stage-muted">{toast.label}</span>
          {toast.logId && (
            <button onClick={handleUndo} className="font-medium text-accent hover:underline">
              Undo
            </button>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-stage-raised p-4 ring-1 ring-stage-border">
          <p className="mb-2 text-xs uppercase tracking-widest text-stage-muted">Now on stage</p>
          {current ? (
            <ItemPanel item={current} now={now} categoryName={categories.find((c) => c.id === current.category_id)?.name} pending={pending} run={run} nextId={next?.id} />
          ) : (
            <p className="text-sm text-stage-muted">Nothing running.</p>
          )}
          {current && (
            <p className={`mt-2 text-xs ${driftMs > 0 ? "text-amber" : "text-stage-muted"}`}>
              {driftMs >= 0 ? `Running +${formatDuration(driftMs)} behind` : `Running ${formatDuration(-driftMs)} ahead`}
            </p>
          )}
        </div>
        <div className="rounded-xl bg-stage-raised p-4 ring-1 ring-stage-border">
          <p className="mb-2 text-xs uppercase tracking-widest text-stage-muted">Up next</p>
          {next ? (
            <div>
              <p className="font-sin font-medium">#{next.item_number} {next.title}</p>
              <p className="text-xs text-stage-muted">
                {formatTime(next.scheduled_start_at, event.timezone)} · {next.duration_minutes} min
              </p>
              <button
                disabled={pending || !canPerformItemAction("start", next.status, { eventStatus: event.status, anotherItemActive: anyActive })}
                onClick={() => run(`Started #${next.item_number}`, () => startItemAction(next.id))}
                className="mt-2 rounded-md bg-green/20 px-3 py-1.5 text-sm font-medium text-green ring-1 ring-green/40 disabled:opacity-30"
              >
                Start
              </button>
            </div>
          ) : (
            <p className="text-sm text-stage-muted">No items remaining.</p>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-stage-muted">Queue (drag to reorder in Agenda)</p>
          <button onClick={() => setShowAdjust(true)} className="rounded-md px-2 py-1 text-xs ring-1 ring-stage-border text-stage-muted hover:text-stage-foreground">
            Adjust schedule
          </button>
        </div>
        <ul className="flex flex-col gap-1.5">
          {upcoming.slice(1).map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-stage-raised px-3 py-2 ring-1 ring-stage-border">
              <div className="min-w-0">
                <p className="font-sin truncate text-sm font-medium">#{item.item_number} {item.title}</p>
                <p className="text-xs text-stage-muted">
                  {formatTime(item.scheduled_start_at, event.timezone)} · {item.duration_minutes} min
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <button
                  disabled={pending || !canPerformItemAction("skip", item.status, { eventStatus: event.status, anotherItemActive: anyActive })}
                  onClick={() => {
                    if (confirm(`Skip item #${item.item_number} — ${item.title}?`)) run(`Skipped #${item.item_number}`, () => skipItemAction(item.id), { silent: true });
                  }}
                  className="rounded-md px-2 py-1 ring-1 ring-stage-border text-stage-muted disabled:opacity-40"
                >
                  Skip
                </button>
                <button
                  disabled={pending || !canPerformItemAction("cancel", item.status, { eventStatus: event.status, anotherItemActive: anyActive })}
                  onClick={() => {
                    if (confirm(`Cancel item #${item.item_number} — ${item.title}?`)) run(`Cancelled #${item.item_number}`, () => cancelItemAction(item.id), { silent: true });
                  }}
                  className="rounded-md px-2 py-1 ring-1 ring-stage-border text-red disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {showAdjust && (
        <AdjustScheduleDialog
          items={items}
          timezone={event.timezone}
          nowMs={now}
          driftMinutes={Math.round(driftMs / 60_000)}
          onApply={handleAdjust}
          onClose={() => setShowAdjust(false)}
        />
      )}
    </div>
  );
}

function ItemPanel({
  item,
  now,
  categoryName,
  pending,
  run,
  nextId,
}: {
  item: AgendaItem;
  now: number;
  categoryName?: string;
  pending: boolean;
  run: (label: string, fn: () => Promise<ActionResult>, opts?: { silent?: boolean }) => void;
  nextId?: string;
}) {
  const timing = deriveTiming(item, now);
  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-stage-muted">
        <span>#{item.item_number}</span>
        {categoryName && <CategoryChip name={categoryName} color="slate" />}
      </div>
      <p className="font-sin font-medium">{item.title}</p>
      <p className={`tabular text-2xl font-bold ${timing.isOvertime ? "text-red" : ""}`}>{formatDuration(timing.elapsedMs)}</p>
      <p className={`tabular text-sm ${timing.isOvertime ? "text-red" : "text-stage-muted"}`}>
        {item.status === "paused" ? "Paused" : timing.isOvertime ? `+${formatDuration(timing.overtimeMs)} overtime` : `${formatDuration(timing.remainingMs)} remaining`}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {item.status === "ongoing" && (
          <button onClick={() => run(`Paused #${item.item_number}`, () => pauseItemAction(item.id))} disabled={pending} className="rounded-md bg-amber/20 px-3 py-1.5 text-sm font-medium text-amber ring-1 ring-amber/40 disabled:opacity-30">
            Pause
          </button>
        )}
        {item.status === "paused" && (
          <button onClick={() => run(`Resumed #${item.item_number}`, () => resumeItemAction(item.id))} disabled={pending} className="rounded-md bg-stage-border px-3 py-1.5 text-sm font-medium disabled:opacity-30">
            Resume
          </button>
        )}
        <button
          onClick={() => run(`Completed #${item.item_number}`, () => completeItemAction(item.id))}
          disabled={pending}
          className="rounded-md bg-red/20 px-3 py-1.5 text-sm font-medium text-red ring-1 ring-red/40 disabled:opacity-30"
        >
          Complete
        </button>
        {nextId && (
          <button
            onClick={() => run(`Completed #${item.item_number}, started next`, () => completeItemAction(item.id, nextId))}
            disabled={pending}
            className="rounded-md px-3 py-1.5 text-sm font-medium ring-1 ring-stage-border text-stage-muted disabled:opacity-30"
          >
            Complete &amp; start next
          </button>
        )}
      </div>
    </div>
  );
}
