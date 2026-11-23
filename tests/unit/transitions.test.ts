import { describe, it, expect } from "vitest";
import { canPerformItemAction, canPerformEventAction } from "@/lib/transitions";

describe("canPerformItemAction", () => {
  it("allows starting an upcoming item when the event is live and nothing else is active", () => {
    expect(canPerformItemAction("start", "upcoming", { eventStatus: "live", anotherItemActive: false })).toBe(true);
  });
  it("refuses starting when another item is active", () => {
    expect(canPerformItemAction("start", "upcoming", { eventStatus: "live", anotherItemActive: true })).toBe(false);
  });
  it("refuses starting when the event is not live", () => {
    expect(canPerformItemAction("start", "upcoming", { eventStatus: "upcoming", anotherItemActive: false })).toBe(false);
  });
  it("only allows pause on an ongoing item", () => {
    expect(canPerformItemAction("pause", "paused")).toBe(false);
    expect(canPerformItemAction("pause", "ongoing")).toBe(true);
  });
  it("allows restore only from skipped or cancelled", () => {
    expect(canPerformItemAction("restore", "skipped")).toBe(true);
    expect(canPerformItemAction("restore", "completed")).toBe(false);
  });
});

describe("canPerformEventAction", () => {
  it("refuses completing while an item is active", () => {
    expect(canPerformEventAction("complete", "live", { anyItemActive: true })).toBe(false);
    expect(canPerformEventAction("complete", "live", { anyItemActive: false })).toBe(true);
  });
  it("only allows starting from upcoming", () => {
    expect(canPerformEventAction("start", "upcoming")).toBe(true);
    expect(canPerformEventAction("start", "live")).toBe(false);
  });
});
