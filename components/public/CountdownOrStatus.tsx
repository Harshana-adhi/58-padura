"use client";

import { useLiveEvent, useServerNow } from "@/lib/live/LiveEventProvider";
import { countdownMs, countdownParts } from "@/lib/timing";

export function CountdownOrStatus() {
  const { snapshot, serverNow } = useLiveEvent();
  const now = useServerNow(serverNow);
  const event = snapshot.event;
  const startsAtMs = new Date(event.starts_at).getTime();
  const remaining = countdownMs(startsAtMs, now);

  if (event.status === "upcoming" && remaining > 0) {
    const { days, hours, minutes, seconds } = countdownParts(remaining);
    return (
      <section className="flex flex-col items-center gap-3 px-6 py-8" aria-live="off">
        <p className="font-sin text-sm uppercase tracking-widest text-stage-muted">58 පැදුර Begins In</p>
        <div className="flex gap-4 tabular text-3xl font-bold sm:text-5xl">
          <Unit value={days} label="Days" />
          <Unit value={hours} label="Hrs" />
          <Unit value={minutes} label="Min" />
          <Unit value={seconds} label="Sec" />
        </div>
      </section>
    );
  }

  const label =
    event.status === "upcoming"
      ? "Event Starting Now!"
      : event.status === "live"
        ? "Event Is Live!"
        : event.status === "paused"
          ? "Event Paused – we'll be right back"
          : "Event Completed!";

  return (
    <section className="flex flex-col items-center gap-2 px-6 py-8" aria-live="polite">
      <p className="text-2xl font-bold sm:text-4xl">{label}</p>
    </section>
  );
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span>{value.toString().padStart(2, "0")}</span>
      <span className="text-xs font-normal uppercase tracking-wide text-stage-muted">{label}</span>
    </div>
  );
}
