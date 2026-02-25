# Mjolnir Attendance

A gym class attendance app: one base weekly timetable, today’s classes derived from it, coaches filter by program and log headcount per class.

## Product vision

- **One base weekly timetable** — Recurring classes (templates) by weekday and time.
- **Today’s classes** — Dashboard shows only today’s classes (timetable + current date in UTC; Iceland = UTC).
- **Coach filtering** — Coaches choose which programs they coach in Profile; dashboard shows only those.
- **Log attendance** — Tap class → enter headcount → save. One log per class occurrence.

## Tech stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS
- Supabase (Auth + Postgres)
- RLS with `is_admin()` and `coach_can_log_for_occurrence()` (no recursion on profiles)

## Prerequisites

- Node.js 18+, npm
- Supabase project

## Setup

### 1. Install and env

```bash
npm install
cp .env.example .env.local
```

Set in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Optional: `NEXT_PUBLIC_APP_URL` (production base URL for reset links; defaults to VERCEL_URL on Vercel, or `http://localhost:3000` locally)

**Password reset links (“Copy reset link” in Admin → Coaches)**  
For the link to work when a coach opens it, add these redirect URLs **in Supabase** (Dashboard → your project → **Authentication** → **URL Configuration** → **Redirect URLs**):

- `http://localhost:3000/auth/callback` (local)
- `https://<your-production-domain>/auth/callback` (e.g. `https://your-app.vercel.app/auth/callback`)

### 2. Database

In Supabase SQL Editor, run **`supabase/schema.sql`** to create:

- **profiles** — `id`, `full_name`, `role` (admin/coach), `coached_programs` (text[])
- **class_templates** — Weekly schedule: `program`, `title`, `weekday`, `start_time`, `location`, `capacity` (no duration)
- **class_occurrences** — One per (template, local_date); created on demand when viewing today
- **attendance_logs** — One per occurrence: `class_occurrence_id`, `headcount`, `created_by`, `created_at`, `updated_at`, `locked` (optional)

**Attendance lock (1 hour after class start)**  
Coaches can log or edit headcount only until **1 hour after the class start time** (UTC). After that, the record is locked; only **admins** can edit (with an explicit “Override” confirmation). Lock is enforced in server logic only (not in RLS). See `src/lib/attendance-lock.ts` and `src/lib/actions/attendance.ts`.

**Existing project?** Run migrations in order (e.g. **`supabase/migrations/`**). Latest: **`20260233_drop_duration_and_simplify_sync.sql`** drops `duration_minutes` from `class_templates` and updates `sync_class_templates` RPC. Schedule setup is **paste-only** (no Google Sheets).

### 3. First admin

- **Dev:** Open `/admin/bootstrap` and click “Make me admin” (only when `NODE_ENV !== 'production'`).
- **Prod:** Create user in Supabase Auth, then in SQL:  
  `UPDATE public.profiles SET role = 'admin' WHERE id = 'user-uuid';`

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Log in → Dashboard shows today’s classes (or empty until templates exist).

## Usage

### Minimal flow

1. **Admin:** Set up the weekly schedule at **Schedule** (`/admin/schedule`) by **pasting a timetable** (TSV: Day, Time, Class name, Sport). Optional location/capacity come from the paste or can be edited later. No duration field.
2. **Coach:** Open **Profile** (`/profile`), tick the programs you coach, Save.
3. **Dashboard:** Shows today’s classes (for coaches: only programs they coach). Tap a class → enter headcount → Log attendance.

### Routes

- `/` — Dashboard (today’s classes; get-or-create occurrences; log headcount)
- `/profile` — Coaches: toggle programs they coach
- `/login` — Email/password sign-in
- `/admin/schedule` — Admin: paste timetable (TSV) to overwrite weekly schedule; view/delete classes
- `/admin/analytics` — Admin Analytics: date range, attendance per slot, avg by program, coach performance, capacity utilization, low-attendance alerts, CSV export (see below)
- `/admin/bootstrap` — Dev-only: make current user admin

### Program registry (keys + labels)

Programs are fixed in **`src/lib/programs.ts`**. Storage uses **keys** (e.g. `bjj`, `vikingathrek`); the UI shows **labels** (e.g. “BJJ”, “Víkingaþrek”). Valid keys: `bjj`, `mma`, `box`, `kickbox`, `vikingathrek`, `vx`, `v6_semi_privates`, `sjalfsvorn`, `heljardaetur`, `mommuthrek`. The database enforces valid program keys on `class_templates.program`. Coaches select which program **keys** they coach in Profile; the dashboard filters today’s classes by `profiles.coached_programs` (keys) and displays labels.

### RLS

- **profiles:** User reads/updates own row; admins read all (`is_admin()`).
- **class_templates:** Authenticated read; admin write.
- **class_occurrences:** Authenticated read/insert.
- **attendance_logs:** Authenticated read; insert/update if `is_admin()` or `coach_can_log_for_occurrence(id)` (SECURITY DEFINER, uses `coached_programs`).

### Attendance lock policy

- **Window:** Coaches can create or update attendance only while `now ≤ class start + 1 hour` (UTC).
- **After the window:** The record is locked. Coaches see a “🔒 Locked” state and cannot edit; if they try, a message explains the 1-hour rule.
- **Admin override:** Admins can always edit. For locked records, the admin must click “Override edit” and confirm in a modal before saving.
- **Single source of truth:** `canEditAttendance(isAdmin, startsAtUtc)` in `src/lib/attendance-lock.ts`. All insert/update goes through `logAttendance()` in `src/lib/actions/attendance.ts`, which enforces the lock.

## Admin Analytics (`/admin/analytics`)

Admins can view attendance analytics for a configurable date range (default: last 8 weeks).

- **Overview** — Total occurrences, logs count, programs; average attendance by program (table + bar chart).
- **Slots** — Attendance per class slot over time: weekly averages, with optional filters by program or specific slot (line chart).
- **Coaches** — Performance by who logged attendance: total logs, average headcount, programs they logged.
- **Utilization** — Capacity utilization (headcount/capacity) by program and by slot; warning if capacity is missing on templates.
- **Alerts** — Low-attendance alerts using per-program thresholds; list of occurrences below threshold; “slots with repeated low attendance”; and **missing logs** (past occurrences with no attendance log).
- **Export** — CSV download: (1) attendance logs (date, time, program, title, location, capacity, headcount, logged_by, logged_at); (2) slot summary (template_id, weekday, time, program, avg headcount, avg utilization, occurrence count).

### Schedule setup (paste timetable only)

On **Admin → Schedule**, the **Paste timetable** section is the only way to load the weekly schedule. Paste a plain-text timetable and overwrite the schedule in one go.

**Format:** Tab- or space-separated columns: **Day**, **Time**, **Class name**, **Sport**. Example row:
```
Mán   12:10   Nogi 201   BJJ
```
You may include an optional header row (e.g. `Day	Time	Class name	Sport`); it is detected and skipped. Empty sport cells are excluded.

**Days:** Sun (0), Mán (1), Þri (2), Mið (3), Fim (4), Fös (5), Lau (6). Case-insensitive.

**Time:** HH:MM (e.g. 12:10, 9:00). Rows with invalid day or time are excluded as “bad day/time”.

**Exclusions:**
- **kids program** — Sport contains *"Barna og unglingastarf"*.
- **missing sport** — Sport cell is empty.
- **unknown sport** — Sport does not match any supported program (see below).
- **bad day/time** — Day or time cannot be parsed.

**Supported sports (program keys):**  
BJJ (bjj), MMA (mma), Box (box), Kickbox (kickbox), Víkingaþrek (vikingathrek), VX (vx), V6 semi-privates (v6_semi_privates), Sjálfsvörn (sjalfsvorn), Heljardætur (heljardaetur), Mömmuþrek (mommuthrek). Mapping is by substring (case-insensitive; kickbox is matched before box). Yoga, Ólympískar Lyftingar, Hlaup og Hjól, and generic “Líkamsrækt” are **not** supported unless they match one of the keys above.

**Flow:** Paste text → **Preview** (see total/included/excluded and first 30 included rows) → **Import (Overwrite schedule)** to replace all classes. You can **Clear schedule** to remove all classes, or delete a single class from the table. Success toast shows imported and excluded counts.

### Per-program thresholds (low-attendance alerts)

The `program_thresholds` table stores a minimum headcount per program. An occurrence is considered **low attendance** if it has a logged headcount and `headcount < program_thresholds.min_headcount` for that program.

**Default thresholds (seeded idempotent):** The migration seeds missing programs only; **existing rows are never overwritten**. Default values: BJJ 10, MMA 8, Box 6, Kickbox 8, Víkingaþrek 6, VX 6, V6 semi-privates 4, Sjálfsvörn 8, Heljardætur 8, Mömmuþrek 6.

**Changing thresholds:** Admins can edit min headcount in **Admin → Analytics → Alerts**: use the per-program thresholds table, edit a value (integer ≥ 0), and click Save. Success and error toasts confirm the result.

Alerts list shows each low-attendance occurrence in the range (with utilization % when capacity exists); “Repeated low attendance slots” groups by class template (weekday, time, program, title) and lets you drill into that slot’s occurrences. **Missing logs** lists past occurrences (or today after the 1h lock) with no attendance, grouped by day; admins can **Mark as N/A** to record headcount 0 with notes `N/A (admin)`.

### CSV export

- **Attendance logs** — One row per log: occurrence date, start time, program (label), title, location, capacity, headcount, logged_by (name), logged_at. Use for external reporting or backups.
- **Slot summary** — One row per class template that had occurrences in range: template_id, weekday, start time, program, average headcount, average utilization (where capacity exists), occurrence count. Use for slot-level performance.

Export uses the current date range. Files download in the browser; no service role or raw DB access is exposed to the client.

## Timezone

**Iceland uses UTC.** Today is computed in UTC (`getTodayLocalDate()` and `getTodayWeekday()` in `src/lib/helpers.ts`), so the dashboard shows the correct local day for Iceland without timezone data.

## License

MIT
