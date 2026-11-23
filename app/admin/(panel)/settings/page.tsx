import { createAdminClient } from "@/lib/supabase/admin";
import type { PublicSnapshot } from "@/lib/types";
import { SettingsForm } from "@/components/admin/SettingsForm";

export default async function AdminSettingsPage() {
  const supabase = createAdminClient();
  const { data } = await supabase.rpc("get_public_snapshot");
  const snapshot = data as PublicSnapshot;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Event settings</h1>
      <SettingsForm event={snapshot.event} />
    </div>
  );
}
