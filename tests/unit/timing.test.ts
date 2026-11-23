import { describe, it, expect } from "vitest";
import { countdownMs, elapsedMs, remaining, actualDurationMs, scheduleDriftMs, formatDuration } from "@/lib/timing";

describe("countdownMs", () => {
  it("never goes negative", () => {
    expect(countdownMs(1000, 2000)).toBe(0);
  });
  it("counts down to the start", () => {
    expect(countdownMs(5000, 2000)).toBe(3000);
  });
});

describe("elapsedMs", () => {
  it("counts from actual start to now when running", () => {
    expect(elapsedMs({ actualStartAtMs: 0, pausedAtMs: null, pausedTotalMs: 0, nowMs: 10_000 })).toBe(10_000);
  });
  it("freezes at the pause moment", () => {
    expect(elapsedMs({ actualStartAtMs: 0, pausedAtMs: 5_000, pausedTotalMs: 0, nowMs: 50_000 })).toBe(5_000);
  });
  it("subtracts accumulated pause time", () => {
    expect(elapsedMs({ actualStartAtMs: 0, pausedAtMs: null, pausedTotalMs: 3_000, nowMs: 10_000 })).toBe(7_000);
  });
});

describe("remaining", () => {
  it("reports overtime once elapsed exceeds duration", () => {
    const { remainingMs, overtimeMs } = remaining(60_000, 90_000);
    expect(remainingMs).toBe(0);
    expect(overtimeMs).toBe(30_000);
  });
});

describe("actualDurationMs", () => {
  it("subtracts paused time from the wall-clock span", () => {
    expect(actualDurationMs(0, 100_000, 20_000)).toBe(80_000);
  });
});

describe("scheduleDriftMs", () => {
  it("is positive when running behind schedule", () => {
    const drift = scheduleDriftMs({
      actualStartAtMs: 10_000,
      pausedTotalMs: 0,
      durationMs: 60_000,
      elapsedMs: 30_000,
      scheduledStartMs: 0,
    });
    expect(drift).toBeGreaterThan(0);
  });
});

describe("formatDuration", () => {
  it("pads mm:ss", () => {
    expect(formatDuration(65_000)).toBe("01:05");
  });
  it("shows hours once past 60 minutes", () => {
    expect(formatDuration(3_725_000)).toBe("01:02:05");
  });
});
