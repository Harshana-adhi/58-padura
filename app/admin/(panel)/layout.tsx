import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logoutAction } from "@/server/actions/auth";
import type { PublicSnapshot } from "@/lib/types";
import { AdminTopBar } from "@/components/admin/AdminTopBar";

// Every admin page reads the live snapshot and the session cookie,
// so none of this should ever be statically prerendered.
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/agenda", label: "Agenda" },
  { href: "/admin/live", label: "Live control" },
  { href: "/admin/history", label: "History" },
];

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  let operator: string;
  try {
    operator = (await requireAdmin()).operator;
  } catch {
    redirect("/admin/login");
  }

  const supabase = createAdminClient();
  const { data } = await supabase.rpc("get_public_snapshot");
  const snapshot = data as PublicSnapshot;

  return (
    <div className="flex min-h-screen flex-col bg-stage text-stage-foreground">
      <AdminTopBar initialSnapshot={snapshot} operator={operator} />
      <div className="flex flex-1">
        <nav className="hidden w-48 flex-col gap-1 border-r border-stage-border p-4 sm:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm text-stage-muted hover:bg-stage-raised hover:text-stage-foreground">
              {item.label}
            </Link>
          ))}
          <form action={logoutAction} className="mt-4">
            <button type="submit" className="w-full rounded-md px-3 py-2 text-left text-sm text-stage-muted hover:bg-stage-raised">
              Sign out
            </button>
          </form>
        </nav>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
