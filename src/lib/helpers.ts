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
