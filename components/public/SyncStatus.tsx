"use client";

import { useLiveEvent, useServerNow } from "@/lib/live/LiveEventProvider";

export function SyncStatus() {
  const { connection, lastSyncAt, serverNow } = useLiveEvent();
  const now = useServerNow(serverNow);
  const lastSyncLabel = new Intl.DateTimeFormat("en-LK", { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(
    new Date(lastSyncAt)
  );
  const stale = now - lastSyncAt > 2 * 60_000;

  return (
    <footer className="mt-auto px-6 py-4 text-center text-xs" aria-live="polite">
      {connection === "connected" && !stale && <span className="text-stage-muted">Live · updated {lastSyncLabel}</span>}
      {connection === "reconnecting" && !stale && <span className="text-amber">Reconnecting… last updated {lastSyncLabel}</span>}
      {stale && <span className="text-amber">May be out of date · last updated {lastSyncLabel}</span>}
    </footer>
  );
}
