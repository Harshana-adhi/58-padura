export type EventStatus = "upcoming" | "live" | "paused" | "completed";
export type ItemStatus =
  | "upcoming"
  | "ongoing"
  | "paused"
  | "completed"
  | "skipped"
  | "cancelled";

export interface EventSnapshot {
  name: string;
  description: string | null;
  venue: string | null;
  logo_url: string | null;
  timezone: string;
  starts_at: string;
  status: EventStatus;
  live_started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  baseline_locked: boolean;
  state_version: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_builtin: boolean;
}

export interface AgendaItem {
  id: string;
  item_number: number;
  display_order: number;
  title: string;
  description: string | null;
  category_id: string;
  planned_start_at: string;
  scheduled_start_at: string;
  duration_minutes: number;
  is_time_fixed: boolean;
  status: ItemStatus;
  actual_start_at: string | null;
  actual_end_at: string | null;
  paused_at: string | null;
  paused_total_seconds: number;
  row_version: number;
}

export interface PublicSnapshot {
  version: number;
  server_time: string;
  event: EventSnapshot;
  categories: Category[];
  items: AgendaItem[];
}
