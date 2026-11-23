import { createClient } from "@supabase/supabase-js";
import { LiveEventProvider } from "@/lib/live/LiveEventProvider";
import { Hero } from "@/components/public/Hero";
import { CountdownOrStatus } from "@/components/public/CountdownOrStatus";
import { NowOnStage } from "@/components/public/NowOnStage";
import { UpNext } from "@/components/public/UpNext";
import { ComingUp } from "@/components/public/ComingUp";
import { CompletedList } from "@/components/public/CompletedList";
import { FullAgenda } from "@/components/public/FullAgenda";
import { SyncStatus } from "@/components/public/SyncStatus";
import { MiniNav } from "@/components/public/MiniNav";
import type { PublicSnapshot } from "@/lib/types";

// This page must always render the live snapshot, never a build-time
// static one, so it is never prerendered.
export const dynamic = "force-dynamic";

// Server Component: renders with the real snapshot on first paint,
// using the anon key directly since this read is exactly what a
// visitor's own browser is allowed to do.
async function fetchInitialSnapshot(): Promise<PublicSnapshot> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.rpc("get_public_snapshot");
  if (error || !data) throw new Error(error?.message ?? "No snapshot");
  return data as PublicSnapshot;
}

export default async function PublicPage() {
  const snapshot = await fetchInitialSnapshot();

  return (
    <LiveEventProvider initial={snapshot}>
      <MiniNav />
      <Hero event={snapshot.event} />
      <CountdownOrStatus />
      <NowOnStage />
      <UpNext />
      <ComingUp limit={5} />
      <CompletedList />
      <FullAgenda />
      <SyncStatus />
    </LiveEventProvider>
  );
}
