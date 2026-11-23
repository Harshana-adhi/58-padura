# 58 පැදුර — event control panel

Next.js (App Router) + Supabase Postgres + Vercel. One public page at `/`,
one admin panel at `/admin/*`, one database as the source of truth. See
the architecture plan for the full design; this file covers only local
setup.

## Setup

1. **Supabase project.** Create a project (Singapore region), then apply
   the migrations in order:
   ```bash
   supabase link --project-ref <your-ref>
   supabase db push
   ```
   This creates the schema, RLS policies, admin functions and the
   `branding` storage bucket, and seeds the default categories.

2. **Env vars.** Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from
     Supabase project settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` — same page. **Never** prefix this with
     `NEXT_PUBLIC_`.
   - `ADMIN_PASSCODE_HASH` — generate with:
     ```bash
     node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" "your-passcode-here"
     ```
   - `SESSION_SECRET` — generate with:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     ```

3. **Install and run:**
   ```bash
   npm install
   npm run dev
   ```
   Public site: http://localhost:3000. Admin: http://localhost:3000/admin/login.

## Tests

```bash
npm test
```
Covers the pure timing/drift maths (`lib/timing.ts`) and the allowed
status transitions (`lib/transitions.ts`) — the logic that must not
break during the live event.

## Where things live

- `supabase/migrations/` — schema, RLS, admin functions. Applied with
  `supabase db push`; nobody edits tables by hand in the dashboard.
- `lib/timing.ts`, `lib/transitions.ts` — pure, unit-tested logic shared
  by the public page and the admin panel.
- `lib/live/LiveEventProvider.tsx` — realtime subscription, clock offset,
  resync and polling fallback for the public page.
- `server/actions/` — Server Actions; every one calls `requireAdmin()`
  before touching an `admin_*` database function.
- `app/(public)/page.tsx` — the public page.
- `app/admin/(panel)/` — the admin panel routes.

## Status

Phase 1–4 of the plan are built and type-checked: repo, schema, auth,
settings, logo upload, snapshot API, countdown, realtime broadcast,
agenda management with drag-to-reorder (dnd-kit, locked items excluded),
all event/item transitions, the Adjust-schedule dialog with a live
before/after preview, Undo (10-second toast + History page), and
admin-side live ticking via the same `LiveEventProvider` the public
page uses. Build, typecheck, lint and all 21 Vitest cases pass.

Still open: History filters/CSV export, Playwright smoke tests (per the
plan, replaced by a manual test script until after the event), and
anything that needs a real Supabase/Vercel project — nothing has been
deployed yet.
