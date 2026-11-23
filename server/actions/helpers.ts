import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PublicSnapshot } from "@/lib/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
  snapshot?: PublicSnapshot;
  /** The activity_log row this action wrote, for Undo. */
  logId?: number;
}

/**
 * Every admin_* function bumps state_version once (or, for
 * "complete & start next", twice) and logs the write under that same
 * version, so the version number in the returned snapshot is enough
 * to find the log row without changing every function's return shape.
 */
export async function logIdForVersion(version: number): Promise<number | undefined> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("activity_log")
    .select("id")
    .eq("state_version", version)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? undefined;
}

export async function callAdminRpc(fn: string, args: Record<string, unknown>): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    const conflict = error.message.startsWith("CONFLICT:");
    return { ok: false, error: conflict ? error.message.replace("CONFLICT: ", "") : error.message };
  }
  const snapshot = data as PublicSnapshot;
  const logId = await logIdForVersion(snapshot.version);
  return { ok: true, snapshot, logId };
}
