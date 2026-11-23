"use client";

import { useState } from "react";
import { updateSettingsAction, uploadLogoAction } from "@/server/actions/settings";
import type { EventSnapshot } from "@/lib/types";

function toLocalInputValue(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function SettingsForm({ event }: { event: EventSnapshot }) {
  const [logoUrl, setLogoUrl] = useState(event.logo_url ?? "");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleLogoChange(file: File | null) {
    if (!file) return;
    setUploading(true);
    const result = await uploadLogoAction(file);
    setUploading(false);
    if (result.ok && result.url) {
      setLogoUrl(result.url);
    } else {
      setMessage({ ok: false, text: result.error ?? "Upload failed." });
    }
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    formData.set("logoUrl", logoUrl);
    const result = await updateSettingsAction(formData);
    setPending(false);
    setMessage({ ok: result.ok, text: result.ok ? "Saved." : result.error ?? "Could not save." });
  }

  return (
    <form action={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input name="name" defaultValue={event.name} required maxLength={120} className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Description
        <textarea name="description" defaultValue={event.description ?? ""} maxLength={2000} rows={3} className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Venue
        <input name="venue" defaultValue={event.venue ?? ""} maxLength={200} className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Date &amp; start time (Sri Lanka time)
        <input
          name="startsAt"
          type="datetime-local"
          defaultValue={toLocalInputValue(event.starts_at, event.timezone)}
          required
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Logo
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)}
          className="text-xs"
        />
        {uploading && <span className="text-xs text-stage-muted">Uploading…</span>}
        {logoUrl && <img src={logoUrl} alt="" className="mt-2 h-16 w-16 rounded-lg object-cover" />}
      </label>
      {!event.baseline_locked && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="shiftAgenda" />
          Shift whole agenda by the same amount?
        </label>
      )}
      {message && <p className={`text-sm ${message.ok ? "text-green" : "text-red"}`}>{message.text}</p>}
      <button type="submit" disabled={pending} className="w-fit rounded-md bg-accent px-4 py-2 font-medium text-accent-foreground disabled:opacity-60">
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
