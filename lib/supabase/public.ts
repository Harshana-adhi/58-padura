// Browser-safe client. Only ever holds the anon key, which RLS
// restricts to read-only access on three tables (see migration 0001).
import { createBrowserClient } from "@supabase/ssr";

export function createPublicClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
