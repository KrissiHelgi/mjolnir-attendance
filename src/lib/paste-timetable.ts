/**
 * Paste timetable (TSV) parser for admin schedule import.
 * Columns: Day, Time, Class name, Sport.
 * Excludes: kids program, missing sport, unknown sport, bad day/time.
 */

const DAY_MAP: Record<string, number> = {
  sun: 0,
  mán: 1,
  man: 1,
  þri: 2,
  thi: 2,
  mið: 3,
  mid: 3,
  fim: 4,
  fös: 5,
  fos: 5,
  lau: 6,
}

const TIME_REGEX = /^(\d{1,2}):(\d{2})$/
const KIDS_EXCLUSION = 'barna og unglingastarf'

function normalize(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[ðÞ]/g, 'd')
    .replace(/þ/g, 'th')
    .replace(/æ/g, 'ae')
    .trim()
}

/** Map Sport cell to program key. Order matters (kickbox before box, vx before vikingathrek). */
export function mapSportToProgramKey(sport: string): string | null {
  const raw = (sport ?? '').trim()
  if (!raw) return null
  const n = normalize(raw)
  if (n.includes('bjj') || n.includes('nogi') || n.includes('wrestling')) return 'bjj'
  if (n.includes('mma')) return 'mma'
  if (n.includes('kickbox')) return 'kickbox'
  if (n.includes('box')) return 'box'
  if (n.includes('sjálfsvörn') || n.includes('sjalfsvorn') || /^isr/.test(n)) return 'sjalfsvorn'
  if (n.includes('heljardætur') || n.includes('heljardaetur')) return 'heljardaetur'
  if (n.includes('mömmuþrek') || n.includes('mommuthrek')) return 'mommuthrek'
  if (n.includes('víkingaþrek x') || n.includes('vikingathrek x') || /\bvx\b/.test(n) || n === 'vx') return 'vx'
  if (n.includes('víkingaþrek') || n.includes('vikingathrek')) return 'vikingathrek'
  if (n.includes('v6')) return 'v6_semi_privates'
  return null
}

function parseDay(day: string): number | null {
  const d = (day ?? '').trim().toLowerCase()
  const normalized = normalize(day)
  if (DAY_MAP[d] !== undefined) return DAY_MAP[d]
  if (DAY_MAP[normalized] !== undefined) return DAY_MAP[normalized]
  const withAccent = (day ?? '').trim()
  const lower = withAccent.toLowerCase()
  for (const [key, val] of Object.entries(DAY_MAP)) {
    if (lower === key || normalize(withAccent) === key) return val
  }
  return null
}

function parseTime(time: string): string | null {
  const t = (time ?? '').trim()
  const m = t.match(TIME_REGEX)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

const HEADER_LIKE = /^(day|time|class|sport|mán|þri|mið|fim|fös|lau|sun|man|thi|mid|fos)\s*$/i

function isHeaderRow(cells: string[]): boolean {
  const first = (cells[0] ?? '').trim().toLowerCase()
  return cells.length >= 2 && HEADER_LIKE.test(first)
}

export type PasteTemplate = {
  program: string
  title: string
  weekday: number
  start_time: string
  location: null
  capacity: null
}

export type PasteExcluded = { reason: string; raw: string[]; index: number }

export type PasteResult = {
  totalRows: number
  included: PasteTemplate[]
  excluded: PasteExcluded[]
}

/** Split line by tabs or multiple spaces. */
function splitRow(line: string): string[] {
  return line.split(/\t|\s{2,}/).map((c) => c.trim())
}

/** Parse pasted TSV text. Expects columns: Day, Time, Class name, Sport (order flexible by position). */
export function parsePasteTimetable(tsv: string): PasteResult {
  const included: PasteTemplate[] = []
  const excluded: PasteExcluded[] = []
  const lines = (tsv ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return { totalRows: 0, included, excluded }

  let start = 0
  if (lines.length > 0 && isHeaderRow(splitRow(lines[0]))) start = 1

  for (let i = start; i < lines.length; i++) {
    const cells = splitRow(lines[i])
    const dayStr = cells[0] ?? ''
    const timeStr = cells[1] ?? ''
    const className = (cells[2] ?? '').trim()
    const sportStr = (cells[3] ?? '').trim()

    if (!sportStr) {
      excluded.push({ reason: 'missing sport', raw: cells, index: i + 1 })
      continue
    }
    if (normalize(sportStr).includes(KIDS_EXCLUSION)) {
      excluded.push({ reason: 'kids program', raw: cells, index: i + 1 })
      continue
    }

    const program = mapSportToProgramKey(sportStr)
    if (!program) {
      excluded.push({ reason: 'unknown sport', raw: cells, index: i + 1 })
      continue
    }

    const weekday = parseDay(dayStr)
    const start_time = parseTime(timeStr)
    if (weekday === null || !start_time) {
      excluded.push({ reason: 'bad day/time', raw: cells, index: i + 1 })
      continue
    }

    included.push({
      program,
      title: className || 'Class',
      weekday,
      start_time,
      location: null,
      capacity: null,
    })
  }

  return {
    totalRows: lines.length,
    included,
    excluded,
  }
}
