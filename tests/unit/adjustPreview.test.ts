import { describe, it, expect } from "vitest";
import { computeAdjustPreview } from "@/lib/adjustPreview";
import type { AgendaItem } from "@/lib/types";

function item(overrides: Partial<AgendaItem>): AgendaItem {
  return {
    id: "id",
    item_number: 1,
    display_order: 1,
    title: "Item",
    description: null,
    category_id: "cat",
    planned_start_at: new Date(0).toISOString(),
    scheduled_start_at: new Date(0).toISOString(),
    duration_minutes: 10,
    is_time_fixed: false,
    status: "upcoming",
    actual_start_at: null,
    actual_end_at: null,
    paused_at: null,
    paused_total_seconds: 0,
    row_version: 0,
    ...overrides,
  };
}

describe("computeAdjustPreview", () => {
  it("shift_all moves every non-fixed upcoming item by the same amount", () => {
    const items = [
      item({ id: "a", display_order: 1, scheduled_start_at: new Date(1_000_000).toISOString() }),
      item({ id: "b", display_order: 2, scheduled_start_at: new Date(2_000_000).toISOString(), is_time_fixed: true }),
    ];
    const rows = computeAdjustPreview(items, "shift_all", 10, null, 0);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("a");
    expect(rows[0].afterMs - rows[0].beforeMs).toBe(10 * 60_000);
  });

  it("shift_selected only moves the chosen items", () => {
    const items = [
      item({ id: "a", display_order: 1, scheduled_start_at: new Date(1_000_000).toISOString() }),
      item({ id: "b", display_order: 2, scheduled_start_at: new Date(2_000_000).toISOString() }),
    ];
    const rows = computeAdjustPreview(items, "shift_selected", 5, ["b"], 0);
    expect(rows.map((r) => r.id)).toEqual(["b"]);
  });

  it("reflow chains upcoming items back-to-back from now, skipping fixed items", () => {
    const items = [
      item({ id: "a", display_order: 1, duration_minutes: 10, scheduled_start_at: new Date(5_000_000).toISOString() }),
      item({
        id: "b",
        display_order: 2,
        duration_minutes: 20,
        is_time_fixed: true,
        scheduled_start_at: new Date(6_000_000).toISOString(),
      }),
      item({ id: "c", display_order: 3, duration_minutes: 15, scheduled_start_at: new Date(9_000_000).toISOString() }),
    ];
    const now = 1_000_000;
    const rows = computeAdjustPreview(items, "reflow", null, null, now);
    expect(rows[0].afterMs).toBe(now); // "a" starts right now
    expect(rows[1].afterMs).toBe(rows[1].beforeMs); // fixed item "b" never moves
    expect(rows[2].afterMs).toBe(rows[1].beforeMs + 20 * 60_000); // "c" starts when "b" ends
  });

  it("none returns no rows", () => {
    const items = [item({ id: "a" })];
    expect(computeAdjustPreview(items, "none", null, null, 0)).toHaveLength(0);
  });
});
