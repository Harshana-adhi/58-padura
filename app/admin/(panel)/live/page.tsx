import { createAdminClient } from "@/lib/supabase/admin";
import type { PublicSnapshot } from "@/lib/types";
import { LiveControl } from "@/components/admin/LiveControl";

export default async function AdminLivePage() {
  const supabase = createAdminClient();
  const { data } = await supabase.rpc("get_public_snapshot");
  return <LiveControl initialSnapshot={data as PublicSnapshot} />;
}
