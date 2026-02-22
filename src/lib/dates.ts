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
  const rest = formatLocalDateLabel(localDate)
  return `${weekday} ${rest}`
}
