-- 58 පැදුර — initial schema, RLS and admin functions
-- Applied with: supabase db push

-- ============================================================
-- Enums
-- ============================================================

create type event_status as enum ('upcoming','live','paused','completed');
create type item_status  as enum ('upcoming','ongoing','paused','completed','skipped','cancelled');

-- ============================================================
-- Tables
-- ============================================================

create table event_settings (
  id              smallint primary key default 1 check (id = 1), -- singleton
  name            text not null check (char_length(name) between 1 and 120),
  description     text check (char_length(description) <= 2000),
  venue           text check (char_length(venue) <= 200),
  logo_url        text,
  timezone        text not null default 'Asia/Colombo',
  starts_at       timestamptz not null,
  status          event_status not null default 'upcoming',
  live_started_at timestamptz,
  paused_at       timestamptz,
  completed_at    timestamptz,
  baseline_locked boolean not null default false,
  state_version   bigint not null default 0,
  updated_at      timestamptz not null default now()
);

create table categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 40),
  color      text not null default 'slate',
  sort_order int  not null default 0,
  is_builtin boolean not null default false
);
create unique index categories_name_ci on categories (lower(name));

create table agenda_items (
  id                 uuid primary key default gen_random_uuid(),
  item_number        int  not null,
  display_order      int  not null,
  title              text not null check (char_length(title) between 1 and 150),
  description        text check (char_length(description) <= 1000),
  category_id        uuid not null references categories(id) on delete restrict,
  planned_start_at   timestamptz not null,
  scheduled_start_at timestamptz not null,
  duration_minutes   int  not null check (duration_minutes between 1 and 600),
  is_time_fixed      boolean not null default false,
  status             item_status not null default 'upcoming',
  actual_start_at    timestamptz,
  actual_end_at      timestamptz,
  paused_at          timestamptz,
  paused_total       interval not null default '0',
  deleted_at         timestamptz,
  row_version        int  not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check ((status = 'paused') = (paused_at is not null)),
  check (status not in ('ongoing','paused','completed') or actual_start_at is not null),
  check (status <> 'completed' or actual_end_at is not null),
  check (actual_end_at is null or actual_end_at >= actual_start_at)
);

-- at most one item running or paused, enforced by the database itself
create unique index one_active_item on agenda_items ((true))
  where status in ('ongoing','paused') and deleted_at is null;
create unique index agenda_order on agenda_items (display_order) where deleted_at is null;
create index agenda_status on agenda_items (status) where deleted_at is null;
-- item numbers are fixed labels: unique, never renumbered on reorder
create unique index agenda_number on agenda_items (item_number) where deleted_at is null;

create table activity_log (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  action           text not null,
  item_id          uuid references agenda_items(id),
  operator         text,
  previous_values  jsonb,
  new_values       jsonb,
  state_version    bigint not null,
  client_action_id uuid unique,
  undone_by        bigint references activity_log(id)
);
create index activity_recent on activity_log (created_at desc);
create index activity_item   on activity_log (item_id, created_at desc);

create table admin_sessions (
  id         uuid primary key default gen_random_uuid(),
  operator   text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table admin_login_attempts (
  ip_hash      text not null,
  attempted_at timestamptz not null default now(),
  succeeded    boolean not null
);
create index login_attempts_recent on admin_login_attempts (ip_hash, attempted_at desc);

-- ============================================================
-- updated_at triggers
-- ============================================================

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger event_settings_updated_at before update on event_settings
  for each row execute function set_updated_at();
create trigger agenda_items_updated_at before update on agenda_items
  for each row execute function set_updated_at();

-- ============================================================
-- Seed data
-- ============================================================

insert into event_settings (id, name, starts_at, timezone)
values (1, '58 පැදුර', (now() + interval '7 days'), 'Asia/Colombo');

insert into categories (name, color, sort_order, is_builtin) values
  ('Music',   'violet', 0, true),
  ('Drama',   'amber',  1, true),
  ('Dancing', 'rose',   2, true),
  ('Other',   'slate',  3, true);

-- ============================================================
-- Row level security
-- ============================================================

alter table event_settings        enable row level security;
alter table categories            enable row level security;
alter table agenda_items          enable row level security;
alter table activity_log          enable row level security;
alter table admin_sessions        enable row level security;
alter table admin_login_attempts  enable row level security;

create policy event_settings_read on event_settings
  for select using (true);

create policy categories_read on categories
  for select using (true);

create policy agenda_items_read on agenda_items
  for select using (deleted_at is null);

-- no policies on activity_log, admin_sessions, admin_login_attempts:
-- RLS is on with zero policies, so anon/authenticated get nothing.

-- ============================================================
-- Public read function: one round trip for the whole snapshot
-- ============================================================

create or replace function get_public_snapshot()
returns jsonb
language sql
security invoker
stable
as $$
  select jsonb_build_object(
    'version', s.state_version,
    'server_time', clock_timestamp(),
    'event', jsonb_build_object(
      'name', s.name,
      'description', s.description,
      'venue', s.venue,
      'logo_url', s.logo_url,
      'timezone', s.timezone,
      'starts_at', s.starts_at,
      'status', s.status,
      'live_started_at', s.live_started_at,
      'paused_at', s.paused_at,
      'completed_at', s.completed_at,
      'baseline_locked', s.baseline_locked,
      'state_version', s.state_version
    ),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'color', c.color,
        'sort_order', c.sort_order, 'is_builtin', c.is_builtin
      ) order by c.sort_order)
      from categories c
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'item_number', i.item_number,
        'display_order', i.display_order,
        'title', i.title,
        'description', i.description,
        'category_id', i.category_id,
        'planned_start_at', i.planned_start_at,
        'scheduled_start_at', i.scheduled_start_at,
        'duration_minutes', i.duration_minutes,
        'is_time_fixed', i.is_time_fixed,
        'status', i.status,
        'actual_start_at', i.actual_start_at,
        'actual_end_at', i.actual_end_at,
        'paused_at', i.paused_at,
        'paused_total_seconds', extract(epoch from i.paused_total),
        'row_version', i.row_version
      ) order by i.display_order)
      from agenda_items i
      where i.deleted_at is null
    ), '[]'::jsonb)
  )
  from event_settings s
  where s.id = 1;
$$;

grant execute on function get_public_snapshot() to anon, authenticated;

-- ============================================================
-- Time zone conversion — the one place local Sri Lanka time
-- becomes a UTC timestamptz. Everything else only ever
-- stores/reads timestamptz and formats for display client-side.
-- ============================================================

create or replace function to_utc_from_colombo(p_local text)
returns timestamptz
language sql immutable as $$
  select (p_local::timestamp) at time zone 'Asia/Colombo';
$$;

grant execute on function to_utc_from_colombo(text) to service_role;

-- ============================================================
-- Admin functions
-- All run as the function owner (security definer) because the
-- browser only ever holds the anon key; the Server Action is the
-- only caller, and it is gated by requireAdmin() first.
-- EXECUTE is revoked from public/anon/authenticated below.
-- ============================================================

create or replace function _bump_version() returns bigint
language sql as $$
  update event_settings set state_version = state_version + 1 where id = 1
  returning state_version;
$$;

create or replace function _log(
  p_action text, p_item_id uuid, p_operator text,
  p_previous jsonb, p_new jsonb, p_version bigint, p_client_action_id uuid
) returns void language plpgsql as $$
begin
  if p_client_action_id is not null then
    if exists (select 1 from activity_log where client_action_id = p_client_action_id) then
      return; -- idempotent: double-click already recorded
    end if;
  end if;
  insert into activity_log (action, item_id, operator, previous_values, new_values, state_version, client_action_id)
  values (p_action, p_item_id, p_operator, p_previous, p_new, p_version, p_client_action_id);
end;
$$;

-- ---- event settings -----------------------------------------------------

create or replace function admin_update_settings(
  p_name text, p_description text, p_venue text, p_logo_url text,
  p_starts_at timestamptz, p_shift_agenda boolean,
  p_operator text, p_client_action_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_old event_settings;
  v_shift interval;
  v_version bigint;
begin
  perform pg_advisory_xact_lock(1);
  select * into v_old from event_settings where id = 1 for update;

  if p_shift_agenda and v_old.starts_at is distinct from p_starts_at then
    v_shift := p_starts_at - v_old.starts_at;
    update agenda_items
      set planned_start_at = planned_start_at + v_shift,
          scheduled_start_at = scheduled_start_at + v_shift
      where deleted_at is null and not v_old.baseline_locked;
  end if;

  update event_settings set
    name = coalesce(p_name, name),
    description = p_description,
    venue = p_venue,
    logo_url = coalesce(p_logo_url, logo_url),
    starts_at = coalesce(p_starts_at, starts_at)
  where id = 1;

  v_version := _bump_version();
  perform _log('settings.update', null, p_operator, to_jsonb(v_old), get_public_snapshot()->'event', v_version, p_client_action_id);
  perform realtime.send(jsonb_build_object('v', v_version), 'state', 'event-58', false);
  return get_public_snapshot();
end;
$$;

-- ---- event lifecycle ------------------------------------------------------

create or replace function admin_start_event(p_operator text, p_client_action_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old event_settings; v_version bigint;
begin
  perform pg_advisory_xact_lock(1);
  select * into v_old from event_settings where id = 1 for update;
  if v_old.status <> 'upcoming' then
    raise exception 'Event is already % ', v_old.status;
  end if;
  update event_settings set status = 'live', live_started_at = now(), baseline_locked = true where id = 1;
  v_version := _bump_version();
  perform _log('event.start', null, p_operator, to_jsonb(v_old), jsonb_build_object('status','live'), v_version, p_client_action_id);
  perform realtime.send(jsonb_build_object('v', v_version), 'state', 'event-58', false);
  return get_public_snapshot();
end;
$$;

create or replace function admin_pause_event(p_operator text, p_client_action_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old event_settings; v_version bigint; v_item agenda_items;
begin
  perform pg_advisory_xact_lock(1);
  select * into v_old from event_settings where id = 1 for update;
  if v_old.status <> 'live' then
    raise exception 'Event is not live';
  end if;
  update event_settings set status = 'paused', paused_at = now() where id = 1;

  select * into v_item from agenda_items where status = 'ongoing' and deleted_at is null for update;
  if found then
    update agenda_items set status = 'paused', paused_at = now() where id = v_item.id;
  end if;

  v_version := _bump_version();
  perform _log('event.pause', v_item.id, p_operator, to_jsonb(v_old), jsonb_build_object('status','paused'), v_version, p_client_action_id);
  perform realtime.send(jsonb_build_object('v', v_version), 'state', 'event-58', false);
  return get_public_snapshot();
end;
$$;

create or replace function admin_resume_event(p_operator text, p_client_action_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old event_settings; v_version bigint; v_item agenda_items;
begin
  perform pg_advisory_xact_lock(1);
  select * into v_old from event_settings where id = 1 for update;
  if v_old.status <> 'paused' then
    raise exception 'Event is not paused';
  end if;
  update event_settings set status = 'live', paused_at = null where id = 1;

  select * into v_item from agenda_items where status = 'paused' and deleted_at is null for update;
  if found then
    update agenda_items
      set status = 'ongoing',
          paused_total = paused_total + (now() - v_item.paused_at),
          paused_at = null
      where id = v_item.id;
  end if;

  v_version := _bump_version();
  perform _log('event.resume', v_item.id, p_operator, to_jsonb(v_old), jsonb_build_object('status','live'), v_version, p_client_action_id);
  perform realtime.send(jsonb_build_object('v', v_version), 'state', 'event-58', false);
  return get_public_snapshot();
end;
$$;

create or replace function admin_complete_event(p_operator text, p_skip_remaining boolean, p_client_action_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old event_settings; v_version bigint;
begin
  perform pg_advisory_xact_lock(1);
  select * into v_old from event_settings where id = 1 for update;
  if exists (select 1 from agenda_items where status in ('ongoing','paused') and deleted_at is null) then
    raise exception 'An item is still running';
  end if;
  if p_skip_remaining then
    update agenda_items set status = 'skipped' where status = 'upcoming' and deleted_at is null;
  end if;
  update event_settings set status = 'completed', completed_at = now() where id = 1;
  v_version := _bump_version();
  perform _log('event.complete', null, p_operator, to_jsonb(v_old), jsonb_build_object('status','completed'), v_version, p_client_action_id);
  perform realtime.send(jsonb_build_object('v', v_version), 'state', 'event-58', false);
  return get_public_snapshot();
end;
$$;

-- ---- item lifecycle --------------------------------------------------------

create or replace function admin_start_item(p_item_id uuid, p_operator text, p_client_action_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old agenda_items; v_settings event_settings; v_version bigint;
begin
  perform pg_advisory_xact_lock(1);
  select * into v_settings from event_settings where id = 1 for update;
  if v_settings.status <> 'live' then
    raise exception 'Event is not live';
  end if;
  if exists (select 1 from agenda_items where status in ('ongoing','paused') and deleted_at is null) then
    raise exception 'Another item is already running';
  end if;

  select * into v_old from agenda_items where id = p_item_id and deleted_at is null for update;
  if not found then
    raise exception 'Item not found';
  end if;
  if v_old.status <> 'upcoming' then
    raise exception 'Item #% is not upcoming', v_old.item_number;
  end if;

  update agenda_items set status = 'ongoing', actual_start_at = now() where id = p_item_id;
  v_version := _bump_version();
  perform _log('item.start', p_item_id, p_operator, to_jsonb(v_old), jsonb_build_object('status','ongoing'), v_version, p_client_action_id);
  perform realtime.send(jsonb_build_object('v', v_version), 'state', 'event-58', false);
  return get_public_snapshot();
end;
$$;

create or replace function admin_pause_item(p_item_id uuid, p_operator text, p_client_action_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old agenda_items; v_version bigint;
begin
  perform pg_advisory_xact_lock(1);
  select * into v_old from agenda_items where id = p_item_id and deleted_at is null for update;
  if not found then raise exception 'Item not found'; end if;
  if v_old.status <> 'ongoing' then raise exception 'Item #% is not running', v_old.item_number; end if;

  update agenda_items set status = 'paused', paused_at = now() where id = p_item_id;
  v_version := _bump_version();
  perform _log('item.pause', p_item_id, p_operator, to_jsonb(v_old), jsonb_build_object('status','paused'), v_version, p_client_action_id);
  perform realtime.send(jsonb_build_object('v', v_version), 'state', 'event-58', false);
  return get_public_snapshot();
end;
$$;

create or replace function admin_resume_item(p_item_id uuid, p_operator text, p_client_action_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old agenda_items; v_version bigint;
begin
  perform pg_advisory_xact_lock(1);
  select * into v_old from agenda_items where id = p_item_id and deleted_at is null for update;
  if not found then raise exception 'Item not found'; end if;
  if v_old.status <> 'paused' then raise exception 'Item #% is not paused', v_old.item_number; end if;

  update agenda_items
    set status = 'ongoing',
        paused_total = paused_total + (now() - v_old.paused_at),
        paused_at = null
    where id = p_item_id;
  v_version := _bump_version();
  perform _log('item.resume', p_item_id, p_operator, to_jsonb(v_old), jsonb_build_object('status','ongoing'), v_version, p_client_action_id);
  perform realtime.send(jsonb_build_object('v', v_version), 'state', 'event-58', false);
  return get_public_snapshot();
end;
$$;

create or replace function admin_complete_item(p_item_id uuid, p_operator text, p_start_next_id uuid default null, p_client_action_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old agenda_items; v_version bigint; v_next agenda_items; v_settings event_settings;
begin
  perform pg_advisory_xact_lock(1);
  select * into v_old from agenda_items where id = p_item_id and deleted_at is null for update;
  if not found then raise exception 'Item not found'; end if;
  if v_old.status not in ('ongoing','paused') then
    raise exception 'Item #% is not running', v_old.item_number;
  end if;

  update agenda_items set
    status = 'completed',
    actual_end_at = now(),
    paused_total = case when v_old.status = 'paused' then v_old.paused_total + (now() - v_old.paused_at) else v_old.paused_total end,
    paused_at = null
  where id = p_item_id;

  v_version := _bump_version();
  perform _log('item.complete', p_item_id, p_operator, to_jsonb(v_old), jsonb_build_object('status','completed'), v_version, p_client_action_id);

  if p_start_next_id is not null then
    select * into v_settings from event_settings where id = 1 for update;
    select * into v_next from agenda_items where id = p_start_next_id and deleted_at is null for update;
    if found and v_next.status = 'upcoming' and v_settings.status = 'live' then
      update agenda_items set status = 'ongoing', actual_start_at = now() where id = p_start_next_id;
      v_version := _bump_version();
      perform _log('item.start', p_start_next_id, p_operator, to_jsonb(v_next), jsonb_build_object('status','ongoing'), v_version, null);
    end if;
  end if;

  perform realtime.send(jsonb_build_object('v', v_version), 'state', 'event-58', false);
  return get_public_snapshot();
end;
$$;

create or replace function admin_skip_item(p_item_id uuid, p_operator text, p_client_action_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old agenda_items; v_version bigint;
begin
  perform pg_advisory_xact_lock(1);
  select * into v_old from agenda_items where id = p_item_id and deleted_at is null for update;
  if not found then raise exception 'Item not found'; end if;
  if v_old.status <> 'upcoming' then raise exception 'Only upcoming items can be skipped'; end if;

  update agenda_items set status = 'skipped' where id = p_item_id;
  v_version := _bump_version();
  perform _log('item.skip', p_item_id, p_operator, to_jsonb(v_old), jsonb_build_object('status','skipped'), v_version, p_client_action_id);
  perform realtime.send(jsonb_build_object('v', v_version), 'state', 'event-58', false);
  return get_public_snapshot();
end;
$$;

create or replace function admin_cancel_item(p_item_id uuid, p_operator text, p_client_action_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old agenda_items; v_version bigint;
begin
  perform pg_advisory_xact_lock(1);
  select * into v_old from agenda_items where id = p_item_id and deleted_at is null for update;
  if not found then raise exception 'Item not found'; end if;
  if v_old.status not in ('upcoming','ongoing','paused') then
    raise exception 'Item #% cannot be cancelled', v_old.item_number;
  end if;

  update agenda_items set
    status = 'cancelled',
    actual_end_at = case when v_old.actual_start_at is not null then now() else null end,
    paused_at = null
  where id = p_item_id;

  v_version := _bump_version();
  perform _log('item.cancel', p_item_id, p_operator, to_jsonb(v_old), jsonb_build_object('status','cancelled'), v_version, p_client_action_id);
  perform realtime.send(jsonb_build_object('v', v_version), 'state', 'event-58', false);
  return get_public_snapshot();
end;
$$;

create or replace function admin_restore_item(p_item_id uuid, p_display_order int, p_operator text, p_client_action_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old agenda_items; v_version bigint;
begin
  perform pg_advisory_xact_lock(1);
  select * into v_old from agenda_items where id = p_item_id and deleted_at is null for update;
  if not found then raise exception 'Item not found'; end if;
  if v_old.status not in ('skipped','cancelled') then
    raise exception 'Only skipped or cancelled items can be restored';
  end if;

  update agenda_items set
    status = 'upcoming',
    display_order = p_display_order,
    actual_start_at = null, actual_end_at = null, paused_at = null, paused_total = '0'
  where id = p_item_id;

  v_version := _bump_version();
  perform _log('item.restore', p_item_id, p_operator, to_jsonb(v_old), jsonb_build_object('status','upcoming'), v_version, p_client_action_id);
  perform realtime.send(jsonb_build_object('v', v_version), 'state', 'event-58', false);
  return get_public_snapshot();
end;
$$;

create or replace function admin_delete_item(p_item_id uuid, p_operator text, p_client_action_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old agenda_items; v_version bigint;
begin
  perform pg_advisory_xact_lock(1);
  select * into v_old from agenda_items where id = p_item_id and deleted_at is null for update;
  if not found then raise exception 'Item not found'; end if;
  if v_old.status not in ('upcoming','skipped','cancelled') then
    raise exception 'Items that have run cannot be deleted';
  end if;

  update agenda_items set deleted_at = now() where id = p_item_id;
  v_version := _bump_version();
  perform _log('item.delete', p_item_id, p_operator, to_jsonb(v_old), null, v_version, p_client_action_id);
  perform realtime.send(jsonb_build_object('v', v_version), 'state', 'event-58', false);
  return get_public_snapshot();
end;
$$;

-- ---- agenda editing ---------------------------------------------------------

create or replace function admin_upsert_item(
  p_id uuid, p_item_number int, p_title text, p_description text,
  p_category_id uuid, p_scheduled_start_at timestamptz, p_duration_minutes int,
  p_is_time_fixed boolean, p_display_order int, p_expected_version int,
  p_operator text, p_client_action_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_old agenda_items; v_version bigint; v_id uuid; v_order int;
begin
  perform pg_advisory_xact_lock(1);

  if p_id is not null then
    select * into v_old from agenda_items where id = p_id and deleted_at is null for update;
    if not found then raise exception 'Item not found'; end if;
    if p_expected_version is not null and v_old.row_version <> p_expected_version then
      raise exception 'CONFLICT: Changed by another operator, reloaded';
    end if;

    update agenda_items set
      item_number = coalesce(p_item_number, item_number),
      title = p_title,
      description = p_description,
      category_id = p_category_id,
      scheduled_start_at = p_scheduled_start_at,
      duration_minutes = p_duration_minutes,
      is_time_fixed = p_is_time_fixed,
      row_version = row_version + 1
    where id = p_id;
    v_id := p_id;
  else
    select coalesce(max(display_order), 0) + 1 into v_order from agenda_items where deleted_at is null;
    insert into agenda_items (
      item_number, display_order, title, description, category_id,
      planned_start_at, scheduled_start_at, duration_minutes, is_time_fixed
    ) values (
      p_item_number, coalesce(p_display_order, v_order), p_title, p_description, p_category_id,
      p_scheduled_start_at, p_scheduled_start_at, p_duration_minutes, coalesce(p_is_time_fixed, false)
    ) returning id into v_id;
  end if;

  v_version := _bump_version();
  perform _log(case when p_id is null then 'item.create' else 'item.update' end,
               v_id, p_operator, to_jsonb(v_old), (select to_jsonb(a) from agenda_items a where a.id = v_id), v_version, p_client_action_id);
  perform realtime.send(jsonb_build_object('v', v_version), 'state', 'event-58', false);
  return get_public_snapshot();
end;
$$;

create or replace function admin_reorder_items(p_ids uuid[], p_expected_version bigint, p_operator text, p_client_action_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_version bigint; v_old_settings event_settings; i int;
begin
  perform pg_advisory_xact_lock(1);
  select * into v_old_settings from event_settings where id = 1 for update;
  if p_expected_version is not null and v_old_settings.state_version <> p_expected_version then
    raise exception 'CONFLICT: Changed by another operator, reloaded';
  end if;

  -- shift into a disjoint range first so the partial unique index never collides mid-update
  for i in 1 .. array_length(p_ids, 1) loop
    update agenda_items set display_order = display_order + 1000000 where id = p_ids[i] and deleted_at is null;
  end loop;
  for i in 1 .. array_length(p_ids, 1) loop
    update agenda_items set display_order = i where id = p_ids[i] and deleted_at is null;
  end loop;

  v_version := _bump_version();
  perform _log('agenda.reorder', null, p_operator, null, jsonb_build_object('ids', p_ids), v_version, p_client_action_id);
  perform realtime.send(jsonb_build_object('v', v_version), 'state', 'event-58', false);
  return get_public_snapshot();
end;
$$;

create or replace function admin_adjust_schedule(
  p_mode text, p_minutes int, p_item_ids uuid[], p_operator text, p_client_action_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_version bigint; v_shift interval; v_item record; v_prev_end timestamptz;
begin
  perform pg_advisory_xact_lock(1);

  if p_mode = 'shift_all' then
    v_shift := make_interval(mins => coalesce(p_minutes, 0));
    update agenda_items set scheduled_start_at = scheduled_start_at + v_shift
      where status = 'upcoming' and deleted_at is null and not is_time_fixed;

  elsif p_mode = 'shift_selected' then
    v_shift := make_interval(mins => coalesce(p_minutes, 0));
    update agenda_items set scheduled_start_at = scheduled_start_at + v_shift
      where id = any(p_item_ids) and status = 'upcoming' and deleted_at is null and not is_time_fixed;

  elsif p_mode = 'reflow' then
    select coalesce(
      (select actual_start_at + paused_total + make_interval(mins => duration_minutes)
         from agenda_items where status in ('ongoing','paused') and deleted_at is null),
      now()
    ) into v_prev_end;

    for v_item in
      select id, duration_minutes, is_time_fixed from agenda_items
      where status = 'upcoming' and deleted_at is null order by display_order
    loop
      if v_item.is_time_fixed then
        select scheduled_start_at into v_prev_end from agenda_items where id = v_item.id;
        v_prev_end := v_prev_end + make_interval(mins => v_item.duration_minutes);
      else
        update agenda_items set scheduled_start_at = v_prev_end where id = v_item.id;
        v_prev_end := v_prev_end + make_interval(mins => v_item.duration_minutes);
      end if;
    end loop;
  elsif p_mode = 'none' then
    null; -- drift badge stays, nothing changes
  else
    raise exception 'Unknown adjust mode: %', p_mode;
  end if;

  v_version := _bump_version();
  perform _log('schedule.adjust', null, p_operator, null, jsonb_build_object('mode', p_mode, 'minutes', p_minutes), v_version, p_client_action_id);
  perform realtime.send(jsonb_build_object('v', v_version), 'state', 'event-58', false);
  return get_public_snapshot();
end;
$$;

-- ---- categories -------------------------------------------------------------

create or replace function admin_upsert_category(
  p_id uuid, p_name text, p_color text, p_sort_order int, p_operator text, p_client_action_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_version bigint;
begin
  if p_id is not null then
    update categories set name = p_name, color = p_color, sort_order = coalesce(p_sort_order, sort_order) where id = p_id;
    v_id := p_id;
  else
    insert into categories (name, color, sort_order) values (p_name, p_color, coalesce(p_sort_order, 0)) returning id into v_id;
  end if;
  v_version := _bump_version();
  perform _log(case when p_id is null then 'category.create' else 'category.update' end,
               null, p_operator, null, jsonb_build_object('id', v_id, 'name', p_name, 'color', p_color), v_version, p_client_action_id);
  perform realtime.send(jsonb_build_object('v', v_version), 'state', 'event-58', false);
  return get_public_snapshot();
end;
$$;

-- ---- undo -------------------------------------------------------------------

create or replace function admin_undo(p_log_id bigint, p_operator text, p_client_action_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_entry activity_log; v_version bigint; v_later_count int;
begin
  perform pg_advisory_xact_lock(1);
  select * into v_entry from activity_log where id = p_log_id for update;
  if not found then raise exception 'Log entry not found'; end if;
  if v_entry.undone_by is not null then raise exception 'Already undone'; end if;

  if v_entry.item_id is not null then
    select count(*) into v_later_count from activity_log
      where item_id = v_entry.item_id and id > p_log_id;
    if v_later_count > 0 then
      raise exception 'Cannot undo: a later action has already changed this item';
    end if;

    if v_entry.previous_values is not null then
      update agenda_items set
        status = (v_entry.previous_values->>'status')::item_status,
        actual_start_at = (v_entry.previous_values->>'actual_start_at')::timestamptz,
        actual_end_at = (v_entry.previous_values->>'actual_end_at')::timestamptz,
        paused_at = (v_entry.previous_values->>'paused_at')::timestamptz,
        paused_total = coalesce((v_entry.previous_values->>'paused_total')::interval, '0'),
        deleted_at = (v_entry.previous_values->>'deleted_at')::timestamptz
      where id = v_entry.item_id;
    end if;
  end if;

  v_version := _bump_version();
  insert into activity_log (action, item_id, operator, previous_values, new_values, state_version, client_action_id)
  values ('undo', v_entry.item_id, p_operator, v_entry.new_values, v_entry.previous_values, v_version, p_client_action_id)
  returning id into v_entry.undone_by;

  update activity_log set undone_by = v_entry.undone_by where id = p_log_id;

  perform realtime.send(jsonb_build_object('v', v_version), 'state', 'event-58', false);
  return get_public_snapshot();
end;
$$;

-- ============================================================
-- Lock down EXECUTE: Supabase exposes public-schema functions
-- over the API by default, so this revoke is essential.
-- ============================================================

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function get_public_snapshot() to anon, authenticated;
-- admin_* functions are called only via the service-role key from Server Actions.
-- service_role bypasses RLS but not EXECUTE grants, so it needs them explicitly;
-- anon and authenticated are never granted access to any admin_* function.
grant execute on all functions in schema public to service_role;
