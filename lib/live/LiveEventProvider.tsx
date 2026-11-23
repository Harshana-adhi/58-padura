"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { computeClockOffset } from "@/lib/timing";
import type { PublicSnapshot } from "@/lib/types";

type ConnectionState = "connected" | "reconnecting" | "offline";

interface LiveEventContextValue {
  snapshot: PublicSnapshot;
  serverNow: () => number;
  connection: ConnectionState;
  lastSyncAt: number;
  /**
   * Applies a snapshot the caller already has in hand (a Server
   * Action's own response) without waiting for the realtime broadcast
   * to arrive. Ignored if it is not newer than what we hold.
   */
  applySnapshot: (next: PublicSnapshot) => void;
}

const LiveEventContext = createContext<LiveEventContextValue | null>(null);

export function useLiveEvent() {
  const ctx = useContext(LiveEventContext);
  if (!ctx) throw new Error("useLiveEvent must be used inside <LiveEventProvider>");
  return ctx;
}

/** A single ticking source: re-renders once per second, aligned to the second boundary. */
export function useServerNow(serverNowFn: () => number): number {
  const [tick, setTick] = useState(() => serverNowFn());

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = serverNowFn();
      const delay = 1000 - (now % 1000);
      timeout = setTimeout(() => {
        setTick(serverNowFn());
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, [serverNowFn]);

  return tick;
}

async function fetchSnapshot(version?: number): Promise<{ snapshot: PublicSnapshot; t0: number; t1: number }> {
  const t0 = Date.now();
  const url = version ? `/api/snapshot?v=${version}` : "/api/snapshot";
  const res = await fetch(url, { cache: version ? "force-cache" : "no-store" });
  const t1 = Date.now();
  if (!res.ok) throw new Error(`snapshot fetch failed: ${res.status}`);
  const snapshot = (await res.json()) as PublicSnapshot;
  return { snapshot, t0, t1 };
}

const CLOCK_RESAMPLE_MS = 5 * 60_000;
const BACKGROUND_UNSUB_MS = 60_000;
const STALE_WARN_MS = 20_000;
const STALE_DIM_MS = 2 * 60_000;

export function LiveEventProvider({
  initial,
  children,
}: {
  initial: PublicSnapshot;
  children: React.ReactNode;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  // Until the first real clock sample comes back, assume zero network
  // latency rather than calling the impure Date.now() during render.
  const [offset, setOffset] = useState(() => {
    const serverTimeMs = new Date(initial.server_time).getTime();
    return computeClockOffset(serverTimeMs, serverTimeMs, serverTimeMs);
  });
  const [connection, setConnection] = useState<ConnectionState>("connected");
  const [lastSyncAt, setLastSyncAt] = useState(() => new Date(initial.server_time).getTime());

  const offsetRef = useRef(offset);
  const versionRef = useRef(snapshot.version);
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);
  useEffect(() => {
    versionRef.current = snapshot.version;
  }, [snapshot.version]);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  const applyIfNewer = useCallback((next: PublicSnapshot) => {
    if (next.version > versionRef.current) {
      setSnapshot(next);
      versionRef.current = next.version;
    }
    setLastSyncAt(Date.now());
  }, []);

  const resync = useCallback(async () => {
    try {
      const { snapshot: next } = await fetchSnapshot();
      applyIfNewer(next);
    } catch {
      // swallow: the poll loop and staleness UI handle persistent failure
    }
  }, [applyIfNewer]);

  // Server clock offset: three samples on load, keep the shortest round trip.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let best: { rtt: number; offset: number } | null = null;
      for (let i = 0; i < 3; i++) {
        try {
          const { snapshot: s, t0, t1 } = await fetchSnapshot();
          const rtt = t1 - t0;
          const candidateOffset = computeClockOffset(new Date(s.server_time).getTime(), t0, t1);
          if (!best || rtt < best.rtt) best = { rtt, offset: candidateOffset };
          applyIfNewer(s);
        } catch {
          // ignore a failed sample, try the next one
        }
      }
      if (best && !cancelled) setOffset(best.offset);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyIfNewer]);

  // Re-sample the clock every 5 minutes and whenever the tab becomes visible.
  useEffect(() => {
    const resample = async () => {
      try {
        const { snapshot: s, t0, t1 } = await fetchSnapshot();
        setOffset(computeClockOffset(new Date(s.server_time).getTime(), t0, t1));
        applyIfNewer(s);
      } catch {
        // next interval will try again
      }
    };
    const interval = setInterval(resample, CLOCK_RESAMPLE_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") resample();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [applyIfNewer]);

  // Realtime subscription + polling fallback.
  useEffect(() => {
    const supabase = createPublicClient();
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let backgroundTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let subscribed = false;

    const startPolling = (intervalMs: number) => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(resync, intervalMs);
    };

    const channel = supabase.channel("event-58:state");

    const subscribe = () => {
      channel
        .on("broadcast", { event: "state" }, async (payload) => {
          const v = (payload.payload as { v?: number })?.v;
          if (typeof v === "number" && v > versionRef.current) {
            await new Promise((r) => setTimeout(r, Math.random() * 1500));
            try {
              const { snapshot: next } = await fetchSnapshot(v);
              applyIfNewer(next);
            } catch {
              resync();
            }
          }
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            subscribed = true;
            setConnection("connected");
            startPolling(30_000);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            subscribed = false;
            setConnection("reconnecting");
            startPolling(15_000);
            retryTimer = setTimeout(subscribe, 120_000);
          } else if (status === "CLOSED") {
            subscribed = false;
          }
        });
    };
    subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (backgroundTimer) clearTimeout(backgroundTimer);
        resync();
        if (!subscribed) subscribe();
      } else {
        backgroundTimer = setTimeout(() => {
          channel.unsubscribe();
          subscribed = false;
        }, BACKGROUND_UNSUB_MS);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    const onOnline = () => resync();
    window.addEventListener("online", onOnline);

    startPolling(30_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      if (pollTimer) clearInterval(pollTimer);
      if (backgroundTimer) clearTimeout(backgroundTimer);
      if (retryTimer) clearTimeout(retryTimer);
      channel.unsubscribe();
    };
  }, [applyIfNewer, resync]);

  // Staleness: downgrade connection state honestly based on last successful sync.
  useEffect(() => {
    const interval = setInterval(() => {
      const age = Date.now() - lastSyncAt;
      if (age > STALE_DIM_MS) setConnection("offline");
      else if (age > STALE_WARN_MS) setConnection((c) => (c === "connected" ? "reconnecting" : c));
    }, 5000);
    return () => clearInterval(interval);
  }, [lastSyncAt]);

  const value = useMemo<LiveEventContextValue>(
    () => ({ snapshot, serverNow, connection, lastSyncAt, applySnapshot: applyIfNewer }),
    [snapshot, serverNow, connection, lastSyncAt, applyIfNewer]
  );

  return <LiveEventContext.Provider value={value}>{children}</LiveEventContext.Provider>;
}
