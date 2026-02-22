import { createClient } from '@/lib/supabase/server'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getCurrentProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}

/** Super admin: only kristjan@mjolnir.is can access Coach management. */
export async function isSuperAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return (user?.email ?? '').toLowerCase() === 'kristjan@mjolnir.is'
}

/** Returns start and end of "today" in UTC. For Iceland (UTC+0) this is correct. */
export function getTodayStartEnd(_timezone?: string) {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

/** Today's date in UTC (Iceland = UTC). Format YYYY-MM-DD. */
export function getTodayLocalDate(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 0–6, Sunday = 0. */
export function getTodayWeekday(): number {
  return new Date().getUTCDay()
}

/** Parse YYYY-MM-DD from query param; returns null if invalid. */
export function parseLocalDateParam(input: string | null | undefined): string | null {
  const s = (input ?? '').trim()
  if (!s) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!match) return null
  const [, y, m, d] = match
  const year = parseInt(y!, 10)
  const month = parseInt(m!, 10) - 1
  const day = parseInt(d!, 10)
  const date = new Date(Date.UTC(year, month, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null
  return s
}

/** Add delta days to local date YYYY-MM-DD. Returns YYYY-MM-DD. */
export function addDaysToLocalDate(localDate: string, delta: number): string {
  const d = new Date(localDate + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Compare two YYYY-MM-DD strings. Returns -1 if a < b, 0 if equal, 1 if a > b. */
export function compareLocalDates(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/** Weekday 0–6 for a given local date YYYY-MM-DD (UTC). */
export function getWeekdayForLocalDate(localDate: string): number {
  const d = new Date(localDate + 'T12:00:00Z')
  return d.getUTCDay()
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAY_NAMES = ['Sun', 'Mán', 'Þri', 'Mið', 'Fim', 'Fös', 'Lau']

/** Format YYYY-MM-DD as alphanumeric e.g. "22 Feb 2026". */
export function formatLocalDateLabel(localDate: string): string {
  const d = new Date(localDate + 'T12:00:00Z')
  const day = d.getUTCDate()
  const month = MONTH_NAMES[d.getUTCMonth()] ?? ''
  const year = d.getUTCFullYear()
  return `${day} ${month} ${year}`
}

/** Format with weekday for dashboard e.g. "Sun 22 Feb 2026". */
export function formatLocalDateLabelWithWeekday(localDate: string): string {
  const d = new Date(localDate + 'T12:00:00Z')
  const weekday = WEEKDAY_NAMES[d.getUTCDay()] ?? ''
  return `${weekday} ${formatLocalDateLabel(localDate)}`
}
