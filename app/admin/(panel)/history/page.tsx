import { createAdminClient } from "@/lib/supabase/admin";
import { HistoryList, type LogEntry } from "@/components/admin/HistoryList";

export default async function AdminHistoryPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("activity_log")
    .select("id, created_at, action, operator, item_id, undone_by")
    .order("created_at", { ascending: false })
    .limit(100);

  const entries = (data ?? []) as LogEntry[];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Event history</h1>
      <HistoryList entries={entries} />
      <p className="text-xs text-stage-muted">Filters and CSV export land in the next build pass.</p>
    </div>
  );
}
