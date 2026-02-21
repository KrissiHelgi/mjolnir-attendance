/** Client-safe date helpers (no server imports). */

/** Add delta days to local date YYYY-MM-DD. Returns YYYY-MM-DD. */
export function addDaysToLocalDate(localDate: string, delta: number): string {
  const d = new Date(localDate + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const WEEKDAY_NAMES = ['Sun', 'Mán', 'Þri', 'Mið', 'Fim', 'Fös', 'Lau']

/** Format local date for display e.g. "Mið 2026-02-21". */
export function formatLocalDateLabel(localDate: string): string {
  const d = new Date(localDate + 'T12:00:00Z')
  const weekday = d.getUTCDay()
  const name = WEEKDAY_NAMES[weekday] ?? 'Day'
  return `${name} ${localDate}`
}
