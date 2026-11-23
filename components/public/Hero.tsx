import Image from "next/image";
import { formatDate } from "@/lib/format";
import type { EventSnapshot } from "@/lib/types";

export function Hero({ event }: { event: EventSnapshot }) {
  return (
    <header className="flex flex-col items-center gap-4 px-6 pt-16 pb-10 text-center">
      {event.logo_url ? (
        <Image src={event.logo_url} alt="" width={96} height={96} className="rounded-2xl" />
      ) : (
        <div className="h-20 w-20 rounded-2xl bg-stage-raised ring-1 ring-stage-border" aria-hidden />
      )}
      <h1 className="font-sin text-4xl font-bold tracking-tight sm:text-5xl">{event.name}</h1>
      {event.description && <p className="max-w-xl text-stage-muted">{event.description}</p>}
      <p className="text-sm text-stage-muted">
        {formatDate(event.starts_at, event.timezone)}
        {event.venue ? ` · ${event.venue}` : ""}
      </p>
    </header>
  );
}
