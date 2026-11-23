import { createAdminClient } from "@/lib/supabase/admin";
import type { PublicSnapshot } from "@/lib/types";
import { AgendaManager } from "@/components/admin/AgendaManager";

export default async function AdminAgendaPage() {
  const supabase = createAdminClient();
  const { data } = await supabase.rpc("get_public_snapshot");
  return <AgendaManager initialSnapshot={data as PublicSnapshot} />;
}
