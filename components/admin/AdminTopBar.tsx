"use client";

import { LiveEventProvider, useLiveEvent, useServerNow } from "@/lib/live/LiveEventProvider";
import type { PublicSnapshot } from "@/lib/types";

export function AdminTopBar({ initialSnapshot, operator }: { initialSnapshot: PublicSnapshot; operator: string }) {
  return (
    <LiveEventProvider initial={initialSnapshot}>
      <Bar operator={operator} />
    </LiveEventProvider>
  );
}

function Bar({ operator }: { operator: string }) {
  const { snapshot, serverNow, connection } = useLiveEvent();
  const now = useServerNow(serverNow);
  const clock = new Intl.DateTimeFormat("en-LK", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: snapshot.event.timezone,
  }).format(new Date(now));

  const dot =
    connection === "connected" ? "bg-green" : connection === "reconnecting" ? "bg-amber" : "bg-red";

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-stage-border px-4 py-2 text-sm">
      <div className="flex items-center gap-3">
        <span className="font-sin font-semibold">58 පැදුර</span>
        <span className="text-stage-muted">Event: {snapshot.event.status.toUpperCase()}</span>
        <span className="tabular text-stage-muted">Server {clock}</span>
        <span className="flex items-center gap-1 text-stage-muted">
          <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden /> {connection}
        </span>
      </div>
      <span className="text-stage-muted">{operator}</span>
    </header>
  );
}
