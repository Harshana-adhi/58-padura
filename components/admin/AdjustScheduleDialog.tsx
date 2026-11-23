"use client";

import { useMemo, useState } from "react";
import { computeAdjustPreview, type AdjustMode } from "@/lib/adjustPreview";
import { formatTime } from "@/lib/format";
import type { AgendaItem } from "@/lib/types";

export function AdjustScheduleDialog({
  items,
  timezone,
  nowMs,
  driftMinutes,
  onApply,
  onClose,
}: {
  items: AgendaItem[];
  timezone: string;
  nowMs: number;
  driftMinutes: number;
  onApply: (mode: AdjustMode, minutes: number | null, itemIds: string[] | null) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<AdjustMode>("shift_all");
  const [minutes, setMinutes] = useState(driftMinutes);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const upcoming = items.filter((i) => i.status === "upcoming").sort((a, b) => a.display_order - b.display_order);

  const preview = useMemo(
    () => computeAdjustPreview(items, mode, mode === "reflow" ? null : minutes, Array.from(selected), nowMs),
    [items, mode, minutes, selected, nowMs]
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-stage-raised p-5 ring-1 ring-stage-border">
        <h2 className="mb-3 text-lg font-semibold">Adjust schedule</h2>

        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" checked={mode === "shift_all"} onChange={() => setMode("shift_all")} />
            Shift all following items by
            <input
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              disabled={mode !== "shift_all"}
              className="input w-20 py-1"
            />
            minutes
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" checked={mode === "shift_selected"} onChange={() => setMode("shift_selected")} />
            Shift selected items only, by
            <input
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              disabled={mode !== "shift_selected"}
              className="input w-20 py-1"
            />
            minutes
          </label>
          {mode === "shift_selected" && (
            <div className="ml-6 flex flex-col gap-1">
              {upcoming.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-xs text-stage-muted">
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                  #{item.item_number} {item.title}
                </label>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" checked={mode === "reflow"} onChange={() => setMode("reflow")} />
            Re-flow from now: each upcoming item starts when the previous one ends
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" checked={mode === "none"} onChange={() => setMode("none")} />
            Do nothing — keep the drift badge as a reminder
          </label>
        </div>

        {preview.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-xs uppercase tracking-widest text-stage-muted">Preview</p>
            <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto text-xs">
              {preview.map((row) => (
                <li key={row.id} className="flex items-center justify-between rounded-md bg-stage px-2 py-1 ring-1 ring-stage-border">
                  <span className="truncate">{row.title}</span>
                  <span className="tabular text-stage-muted">
                    {formatTime(new Date(row.beforeMs).toISOString(), timezone)} → {formatTime(new Date(row.afterMs).toISOString(), timezone)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm ring-1 ring-stage-border text-stage-muted">
            Cancel
          </button>
          <button
            onClick={() => onApply(mode, mode === "reflow" || mode === "none" ? null : minutes, mode === "shift_selected" ? Array.from(selected) : null)}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
