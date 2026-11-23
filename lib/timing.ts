// Pure timer and drift maths. No Date.now() inside these functions —
// every "now" comes in as an argument so they stay unit-testable and
// so the browser's clock never silently leaks into a calculation.
import type { AgendaItem } from "./types";

/** offset = server_time - (t0 + t1) / 2, in milliseconds. */
export function computeClockOffset(
  serverTimeMs: number,
  t0Ms: number,
  t1Ms: number
): number {
  return serverTimeMs - (t0Ms + t1Ms) / 2;
}

/** Countdown to the event start, in milliseconds. Never negative. */
export function countdownMs(startsAtMs: number, nowMs: number): number {
  return Math.max(0, startsAtMs - nowMs);
}

export interface ElapsedInput {
  actualStartAtMs: number;
  pausedAtMs: number | null;
  pausedTotalMs: number;
  nowMs: number;
}

/** Elapsed time for a running or paused item, in milliseconds. */
export function elapsedMs({
  actualStartAtMs,
  pausedAtMs,
  pausedTotalMs,
  nowMs,
}: ElapsedInput): number {
  const clock = pausedAtMs ?? nowMs;
  return Math.max(0, clock - actualStartAtMs - pausedTotalMs);
}

export interface RemainingResult {
  remainingMs: number;
  overtimeMs: number;
}

/** remaining = duration - elapsed; negative becomes overtime. */
export function remaining(durationMs: number, elapsed: number): RemainingResult {
  const remainingMs = durationMs - elapsed;
  return {
    remainingMs: Math.max(0, remainingMs),
    overtimeMs: Math.max(0, -remainingMs),
  };
}

/** actual duration = end - start - pausedTotal, in milliseconds. */
export function actualDurationMs(
  actualStartAtMs: number,
  actualEndAtMs: number,
  pausedTotalMs: number
): number {
  return Math.max(0, actualEndAtMs - actualStartAtMs - pausedTotalMs);
}

export interface DriftInput {
  actualStartAtMs: number;
  pausedTotalMs: number;
  durationMs: number;
  elapsedMs: number;
  scheduledStartMs: number;
}

/**
 * drift = (actualStart + pausedTotal + max(duration, elapsed)) - (scheduledStart + duration)
 * Positive = running behind; negative = running ahead. Informational only.
 */
export function scheduleDriftMs({
  actualStartAtMs,
  pausedTotalMs,
  durationMs,
  elapsedMs,
  scheduledStartMs,
}: DriftInput): number {
  const projectedEnd = actualStartAtMs + pausedTotalMs + Math.max(durationMs, elapsedMs);
  const scheduledEnd = scheduledStartMs + durationMs;
  return projectedEnd - scheduledEnd;
}

export interface DerivedTiming {
  elapsedMs: number;
  remainingMs: number;
  overtimeMs: number;
  isOvertime: boolean;
  driftMs: number | null;
}

/** All the derived values a "now on stage" panel needs for one item. */
export function deriveTiming(item: AgendaItem, nowMs: number): DerivedTiming {
  const durationMs = item.duration_minutes * 60_000;
  const pausedTotalMs = item.paused_total_seconds * 1000;

  if (!item.actual_start_at) {
    return { elapsedMs: 0, remainingMs: durationMs, overtimeMs: 0, isOvertime: false, driftMs: null };
  }

  const actualStartAtMs = new Date(item.actual_start_at).getTime();
  const pausedAtMs = item.paused_at ? new Date(item.paused_at).getTime() : null;

  const elapsed = elapsedMs({ actualStartAtMs, pausedAtMs, pausedTotalMs, nowMs });
  const { remainingMs, overtimeMs } = remaining(durationMs, elapsed);

  const driftMs = scheduleDriftMs({
    actualStartAtMs,
    pausedTotalMs,
    durationMs,
    elapsedMs: elapsed,
    scheduledStartMs: new Date(item.scheduled_start_at).getTime(),
  });

  return { elapsedMs: elapsed, remainingMs, overtimeMs, isOvertime: overtimeMs > 0, driftMs };
}

/** mm:ss or hh:mm:ss, always zero-padded. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function countdownParts(ms: number): CountdownParts {
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}
