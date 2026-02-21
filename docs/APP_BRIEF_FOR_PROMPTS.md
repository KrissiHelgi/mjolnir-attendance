# Mjolnir Attendance – Full App Brief (for Cursor prompt design)

Copy-paste this entire document to ChatGPT (or another LLM) so it can help you write precise, context-rich prompts for Cursor when working on this codebase.

---

## 1. What the app is

**Mjolnir Attendance** is a gym/class attendance logging app for **Mjolnir** (Iceland). Coaches log headcounts for classes; admins manage schedule, coaches, and analytics. Time is treated as **UTC** (Iceland = UTC+0).

- **Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Supabase (auth + Postgres + RLS), Recharts for analytics.
- **Repo:** Single Next.js app; no separate backend. Server components and server actions call Supabase from the server; client components for interactivity.
- **Auth:** Supabase Auth (email/password). No OAuth in this brief.
- **Deploy:** Typically Vercel; env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, for admin/coach management and create-account flow).

---

## 2. Supabase schema (public)

### Tables

- **profiles**  
  - `id` (uuid, PK, FK → auth.users)  
  - `full_name` (text)  
  - `role` (text: `'admin' | 'coach' | 'head_coach' | 'pending'`)  
  - `coached_programs` (text[]), default `'{}'`  
  - `created_at`  
  - One row per auth user; created by trigger on `auth.users` insert (or by app for “create account” flow with role `pending`).

- **class_templates**  
  - Weekly recurring schedule: `id`, `program` (text, valid program key), `title`, `weekday` (0–6, Sunday=0), `start_time` (time), `location`, `capacity`, `default_coach_id` (FK profiles), `created_at`, `updated_at`. No duration field.  
  - Program keys must match `src/lib/programs.ts` and the DB check.

- **class_occurrences**  
  - One row per (template, date): `id`, `class_template_id` (FK class_templates), `local_date` (date), `starts_at` (timestamptz).  
  - Unique on `(class_template_id, local_date)`. Created on demand when loading the dashboard (get-or-create).

- **attendance_logs**  
  - One log per occurrence: `id`, `class_occurrence_id` (FK, unique), `headcount` (int ≥ 0), `created_by` (FK profiles), `created_at`, `updated_at`, `notes`, `locked` (boolean).  
  - Upsert key: `class_occurrence_id`.

- **program_thresholds**  
  - Per-program low-attendance threshold: `program` (PK), `min_headcount` (int ≥ 0), `created_at`, `updated_at`.

- **app_settings**  
  - Key-value: `key` (PK), `value`, `updated_at`. Used e.g. for schedule CSV URL.

- **access_requests**  
  - Coach signup requests: `id`, `user_id` (FK auth.users, nullable for legacy), `email`, `full_name`, `status` (`'pending'|'approved'|'denied'`), `created_at`, `decided_at`, `decided_by` (FK auth.users).

### RLS and helpers

- **is_admin()** (security definer): true iff current user’s profile has `role = 'admin'`.
- **coach_can_log_for_occurrence(occ_id)**: true if user is admin or has the occurrence’s template `program` in `profiles.coached_programs`.
- Policies:  
  - Profiles: read own; admins read all; update own.  
  - class_templates: authenticated read; admin full.  
  - class_occurrences: authenticated read + insert (for get-or-create).  
  - attendance_logs: authenticated read; insert/update/delete via `coach_can_log_for_occurrence`.  
  - program_thresholds, app_settings: authenticated read; admin write.  
  - access_requests: anyone insert; authenticated read/update.

### Triggers

- **on_auth_user_created**: after insert on `auth.users` → insert into `profiles` (full_name from metadata, role default `'coach'`).
- **handle_updated_at**: before update on class_templates, attendance_logs, program_thresholds, app_settings → set `updated_at = now()`.

### RPC

- **sync_class_templates(p_templates jsonb)**: admin-only; deletes all class_templates and inserts from JSON array (program, title, weekday, start_time, location, capacity). Used by paste importer and clear schedule.

---

## 3. App-specific “super admin”

- **Super admin** is defined in code (not DB): email `kristjan@mjolnir.is` (see `src/lib/helpers.ts` → `isSuperAdmin()`).  
- Only super admin can: list/approve/deny access requests, list coaches, change coach role, generate reset link, remove coach. These flows use **service role** client where needed (create user, delete user, etc.).

---

## 4. Roles and flows

- **pending**: New signup via “Create account”; sees only `/pending` until approved.  
- **coach** / **head_coach**: Can log attendance for classes whose `program` is in their `coached_programs`; dashboard filtered by `coached_programs` (“My classes”); can toggle “See all classes today”.  
- **admin**: Full access: schedule, coaches, analytics, override locked attendance, missing-logs banner, etc.  
- **Create account**: `/request-access` → form (email, full name, password, confirm) → server creates auth user (service role), profile with `role = 'pending'`, and access_requests row with `user_id`. User is then signed in and redirected to `/pending`.  
- **Approve**: Super admin approves → profile role set to `coach`; request marked approved.  
- **Deny**: Super admin denies → if `user_id` set, auth user deleted (service role); request marked denied.  
- **Redirect**: Logged-in users with `role === 'pending'` are redirected to `/pending` unless path is `/pending`, `/request-access`, or `/login` (client-side guard in layout using profile + pathname).

---

## 5. Attendance and lock

- **Lock rule** (single place: `src/lib/attendance-lock.ts`): editing allowed if `now <= starts_at + 1 hour` (UTC). After that, only admins can edit (override).  
- **logAttendance** (server action): checks lock, `coach_can_log_for_occurrence` (via RLS), then upserts `attendance_logs` by `class_occurrence_id`.

---

## 6. Routes and main files

- **Public (no auth):** `/login`, `/request-access`.  
- **Auth required:** `/` (dashboard), `/profile`, `/pending` (for pending role).  
- **Admin-only:** `/admin/coaches`, `/admin/schedule`, `/admin/analytics`, `/admin/bootstrap`.  
- **API:** `/api/admin/schedule/sync`, `/api/admin/schedule/preview` (admin auth checked inside).

**Key files:**

- **Layout / auth:** `src/app/layout.tsx` (fetches user + profile; renders `PendingGuard`, `Navigation`).  
- **Middleware:** `src/middleware.ts` → `updateSession` in `src/lib/supabase/middleware.ts` (refresh session; redirect unauthenticated to `/login` except for `/login`, `/request-access`).  
- **Dashboard:** `src/app/page.tsx` (today’s classes; for coach/head_coach filters by `coached_programs`, builds “my” cards and optional “all” cards; passes to `DashboardClient`).  
- **Dashboard UI:** `src/components/DashboardClient.tsx` (class cards, “See all classes today” / “Show my classes only” when `allCards` provided).  
- **Class card + attendance:** `src/components/ClassCard.tsx`, `src/components/LogAttendanceForm.tsx`, `src/lib/actions/attendance.ts`.  
- **Profile (programs):** `src/app/profile/page.tsx`, `src/components/ProfileProgramsForm.tsx`, `src/lib/actions/profile.ts` (update `coached_programs`).  
- **Create account / pending:** `src/app/request-access/page.tsx`, `src/app/pending/page.tsx`, `src/components/CreateAccountForm.tsx`, `src/components/PendingGuard.tsx`, `src/lib/actions/access-requests.ts`, `src/lib/actions/auth.ts` (signIn redirects pending to `/pending`).  
- **Coach management:** `src/app/admin/coaches/page.tsx`, `src/components/CoachManagementClient.tsx`, `src/lib/actions/coaches.ts`, `src/lib/actions/access-requests.ts` (approve/deny).  
- **Schedule:** `src/app/admin/schedule/page.tsx`, `src/lib/actions/schedule.ts`, **Paste timetable** only → `sync_class_templates` RPC (overwrite). No Google Sheets or CSV import.  
- **Analytics:** `src/app/admin/analytics/page.tsx`, `src/lib/analytics.ts` (server-side queries by date range; `local_date`), `src/lib/actions/analytics.ts`, components under `src/components/analytics/`.  
- **Helpers:** `src/lib/helpers.ts` (getCurrentUser, getCurrentProfile, isSuperAdmin, getTodayLocalDate, getTodayWeekday, getTodayStartEnd).  
- **Programs:** `src/lib/programs.ts` (PROGRAMS list, getProgramLabel, isValidProgramKey, normalizeProgramKey).  
- **Supabase:** `src/lib/supabase/server.ts` (createClient for server), `src/lib/supabase/client.ts` (browser), `src/lib/supabase/service-role.ts` (createServiceRoleClient, server-only).  
- **Seed script:** `scripts/seed-headcounts.js` (10 days of past headcounts 5–30 per occurrence; needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`; run `npm run seed-headcounts`).

---

## 7. Migrations (applied)

Supabase migrations live in `supabase/migrations/` (e.g. `20260220_rls_is_admin.sql` through `20260232_pending_role_and_user_id.sql`). The canonical schema snapshot is in `supabase/schema.sql` (includes tables, RLS, triggers, RPC). When adding features that change schema, add a new migration and keep `schema.sql` in sync for reference.

---

## 8. Current feature summary

- Auth: login, sign out, create account (email/name/password) → pending → approve/deny by super admin.  
- Dashboard: “My classes today” for coach/head_coach (by `coached_programs`); “See all classes today” toggle; admin sees all; get-or-create class_occurrences for today’s templates.  
- Attendance: log/update headcount per occurrence; 1-hour lock; admin override.  
- Profile: coach/head_coach choose `coached_programs` (program keys from PROGRAMS).  
- Admin: schedule (templates) via paste/CSV/Google Sheets sync; coach management (list, role, reset password, remove); analytics (date range, slots, program averages, utilization, alerts, coaches, export); bootstrap page; missing-logs banner (last 7 days).  
- Time: all “today” and dates in UTC; `local_date` YYYY-MM-DD; `starts_at` timestamptz for lock.

---

## 9. How to use this for Cursor prompts

When asking Cursor to change or add something:

1. **Reference this brief** (e.g. “In this app we use Supabase with RLS and the schema in docs/APP_BRIEF_FOR_PROMPTS.md”).  
2. **Name the area** (e.g. “dashboard”, “access requests”, “analytics”, “attendance lock”).  
3. **Give the exact files** when you know them (e.g. “In `src/app/page.tsx` and `DashboardClient.tsx`”).  
4. **State constraints** (e.g. “Keep the 1-hour lock rule in one place”, “Don’t add new env vars without documenting them”).  
5. **Mention schema** if the change touches DB (“Add a column to profiles” or “New table X with RLS”).

Example prompt you could use after pasting this to ChatGPT:  
“Using the APP_BRIEF I’ll paste, generate a short Cursor prompt that: [your goal]. The prompt should mention the relevant part of the schema and the 2–3 main files to touch.”

---

End of brief.
