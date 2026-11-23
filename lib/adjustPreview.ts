// Mirrors admin_adjust_schedule's SQL logic in pure JS, for the
// before/after preview shown in the dialog. The database is the one
// that actually applies it — this is read-only.
import type { AgendaItem } from "./types";

export type AdjustMode = "shift_all" | "shift_selected" | "reflow" | "none";

export interface PreviewRow {
  id: string;
  title: string;
  beforeMs: number;
  afterMs: number;
}

export function computeAdjustPreview(
  items: AgendaItem[],
  mode: AdjustMode,
  minutes: number | null,
  selectedIds: string[] | null,
  nowMs: number
): PreviewRow[] {
  const upcoming = items
    .filter((i) => i.status === "upcoming")
    .sort((a, b) => a.display_order - b.display_order);
  const current = items.find((i) => i.status === "ongoing" || i.status === "paused");

  if (mode === "none") {
    return [];
  }

  if (mode === "shift_all" || mode === "shift_selected") {
    const shiftMs = (minutes ?? 0) * 60_000;
    const targets =
      mode === "shift_all" ? upcoming.filter((i) => !i.is_time_fixed) : upcoming.filter((i) => !i.is_time_fixed && selectedIds?.includes(i.id));
    return targets.map((item) => {
      const beforeMs = new Date(item.scheduled_start_at).getTime();
      return { id: item.id, title: item.title, beforeMs, afterMs: beforeMs + shiftMs };
    });
  }

  // reflow
  let pointer = nowMs;
  if (current) {
    const actualStartMs = new Date(current.actual_start_at!).getTime();
    const pausedTotalMs = current.paused_total_seconds * 1000;
    const elapsed = Math.max(0, (current.paused_at ? new Date(current.paused_at).getTime() : nowMs) - actualStartMs - pausedTotalMs);
    pointer = actualStartMs + pausedTotalMs + Math.max(current.duration_minutes * 60_000, elapsed);
  }

  const rows: PreviewRow[] = [];
  for (const item of upcoming) {
    const beforeMs = new Date(item.scheduled_start_at).getTime();
    const durationMs = item.duration_minutes * 60_000;
    if (item.is_time_fixed) {
      rows.push({ id: item.id, title: item.title, beforeMs, afterMs: beforeMs });
      pointer = beforeMs + durationMs;
    } else {
      rows.push({ id: item.id, title: item.title, beforeMs, afterMs: pointer });
      pointer = pointer + durationMs;
    }
  }
  return rows;
}
