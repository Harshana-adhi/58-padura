// Single source of truth for which status transitions are allowed.
// The database re-checks every one of these with its own guards —
// this table only decides whether a button is greyed out.
import type { EventStatus, ItemStatus } from "./types";

export type ItemAction =
  | "start"
  | "pause"
  | "resume"
  | "complete"
  | "skip"
  | "cancel"
  | "restore"
  | "delete";

export type EventAction = "start" | "pause" | "resume" | "complete";

const ITEM_TRANSITIONS: Record<ItemAction, ItemStatus[]> = {
  start: ["upcoming"],
  pause: ["ongoing"],
  resume: ["paused"],
  complete: ["ongoing", "paused"],
  skip: ["upcoming"],
  cancel: ["upcoming", "ongoing", "paused"],
  restore: ["skipped", "cancelled"],
  delete: ["upcoming", "skipped", "cancelled"],
};

const EVENT_TRANSITIONS: Record<EventAction, EventStatus[]> = {
  start: ["upcoming"],
  pause: ["live"],
  resume: ["paused"],
  complete: ["live", "paused"],
};

export function canPerformItemAction(
  action: ItemAction,
  itemStatus: ItemStatus,
  opts: { eventStatus: EventStatus; anotherItemActive: boolean } = {
    eventStatus: "live",
    anotherItemActive: false,
  }
): boolean {
  if (!ITEM_TRANSITIONS[action].includes(itemStatus)) return false;
  if (action === "start") {
    return opts.eventStatus === "live" && !opts.anotherItemActive;
  }
  return true;
}

export function canPerformEventAction(
  action: EventAction,
  eventStatus: EventStatus,
  opts: { anyItemActive: boolean } = { anyItemActive: false }
): boolean {
  if (!EVENT_TRANSITIONS[action].includes(eventStatus)) return false;
  if (action === "complete" && opts.anyItemActive) return false;
  return true;
}

/** Terminal statuses: nothing can act on these except Undo / Restore / Delete. */
export const TERMINAL_ITEM_STATUSES: ItemStatus[] = ["completed", "skipped", "cancelled"];

export function isItemLocked(status: ItemStatus): boolean {
  return status === "ongoing" || status === "paused" || status === "completed";
}
