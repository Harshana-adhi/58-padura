import type { ItemStatus } from "@/lib/types";

const LABEL: Record<ItemStatus, string> = {
  upcoming: "Upcoming",
  ongoing: "Ongoing",
  paused: "Paused",
  completed: "Completed",
  skipped: "Skipped",
  cancelled: "Cancelled",
};

const DOT: Record<ItemStatus, string> = {
  upcoming: "bg-stage-muted",
  ongoing: "bg-green-400",
  paused: "bg-amber",
  completed: "bg-accent",
  skipped: "bg-stage-muted",
  cancelled: "bg-red",
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-stage-muted">
      <span className={`h-2 w-2 rounded-full ${DOT[status]}`} aria-hidden />
      {LABEL[status]}
    </span>
  );
}
