/**
 * Google Sheets CSV parsing for class_templates sync.
 * Time format: "Mán 12:10" (weekday prefix + HH:MM).
 * Columns: Time, Class name (title), Sport. Exclude "Barna og unglingastarf", blank rows, unparseable time.
 */

const WEEKDAY_PREFIXES: { prefix: string; weekday: number }[] = [
  { prefix: 'Sun', weekday: 0 },
  { prefix: 'Mán', weekday: 1 },
  { prefix: 'Þri', weekday: 2 },
  { prefix: 'Mið', weekday: 3 },
  { prefix: 'Fim', weekday: 4 },
  { prefix: 'Fös', weekday: 5 },
  { prefix: 'Lau', weekday: 6 },
]

const TIME_REGEX = /^(\d{1,2}):(\d{2})$/

/** Parse "Mán 12:10" or "Mán, 12:10" -> { weekday: 1, start_time: "12:10" }. Returns null if invalid. */
export function parseTimeCell(cell: string): { weekday: number; start_time: string } | null {
  const s = (cell ?? '').trim()
  if (!s) return null
  const parts = s.split(/\s+/)
  if (parts.length < 2) return null
  const timePart = parts[parts.length - 1]
  const match = timePart.match(TIME_REGEX)
  if (!match) return null
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  const prefixRaw = parts.slice(0, -1).join(' ').trim()
  const prefix = prefixRaw.replace(/,\s*$/, '').trim()
  const found = WEEKDAY_PREFIXES.find((p) => prefix === p.prefix)
  if (!found) return null
  return { weekday: found.weekday, start_time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
}

/** Normalize for matching: lowercase, remove common accents. */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[ðÞ]/g, 'd')
    .replace(/þ/g, 'th')
    .replace(/æ/g, 'ae')
}

/** Find column index by normalized header. Accepts Time/Tími/Dagur, Class name/Kennsla, Sport/Íþrótt. */
function findColumnIndex(header: string[], kind: 'time' | 'class' | 'sport'): number {
  const normalized = header.map((h) => normalizeForMatch((h ?? '').trim()))
  if (kind === 'time') {
    const i = normalized.findIndex(
      (n) =>
        n === 'time' ||
        n === 'timi' ||
        (n.includes('dagur') && n.includes('timi')) ||
        n === 'kl' ||
        n === 'klukkan'
    )
    if (i !== -1) return i
  }
  if (kind === 'class') {
    const i = normalized.findIndex(
      (n) =>
        /^class\s*name$/.test(n) ||
        n === 'classname' ||
        n === 'kennsla' ||
        n === 'heiti' ||
        n === 'námskeið' ||
        n === 'namskeid' ||
        n === 'class' ||
        n === 'title'
    )
    if (i !== -1) return i
  }
  if (kind === 'sport') {
    const i = normalized.findIndex(
      (n) => n === 'sport' || n === 'ithrott' || n === 'program'
    )
    if (i !== -1) return i
  }
  return -1
}

/** Map Sport column to program key. Returns null if unknown. Handles comma-separated values (uses first match). */
export function sportToProgramKey(sport: string): string | null {
  const raw = (sport ?? '').trim()
  if (!raw) return null
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
  for (const part of parts) {
    const key = sportToProgramKeySingle(part)
    if (key) return key
  }
  return sportToProgramKeySingle(raw)
}

function sportToProgramKeySingle(sport: string): string | null {
  const n = normalizeForMatch((sport ?? '').trim())
  if (!n) return null
  if (n.includes('bjj') || n.includes('nogi') || n.includes('wrestling') || n.includes('open mat')) return 'bjj'
  if (n.includes('mma')) return 'mma'
  if (n.includes('box')) return 'box'
  if (n.includes('kick')) return 'kickbox'
  if (n.includes('vikingathrek') || n.includes('víkingaþrek')) return 'vikingathrek'
  if (n.includes('vx')) return 'vx'
  if (n.includes('v6')) return 'v6_semi_privates'
  if (n.includes('sjalfsvorn') || n.includes('sjálfsvörn')) return 'sjalfsvorn'
  if (n.includes('heljardaetur') || n.includes('heljardætur')) return 'heljardaetur'
  if (n.includes('mommuthrek') || n.includes('mömmuþrek')) return 'mommuthrek'
  return null
}

const KIDS_EXCLUSION = 'barna og unglingastarf'

function isBlankRow(cells: string[]): boolean {
  return cells.every((c) => !(c ?? '').trim())
}

export type ParsedTemplate = {
  program: string
  title: string
  weekday: number
  start_time: string
  duration_minutes: number
  location: string | null
  capacity: number | null
}

export type ExcludedRow = { reason: string; raw: string[]; index: number }

export type ParseResult = {
  totalRows: number
  included: ParsedTemplate[]
  excluded: ExcludedRow[]
}

/** Parse CSV text and apply exclusions. */
export function parseScheduleCSV(csvText: string): ParseResult {
  const lines = splitCSVLines(csvText)
  const included: ParsedTemplate[] = []
  const excluded: ExcludedRow[] = []
  if (lines.length < 2) return { totalRows: lines.length, included, excluded }
  const header = lines[0].map((c) => (c ?? '').trim())
  const normalized = header.map((h) => normalizeForMatch(h))
  const timeIdx = findColumnIndex(header, 'time')
  const dagurIdx = normalized.findIndex((n) => n === 'dagur' || n === 'weekday')
  const timiOnlyIdx = normalized.findIndex((n) => n === 'time' || n === 'timi' || n === 'kl' || n === 'klukkan')
  const useTwoColumnTime = dagurIdx !== -1 && timiOnlyIdx !== -1
  const timeIdx2 = useTwoColumnTime ? timiOnlyIdx : null
  const effectiveTimeIdx = useTwoColumnTime ? dagurIdx : timeIdx !== -1 ? timeIdx : -1
  const classNameIdx = findColumnIndex(header, 'class')
  const sportIdx = findColumnIndex(header, 'sport')
  if (effectiveTimeIdx === -1 || classNameIdx === -1 || sportIdx === -1) {
    excluded.push({
      reason: 'Missing required columns (need Time/Tími/Dagur, Class name/Kennsla, Sport/Íþrótt)',
      raw: header,
      index: 0,
    })
    return { totalRows: lines.length, included, excluded }
  }
  const durationMinutes = 60
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i]
    const maxCol = Math.max(effectiveTimeIdx, timeIdx2 ?? -1, classNameIdx, sportIdx)
    if (row.length <= maxCol) {
      excluded.push({ reason: 'Too few columns', raw: row, index: i + 1 })
      continue
    }
    const timeCell =
      timeIdx2 !== null
        ? [row[effectiveTimeIdx], row[timeIdx2]].map((c) => (c ?? '').trim()).filter(Boolean).join(' ')
        : (row[effectiveTimeIdx] ?? '').trim()
    const title = (row[classNameIdx] ?? '').trim()
    const sportCell = (row[sportIdx] ?? '').trim()
    if (isBlankRow(row)) {
      excluded.push({ reason: 'Blank row', raw: row, index: i + 1 })
      continue
    }
    if (normalizeForMatch(sportCell).includes(KIDS_EXCLUSION)) {
      excluded.push({ reason: 'Excluded: kids/teens (Barna og unglingastarf)', raw: row, index: i + 1 })
      continue
    }
    const timeParsed = parseTimeCell(timeCell)
    if (!timeParsed) {
      excluded.push({ reason: 'Invalid time (expected e.g. Mán 12:10)', raw: row, index: i + 1 })
      continue
    }
    const program = sportToProgramKey(sportCell)
    if (!program) {
      excluded.push({ reason: 'Unknown sport', raw: row, index: i + 1 })
      continue
    }
    included.push({
      program,
      title: title || 'Class',
      weekday: timeParsed.weekday,
      start_time: timeParsed.start_time,
      duration_minutes: durationMinutes,
      location: null,
      capacity: null,
    })
  }
  return { totalRows: lines.length, included, excluded }
}

/** Simple CSV split: handle quoted fields. */
function splitCSVLines(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i]
    if (c === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        cell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (inQuotes) {
      cell += c
      continue
    }
    if (c === ',' || c === ';') {
      row.push(cell.trim())
      cell = ''
      continue
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && csv[i + 1] === '\n') i++
      row.push(cell.trim())
      cell = ''
      if (row.some((v) => v !== '')) rows.push(row)
      row = []
      continue
    }
    cell += c
  }
  row.push(cell.trim())
  if (row.some((v) => v !== '')) rows.push(row)
  return rows
}

export const DEFAULT_CSV_URL =
  'https://docs.google.com/spreadsheets/d/123ExSUtuT3CQNxbSNGOsLoDczPbtJPScKn-H2Mc59F0/export?format=csv&gid=0'
