"use client";

import { useState, useTransition } from "react";
import { undoAction } from "@/server/actions/live";

export interface LogEntry {
  id: number;
  created_at: string;
  action: string;
  operator: string | null;
  item_id: string | null;
  undone_by: number | null;
}

export function HistoryList({ entries }: { entries: LogEntry[] }) {
  const [undone, setUndone] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleUndo(id: number) {
    setError(null);
    startTransition(async () => {
      const result = await undoAction(id);
      if (!result.ok) setError(result.error ?? "Could not undo.");
      else setUndone((prev) => new Set(prev).add(id));
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {error && <p className="text-sm text-red">{error}</p>}
      {entries.map((entry) => {
        const isUndone = entry.undone_by != null || undone.has(entry.id);
        return (
          <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg bg-stage-raised px-3 py-2 text-sm ring-1 ring-stage-border">
            <span className="text-stage-muted">{new Date(entry.created_at).toLocaleTimeString("en-LK")}</span>
            <span className={isUndone ? "line-through opacity-50" : ""}>{entry.action}</span>
            <span className="text-stage-muted">{entry.operator ?? "—"}</span>
            {entry.item_id && !isUndone && entry.action !== "undo" && (
              <button disabled={pending} onClick={() => handleUndo(entry.id)} className="text-xs font-medium text-accent hover:underline disabled:opacity-50">
                Undo
              </button>
            )}
          </div>
        );
      })}
      {entries.length === 0 && <p className="text-sm text-stage-muted">No activity yet.</p>}
    </div>
  );
}
