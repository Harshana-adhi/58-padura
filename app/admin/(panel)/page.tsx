import { createAdminClient } from "@/lib/supabase/admin";
import type { PublicSnapshot } from "@/lib/types";
import { DashboardView } from "@/components/admin/DashboardView";

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();
  const { data } = await supabase.rpc("get_public_snapshot");
  return <DashboardView initialSnapshot={data as PublicSnapshot} />;
}
