"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSession, destroySession, destroyAllSessions, hashIp } from "@/auth/session";
import { loginSchema } from "@/validation/settings";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;
const FAILURE_DELAY_MS = 500;

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const parsed = loginSchema.safeParse({
    operator: formData.get("operator"),
    passcode: formData.get("passcode"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Enter your name and the passcode." };
  }

  const ip = await clientIp();
  const ipHash = hashIp(ip);
  const supabase = createAdminClient();

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await supabase
    .from("admin_login_attempts")
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .eq("succeeded", false)
    .gte("attempted_at", since);

  if ((count ?? 0) >= MAX_ATTEMPTS) {
    await new Promise((r) => setTimeout(r, FAILURE_DELAY_MS));
    return { ok: false, error: "Too many attempts. Try again later." };
  }

  const hash = process.env.ADMIN_PASSCODE_HASH ?? "";
  const valid = hash.length > 0 && (await bcrypt.compare(parsed.data.passcode, hash));

  await supabase.from("admin_login_attempts").insert({ ip_hash: ipHash, succeeded: valid });

  if (!valid) {
    await new Promise((r) => setTimeout(r, FAILURE_DELAY_MS));
    return { ok: false, error: "Incorrect passcode." };
  }

  await createSession(parsed.data.operator);
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}

export async function signOutAllDevicesAction(): Promise<void> {
  await destroyAllSessions();
  redirect("/admin/login");
}
