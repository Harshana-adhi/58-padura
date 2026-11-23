"use server";

import { requireAdmin } from "@/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { settingsSchema } from "@/validation/settings";
import { callAdminRpc, type ActionResult } from "./helpers";

export type { ActionResult };

/** Converts a "YYYY-MM-DDTHH:mm" local input into a UTC ISO string via Postgres. */
async function colomboLocalToUtcIso(local: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("to_utc_from_colombo", { p_local: local });
  if (error) throw error;
  return data as string;
}

export async function updateSettingsAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = settingsSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    venue: formData.get("venue") || null,
    startsAt: formData.get("startsAt"),
    shiftAgenda: formData.get("shiftAgenda") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the form fields." };
  }

  let startsAtIso: string;
  try {
    startsAtIso = await colomboLocalToUtcIso(parsed.data.startsAt);
  } catch {
    return { ok: false, error: "Could not read that date and time." };
  }

  const logoUrl = (formData.get("logoUrl") as string) || null;

  return callAdminRpc("admin_update_settings", {
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_venue: parsed.data.venue,
    p_logo_url: logoUrl,
    p_starts_at: startsAtIso,
    p_shift_agenda: parsed.data.shiftAgenda,
    p_operator: session.operator,
  });
}

export async function uploadLogoAction(file: File): Promise<{ ok: boolean; url?: string; error?: string }> {
  await requireAdmin();

  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) {
    return { ok: false, error: "Only PNG, JPEG or WebP logos are allowed." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: "Logo must be 2 MB or smaller." };
  }

  const supabase = createAdminClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `logo-${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("branding").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return { ok: false, error: error.message };

  const { data } = supabase.storage.from("branding").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
