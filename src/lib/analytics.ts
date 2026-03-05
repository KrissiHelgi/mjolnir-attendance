/**
 * Server-side analytics queries. All date filtering uses local_date (YYYY-MM-DD).
 * Call from server components or server actions only.
 */

import { createClient } from '@/lib/supabase/server'
import { getProgramLabel } from '@/lib/programs'
import { getWeekdayLabel } from '@/lib/class-titles'

export type DateRange = { startDate: string; endDate: string }

/** Default: last 8 weeks ending today (local date). */
export function defaultDateRange(): DateRange {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 7 * 8)
  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
  }
}

/** Last 7 days ending today (for admin missing-logs banner). */
export function last7DaysRange(): DateRange {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 6)
  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
  }
}

function formatLocalDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type SlotTimeSeriesPoint = {
  weekStart: string
  slotId: string
  slotLabel: string
  program: string
  programLabel: string
  avgHeadcount: number
  occurrenceCount: number
}

/** Attendance per class slot over time: weekly averages. */
export async function getSlotTimeSeries(
  range: DateRange,
  options?: { program?: string; templateId?: string }
): Promise<{ error?: string; data?: SlotTimeSeriesPoint[] }> {
  const supabase = await createClient()

  const { data: occs, error: occError } = await supabase
    .from('class_occurrences')
    .select(`
      id,
      local_date,
      class_template_id,
      class_templates!inner (
        id,
        program,
        title,
        start_time,
        weekday
      )
    `)
    .gte('local_date', range.startDate)
    .lte('local_date', range.endDate)
    .order('local_date')

  let filtered = (occs ?? []) as unknown as OccRow[]
  if (options?.templateId) {
    filtered = filtered.filter((o: OccRow) => o.class_template_id === options.templateId)
  }
  if (options?.program) {
    filtered = filtered.filter((o: OccRow) => o.class_templates?.program === options.program)
  }
  if (!filtered.length) return { data: [] }

  if (occError) return { error: occError.message }

  type OccRow = {
    id: string
    local_date: string
    class_template_id: string
    class_templates: { id: string; program: string; title: string; start_time: string; weekday: number }
  }

  const occIds = filtered.map((o: { id: string }) => o.id)
  const { data: logs } = await supabase
    .from('attendance_logs')
    .select('class_occurrence_id, headcount, na_reason')
    .in('class_occurrence_id', occIds)

  const logByOcc = new Map<string, number>()
  logs?.forEach((l: { class_occurrence_id: string; headcount: number; na_reason?: string | null }) => {
    if (l.na_reason === 'cancelled') return
    logByOcc.set(l.class_occurrence_id, l.headcount)
  })

  const byWeekAndSlot = new Map<string, { headcounts: number[] }>()
  filtered.forEach((o: OccRow) => {
    const t = Array.isArray(o.class_templates) ? o.class_templates[0] : o.class_templates
    if (!t) return
    const weekStart = getWeekStart(o.local_date)
    const slotKey = `${o.class_template_id}|${weekStart}`
    if (!byWeekAndSlot.has(slotKey)) {
      byWeekAndSlot.set(slotKey, { headcounts: [] })
    }
    const h = logByOcc.get(o.id)
    if (h !== undefined) byWeekAndSlot.get(slotKey)!.headcounts.push(h)
  })

  const slotMeta = new Map<string, { program: string; label: string }>()
  filtered.forEach((o: OccRow) => {
    const t = Array.isArray(o.class_templates) ? o.class_templates[0] : o.class_templates
    if (!t || slotMeta.has(o.class_template_id)) return
    const startTime = String(t.start_time).slice(0, 5)
    slotMeta.set(o.class_template_id, {
      program: t.program,
      label: `${t.title} - ${getWeekdayLabel(t.weekday)} - ${startTime}`,
    })
  })

  const out: SlotTimeSeriesPoint[] = []
  byWeekAndSlot.forEach((v, key) => {
    const [templateId, weekStart] = key.split('|')
    const meta = slotMeta.get(templateId)
    if (!meta || v.headcounts.length === 0) return
    const avg = v.headcounts.reduce((a, b) => a + b, 0) / v.headcounts.length
    out.push({
      weekStart,
      slotId: templateId,
      slotLabel: meta.label,
      program: meta.program,
      programLabel: getProgramLabel(meta.program),
      avgHeadcount: Math.round(avg * 100) / 100,
      occurrenceCount: v.headcounts.length,
    })
  })
  out.sort((a, b) => a.weekStart.localeCompare(b.weekStart) || a.slotId.localeCompare(b.slotId))
  return { data: out }
}

function getWeekStart(localDate: string): string {
  const d = new Date(localDate + 'T12:00:00Z')
  const day = d.getUTCDay()
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1)
  d.setUTCDate(diff)
  return formatLocalDate(d)
}

export type ProgramAvgRow = { program: string; programLabel: string; avgHeadcount: number; occurrenceCount: number }

export async function getAvgAttendanceByProgram(range: DateRange): Promise<{
  error?: string
  data?: ProgramAvgRow[]
}> {
  const supabase = await createClient()

  const { data: occs, error: occError } = await supabase
    .from('class_occurrences')
    .select('id, class_templates!inner(program)')
    .gte('local_date', range.startDate)
    .lte('local_date', range.endDate)

  if (occError) return { error: occError.message }
  if (!occs?.length) return { data: [] }

  const occIds = occs.map((o: { id: string }) => o.id)
  const { data: logs } = await supabase
    .from('attendance_logs')
    .select('class_occurrence_id, headcount, na_reason')
    .in('class_occurrence_id', occIds)

  const logByOcc = new Map<string, number>()
  logs?.forEach((l: { class_occurrence_id: string; headcount: number; na_reason?: string | null }) => {
    if (l.na_reason === 'cancelled') return
    logByOcc.set(l.class_occurrence_id, l.headcount)
  })

  type Row = { id: string; class_templates: { program: string } | { program: string }[] }
  const byProgram = new Map<string, number[]>()
  occs.forEach((o: Row) => {
    const t = Array.isArray(o.class_templates) ? o.class_templates[0] : o.class_templates
    const program = t?.program
    if (!program) return
    const h = logByOcc.get(o.id)
    if (h === undefined) return
    if (!byProgram.has(program)) byProgram.set(program, [])
    byProgram.get(program)!.push(h)
  })

  const data: ProgramAvgRow[] = []
  byProgram.forEach((headcounts, program) => {
    const sum = headcounts.reduce((a, b) => a + b, 0)
    data.push({
      program,
      programLabel: getProgramLabel(program),
      avgHeadcount: Math.round((sum / headcounts.length) * 100) / 100,
      occurrenceCount: headcounts.length,
    })
  })
  data.sort((a, b) => b.avgHeadcount - a.avgHeadcount)
  return { data }
}

export type TotalAttendanceByProgramRow = {
  program: string
  programLabel: string
  totalHeadcount: number
  occurrenceCount: number
}

/** Total attendance (sum of headcount) per program in the date range. Excludes cancelled. */
export async function getTotalAttendanceByProgram(range: DateRange): Promise<{
  error?: string
  data?: TotalAttendanceByProgramRow[]
}> {
  const supabase = await createClient()

  const { data: occs, error: occError } = await supabase
    .from('class_occurrences')
    .select('id, class_templates!inner(program)')
    .gte('local_date', range.startDate)
    .lte('local_date', range.endDate)

  if (occError) return { error: occError.message }
  if (!occs?.length) return { data: [] }

  const occIds = occs.map((o: { id: string }) => o.id)
  const { data: logs } = await supabase
    .from('attendance_logs')
    .select('class_occurrence_id, headcount, na_reason')
    .in('class_occurrence_id', occIds)

  const logByOcc = new Map<string, number>()
  logs?.forEach((l: { class_occurrence_id: string; headcount: number; na_reason?: string | null }) => {
    if (l.na_reason === 'cancelled') return
    logByOcc.set(l.class_occurrence_id, l.headcount)
  })

  type Row = { id: string; class_templates: { program: string } | { program: string }[] }
  const byProgram = new Map<string, number[]>()
  occs.forEach((o: Row) => {
    const t = Array.isArray(o.class_templates) ? o.class_templates[0] : o.class_templates
    const program = t?.program
    if (!program) return
    const h = logByOcc.get(o.id)
    if (h === undefined) return
    if (!byProgram.has(program)) byProgram.set(program, [])
    byProgram.get(program)!.push(h)
  })

  const data: TotalAttendanceByProgramRow[] = []
  byProgram.forEach((headcounts, program) => {
    const totalHeadcount = headcounts.reduce((a, b) => a + b, 0)
    data.push({
      program,
      programLabel: getProgramLabel(program),
      totalHeadcount,
      occurrenceCount: headcounts.length,
    })
  })
  data.sort((a, b) => b.totalHeadcount - a.totalHeadcount)
  return { data }
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
/** Display order Mon–Sun for chart X axis */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export type WeeklyWeekdayRow = { weekday: string; [programKey: string]: string | number }

/**
 * Average attendance per weekday (Mon–Sun) across the date range.
 * Missing logs count as 0. Returns one row per weekday in order Mon..Sun; each row has weekday + one key per program.
 */
export async function getWeeklyWeekdayAverages(
  range: DateRange,
  programFilter?: string
): Promise<{ error?: string; data?: WeeklyWeekdayRow[] }> {
  const supabase = await createClient()

  const { data: occs, error: occError } = await supabase
    .from('class_occurrences')
    .select('id, local_date, class_templates!inner(program)')
    .gte('local_date', range.startDate)
    .lte('local_date', range.endDate)

  if (occError) return { error: occError.message }

  type OccRow = { id: string; local_date: string; class_templates: { program: string } | { program: string }[] }
  const occList = (occs ?? []) as OccRow[]
  const occIds = occList.map((o) => o.id)
  if (occIds.length === 0) {
    const empty: WeeklyWeekdayRow[] = WEEKDAY_ORDER.map((w) => ({ weekday: WEEKDAY_LABELS[w] }))
    return { data: empty }
  }

  const { data: logs } = await supabase
    .from('attendance_logs')
    .select('class_occurrence_id, headcount, na_reason')
    .in('class_occurrence_id', occIds)

  const logByOcc = new Map<string, number>()
  logs?.forEach((l: { class_occurrence_id: string; headcount: number; na_reason?: string | null }) => {
    if (l.na_reason === 'cancelled') return
    logByOcc.set(l.class_occurrence_id, l.headcount)
  })

  const dateProgramTotal = new Map<string, Map<string, number>>()
  occList.forEach((o) => {
    const t = Array.isArray(o.class_templates) ? o.class_templates[0] : o.class_templates
    const program = t?.program
    if (!program) return
    if (programFilter && program !== programFilter) return
    const date = o.local_date
    if (!dateProgramTotal.has(date)) dateProgramTotal.set(date, new Map())
    const perProgram = dateProgramTotal.get(date)!
    const h = logByOcc.get(o.id) ?? 0
    perProgram.set(program, (perProgram.get(program) ?? 0) + h)
  })

  const programs = new Set<string>()
  dateProgramTotal.forEach((m) => m.forEach((_, p) => programs.add(p)))

  const start = new Date(range.startDate + 'T12:00:00Z')
  const end = new Date(range.endDate + 'T12:00:00Z')
  const weekdayCount = [0, 0, 0, 0, 0, 0, 0] as number[]
  const weekdaySums = new Map<string, number[]>()
  programs.forEach((p) => weekdaySums.set(p, [0, 0, 0, 0, 0, 0, 0]))

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const localDate = formatLocalDate(d)
    const w = d.getUTCDay()
    weekdayCount[w]++
    const perProgram = dateProgramTotal.get(localDate)
    programs.forEach((program) => {
      const arr = weekdaySums.get(program)!
      arr[w] += perProgram?.get(program) ?? 0
    })
  }

  const data: WeeklyWeekdayRow[] = WEEKDAY_ORDER.map((w) => {
    const row: WeeklyWeekdayRow = { weekday: WEEKDAY_LABELS[w] }
    const n = weekdayCount[w] || 1
    programs.forEach((program) => {
      const arr = weekdaySums.get(program)!
      row[program] = Math.round((arr[w] / n) * 100) / 100
    })
    return row
  })

  return { data }
}

export type CoachPerformanceRow = {
  coachId: string
  coachName: string
  totalLogs: number
  avgHeadcount: number
  programs: string[]
}

export async function getCoachPerformance(range: DateRange): Promise<{
  error?: string
  data?: CoachPerformanceRow[]
}> {
  const supabase = await createClient()

  const { data: occs } = await supabase
    .from('class_occurrences')
    .select('id, local_date')
    .gte('local_date', range.startDate)
    .lte('local_date', range.endDate)

  if (!occs?.length) return { data: [] }
  const occIds = occs.map((o: { id: string }) => o.id)

  const { data: logs, error: logError } = await supabase
    .from('attendance_logs')
    .select('class_occurrence_id, headcount, created_by, na_reason')
    .in('class_occurrence_id', occIds)

  if (logError) return { error: logError.message }
  const countedLogs = (logs ?? []).filter((l: { na_reason?: string | null }) => l.na_reason !== 'cancelled')
  if (!countedLogs.length) return { data: [] }

  const occIdsSet = new Set(occIds)
  const coachIds = [...new Set(countedLogs.map((l: { created_by: string }) => l.created_by))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', coachIds)

  const nameById = new Map<string, string>()
  profiles?.forEach((p: { id: string; full_name: string | null }) => {
    nameById.set(p.id, p.full_name || 'Unknown')
  })

  const { data: occTemplates } = await supabase
    .from('class_occurrences')
    .select('id, class_templates!inner(program)')
    .in('id', occIds)

  const programByOcc = new Map<string, string>()
  type OccTplRow = { id: string; class_templates: { program: string } | { program: string }[] }
  occTemplates?.forEach((o: OccTplRow) => {
    const t = Array.isArray(o.class_templates) ? o.class_templates[0] : o.class_templates
    if (t?.program) programByOcc.set(o.id, t.program)
  })

  const byCoach = new Map<string, { headcounts: number[]; programs: Set<string> }>()
  countedLogs.forEach((l: { created_by: string; headcount: number; class_occurrence_id: string }) => {
    if (!occIdsSet.has(l.class_occurrence_id)) return
    if (!byCoach.has(l.created_by)) {
      byCoach.set(l.created_by, { headcounts: [], programs: new Set() })
    }
    const r = byCoach.get(l.created_by)!
    r.headcounts.push(l.headcount)
    const prog = programByOcc.get(l.class_occurrence_id)
    if (prog) r.programs.add(prog)
  })

  const data: CoachPerformanceRow[] = []
  byCoach.forEach((v, coachId) => {
    const sum = v.headcounts.reduce((a, b) => a + b, 0)
    data.push({
      coachId,
      coachName: nameById.get(coachId) ?? 'Unknown',
      totalLogs: v.headcounts.length,
      avgHeadcount: Math.round((sum / v.headcounts.length) * 100) / 100,
      programs: [...v.programs].sort(),
    })
  })
  data.sort((a, b) => b.totalLogs - a.totalLogs)
  return { data }
}

export type UtilizationRow = {
  program?: string
  programLabel?: string
  slotId?: string
  slotLabel?: string
  avgUtilization: number
  occurrenceCount: number
  capacityMissing?: boolean
}

export async function getCapacityUtilization(
  range: DateRange,
  by: 'program' | 'slot'
): Promise<{ error?: string; data?: UtilizationRow[]; capacityMissingCount?: number }> {
  const supabase = await createClient()

  const { data: occs, error: occError } = await supabase
    .from('class_occurrences')
    .select(`
      id,
      local_date,
      class_template_id,
      class_templates!inner(program, capacity, start_time)
    `)
    .gte('local_date', range.startDate)
    .lte('local_date', range.endDate)

  if (occError) return { error: occError.message }
  if (!occs?.length) return { data: [], capacityMissingCount: 0 }

  const occIds = occs.map((o: { id: string }) => o.id)
  const { data: logs } = await supabase
    .from('attendance_logs')
    .select('class_occurrence_id, headcount, na_reason')
    .in('class_occurrence_id', occIds)

  const logByOcc = new Map<string, number>()
  logs?.forEach((l: { class_occurrence_id: string; headcount: number; na_reason?: string | null }) => {
    if (l.na_reason === 'cancelled') return
    logByOcc.set(l.class_occurrence_id, l.headcount)
  })

  type OccRow = {
    id: string
    class_template_id: string
    class_templates: { program: string; capacity: number | null; start_time: string } | { program: string; capacity: number | null; start_time: string }[]
  }

  let capacityMissingCount = 0
  const buckets = new Map<string, { util: number[]; capacityMissing?: boolean }>()

  occs.forEach((o: OccRow) => {
    const t = Array.isArray(o.class_templates) ? o.class_templates[0] : o.class_templates
    const headcount = logByOcc.get(o.id)
    if (headcount === undefined) return
    const cap = t.capacity
    if (cap == null || cap <= 0) {
      capacityMissingCount++
      return
    }
    const util = headcount / cap
    const key = by === 'program' ? t.program : o.class_template_id
    if (!buckets.has(key)) {
      buckets.set(key, { util: [] })
    }
    buckets.get(key)!.util.push(util)
  })

  const data: UtilizationRow[] = []
  if (by === 'program') {
    buckets.forEach((v, program) => {
      const avg = v.util.reduce((a, b) => a + b, 0) / v.util.length
      data.push({
        program,
        programLabel: getProgramLabel(program),
        avgUtilization: Math.round(avg * 100) / 100,
        occurrenceCount: v.util.length,
      })
    })
    data.sort((a, b) => (a.program ?? '').localeCompare(b.program ?? ''))
  } else {
    const slotLabels = new Map<string, string>()
    occs.forEach((o: OccRow) => {
      const t = Array.isArray(o.class_templates) ? o.class_templates[0] : o.class_templates
      if (!t || slotLabels.has(o.class_template_id)) return
      slotLabels.set(o.class_template_id, `${getProgramLabel(t.program)} ${String(t.start_time).slice(0, 5)}`)
    })
    buckets.forEach((v, slotId) => {
      const avg = v.util.reduce((a, b) => a + b, 0) / v.util.length
      data.push({
        slotId,
        slotLabel: slotLabels.get(slotId) ?? slotId,
        avgUtilization: Math.round(avg * 100) / 100,
        occurrenceCount: v.util.length,
      })
    })
    data.sort((a, b) => (a.slotLabel ?? '').localeCompare(b.slotLabel ?? ''))
  }

  return { data, capacityMissingCount }
}

export type LowAttendanceAlert = {
  date: string
  time: string
  program: string
  programLabel: string
  title: string
  headcount: number
  threshold: number
  utilization?: number
  capacity?: number
  templateId: string
}

export type SlotLowCount = {
  templateId: string
  slotLabel: string
  program: string
  programLabel: string
  weekday: number
  weekdayLabel: string
  title: string
  lowCount: number
  totalLogged: number
}

export async function getLowAttendanceAlerts(range: DateRange): Promise<{
  error?: string
  alerts?: LowAttendanceAlert[]
  slotsWithRepeated?: SlotLowCount[]
}> {
  const supabase = await createClient()

  const { data: thresholds, error: thError } = await supabase
    .from('program_thresholds')
    .select('program, min_headcount')

  if (thError) return { error: thError.message }
  const thByProgram = new Map<string, number>()
  thresholds?.forEach((t: { program: string; min_headcount: number }) => {
    thByProgram.set(t.program, t.min_headcount)
  })

  const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const { data: occs, error: occError } = await supabase
    .from('class_occurrences')
    .select(`
      id,
      local_date,
      starts_at,
      class_template_id,
      class_templates!inner(program, title, start_time, capacity, weekday)
    `)
    .gte('local_date', range.startDate)
    .lte('local_date', range.endDate)

  if (occError) return { error: occError.message }
  if (!occs?.length) return { alerts: [], slotsWithRepeated: [] }

  const occIds = occs.map((o: { id: string }) => o.id)
  const { data: logs } = await supabase
    .from('attendance_logs')
    .select('class_occurrence_id, headcount, na_reason')
    .in('class_occurrence_id', occIds)

  const logByOcc = new Map<string, number>()
  logs?.forEach((l: { class_occurrence_id: string; headcount: number; na_reason?: string | null }) => {
    if (l.na_reason === 'cancelled') return
    logByOcc.set(l.class_occurrence_id, l.headcount)
  })

  type OccRow = {
    id: string
    local_date: string
    starts_at: string
    class_template_id: string
    class_templates: { program: string; title: string; start_time: string; capacity: number | null; weekday: number } | { program: string; title: string; start_time: string; capacity: number | null; weekday: number }[]
  }

  const alerts: LowAttendanceAlert[] = []
  const slotLowCount = new Map<string, { low: number; total: number; program: string; label: string; weekday: number; title: string }>()

  occs.forEach((o: OccRow) => {
    const headcount = logByOcc.get(o.id)
    if (headcount === undefined) return
    const t = Array.isArray(o.class_templates) ? o.class_templates[0] : o.class_templates
    if (!t) return
    // Use program threshold if set; otherwise treat as min 1 so headcount 0 still shows as low attendance
    const minH = thByProgram.get(t.program) ?? 1
    if (headcount >= minH) return

    const timeStr = String(t.start_time).slice(0, 5)
    alerts.push({
      date: o.local_date,
      time: timeStr,
      program: t.program,
      programLabel: getProgramLabel(t.program),
      title: t.title,
      headcount,
      threshold: minH,
      capacity: t.capacity ?? undefined,
      utilization: t.capacity && t.capacity > 0 ? Math.round((headcount / t.capacity) * 100) / 100 : undefined,
      templateId: o.class_template_id,
    })

    const slotKey = o.class_template_id
    if (!slotLowCount.has(slotKey)) {
      const w = typeof t.weekday === 'number' ? t.weekday : 0
      slotLowCount.set(slotKey, {
        low: 0,
        total: 0,
        program: t.program,
        label: `${WEEKDAY_LABELS[w]} ${timeStr} · ${getProgramLabel(t.program)} · ${t.title}`,
        weekday: w,
        title: t.title,
      })
    }
    const s = slotLowCount.get(slotKey)!
    s.total++
    s.low++
  })

  const slotsWithRepeated: SlotLowCount[] = []
  slotLowCount.forEach((v, templateId) => {
    if (v.low === 0) return
    slotsWithRepeated.push({
      templateId,
      slotLabel: v.label,
      program: v.program,
      programLabel: getProgramLabel(v.program),
      weekday: v.weekday,
      weekdayLabel: WEEKDAY_LABELS[v.weekday] ?? '',
      title: v.title,
      lowCount: v.low,
      totalLogged: v.total,
    })
  })
  slotsWithRepeated.sort((a, b) => b.lowCount - a.lowCount)

  alerts.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  return { alerts, slotsWithRepeated }
}

export type MissingLog = {
  occurrenceId: string
  date: string
  time: string
  program: string
  programLabel: string
  title: string
}

/** True if occurrence is in the past: local_date < today, or (today and starts_at + 1h < now). */
function isPastOccurrence(localDate: string, startsAt: string): boolean {
  const today = formatLocalDate(new Date())
  if (localDate < today) return true
  if (localDate > today) return false
  const lockEnd = new Date(startsAt).getTime() + 60 * 60 * 1000
  return Date.now() > lockEnd
}

export async function getMissingLogs(range: DateRange): Promise<{
  error?: string
  data?: MissingLog[]
}> {
  const supabase = await createClient()

  const { data: occs, error: occError } = await supabase
    .from('class_occurrences')
    .select(`
      id,
      local_date,
      starts_at,
      class_templates!inner(program, title, start_time)
    `)
    .gte('local_date', range.startDate)
    .lte('local_date', range.endDate)

  if (occError) return { error: occError.message }
  if (!occs?.length) return { data: [] }

  type OccRow = {
    id: string
    local_date: string
    starts_at: string
    class_templates: { program: string; title: string; start_time: string } | { program: string; title: string; start_time: string }[]
  }
  const pastOccs = (occs as OccRow[]).filter((o) => isPastOccurrence(o.local_date, o.starts_at))
  if (!pastOccs.length) return { data: [] }

  const occIds = pastOccs.map((o) => o.id)
  const { data: logs } = await supabase
    .from('attendance_logs')
    .select('class_occurrence_id')
    .in('class_occurrence_id', occIds)

  const loggedIds = new Set((logs ?? []).map((l: { class_occurrence_id: string }) => l.class_occurrence_id))
  const data: MissingLog[] = pastOccs
    .filter((o) => !loggedIds.has(o.id))
    .map((o) => {
      const t = Array.isArray(o.class_templates) ? o.class_templates[0] : o.class_templates
      return {
        occurrenceId: o.id,
        date: o.local_date,
        time: String(t?.start_time ?? '').slice(0, 5),
        program: t?.program ?? '',
        programLabel: getProgramLabel(t?.program ?? ''),
        title: t?.title ?? '',
      }
    })
  data.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
  return { data }
}

export type OverCapacityRow = {
  date: string
  time: string
  program: string
  programLabel: string
  title: string
  capacity: number
  headcount: number
  overBy: number
}

/** Logs where headcount > capacity (capacity must be set). Within date range. */
export async function getOverCapacityLogs(range: DateRange): Promise<{
  error?: string
  data?: OverCapacityRow[]
}> {
  const supabase = await createClient()

  const { data: occs, error: occError } = await supabase
    .from('class_occurrences')
    .select(`
      id,
      local_date,
      starts_at,
      class_templates!inner(program, title, start_time, capacity)
    `)
    .gte('local_date', range.startDate)
    .lte('local_date', range.endDate)

  if (occError) return { error: occError.message }
  if (!occs?.length) return { data: [] }

  const occIds = occs.map((o: { id: string }) => o.id)
  const { data: logs } = await supabase
    .from('attendance_logs')
    .select('class_occurrence_id, headcount, na_reason')
    .in('class_occurrence_id', occIds)

  const logByOcc = new Map<string, number>()
  logs?.forEach((l: { class_occurrence_id: string; headcount: number; na_reason?: string | null }) => {
    if (l.na_reason === 'cancelled') return
    logByOcc.set(l.class_occurrence_id, l.headcount)
  })

  type OccRow = {
    id: string
    local_date: string
    starts_at: string
    class_templates: { program: string; title: string; start_time: string; capacity: number | null } | { program: string; title: string; start_time: string; capacity: number | null }[]
  }
  const data: OverCapacityRow[] = []
  ;(occs as OccRow[]).forEach((o) => {
    const t = Array.isArray(o.class_templates) ? o.class_templates[0] : o.class_templates
    if (!t || t.capacity == null) return
    const headcount = logByOcc.get(o.id)
    if (headcount == null || headcount <= t.capacity) return
    data.push({
      date: o.local_date,
      time: String(t.start_time ?? '').slice(0, 5),
      program: t.program ?? '',
      programLabel: getProgramLabel(t.program ?? ''),
      title: t.title ?? '',
      capacity: t.capacity,
      headcount,
      overBy: headcount - t.capacity,
    })
  })
  data.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
  return { data }
}

/** Count of missing logs in range (for admin banner). */
export async function getMissingLogsCount(range: DateRange): Promise<{ error?: string; count?: number }> {
  const r = await getMissingLogs(range)
  if (r.error) return { error: r.error }
  return { count: r.data?.length ?? 0 }
}

export type CancelledLogRow = {
  occurrenceId: string
  date: string
  time: string
  program: string
  programLabel: string
  title: string
}

/** Logs marked as "class cancelled" (na_reason = 'cancelled') in range. For Alerts "Classes cancelled" section. */
export async function getCancelledLogs(range: DateRange): Promise<{
  error?: string
  data?: CancelledLogRow[]
}> {
  const supabase = await createClient()

  const { data: occs, error: occError } = await supabase
    .from('class_occurrences')
    .select(`
      id,
      local_date,
      class_templates!inner(program, title, start_time)
    `)
    .gte('local_date', range.startDate)
    .lte('local_date', range.endDate)

  if (occError) return { error: occError.message }
  if (!occs?.length) return { data: [] }

  const occIds = occs.map((o: { id: string }) => o.id)
  const { data: logs } = await supabase
    .from('attendance_logs')
    .select('class_occurrence_id')
    .in('class_occurrence_id', occIds)
    .eq('na_reason', 'cancelled')

  const cancelledOccIds = new Set((logs ?? []).map((l: { class_occurrence_id: string }) => l.class_occurrence_id))
  const cancelledOccs = (occs as { id: string; local_date: string; class_templates: { program: string; title: string; start_time: string } | { program: string; title: string; start_time: string }[] }[]).filter((o) => cancelledOccIds.has(o.id))

  type OccRow = {
    id: string
    local_date: string
    class_templates: { program: string; title: string; start_time: string } | { program: string; title: string; start_time: string }[]
  }
  const data: CancelledLogRow[] = cancelledOccs.map((o: OccRow) => {
    const t = Array.isArray(o.class_templates) ? o.class_templates[0] : o.class_templates
    return {
      occurrenceId: o.id,
      date: o.local_date,
      time: String(t?.start_time ?? '').slice(0, 5),
      program: t?.program ?? '',
      programLabel: getProgramLabel(t?.program ?? ''),
      title: t?.title ?? '',
    }
  })
  data.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
  return { data }
}

export async function getOverview(range: DateRange): Promise<{
  error?: string
  totalOccurrences?: number
  totalLogged?: number
  uniquePrograms?: number
}> {
  const supabase = await createClient()

  const { count: totalOccurrences, error: occErr } = await supabase
    .from('class_occurrences')
    .select('*', { count: 'exact', head: true })
    .gte('local_date', range.startDate)
    .lte('local_date', range.endDate)

  if (occErr) return { error: occErr.message }

  const { data: occs } = await supabase
    .from('class_occurrences')
    .select('id')
    .gte('local_date', range.startDate)
    .lte('local_date', range.endDate)

  const occIds = occs?.map((o: { id: string }) => o.id) ?? []
  let totalLogged = 0
  let uniquePrograms = 0
  if (occIds.length > 0) {
    const { data: logRows } = await supabase
      .from('attendance_logs')
      .select('na_reason')
      .in('class_occurrence_id', occIds)
    totalLogged = (logRows ?? []).filter((r: { na_reason?: string | null }) => r.na_reason !== 'cancelled').length

    const { data: progData } = await supabase
      .from('class_occurrences')
      .select('class_templates(program)')
      .in('id', occIds)
    const progs = new Set(
      (progData ?? []).map((o: { class_templates: { program: string } | { program: string }[] | null }) => (Array.isArray(o.class_templates) ? o.class_templates[0] : o.class_templates)?.program).filter(Boolean)
    )
    uniquePrograms = progs.size
  }

  return {
    totalOccurrences: totalOccurrences ?? 0,
    totalLogged: totalLogged ?? 0,
    uniquePrograms,
  }
}

export type LoggedClassRow = {
  logId: string
  occurrenceId: string
  date: string
  time: string
  program: string
  programLabel: string
  title: string
  headcount: number
  loggedByName: string | null
  loggedAt: string
}

/** Logs that affect analytics (counted in Overview etc.) for one day. Excludes na_reason = 'cancelled'. */
export async function getLoggedClassesForDate(localDate: string): Promise<{
  error?: string
  data?: LoggedClassRow[]
}> {
  const supabase = await createClient()

  const { data: occs, error: occError } = await supabase
    .from('class_occurrences')
    .select(`
      id,
      class_templates!inner(program, title, start_time)
    `)
    .eq('local_date', localDate)

  if (occError) return { error: occError.message }
  if (!occs?.length) return { data: [] }

  const occIds = occs.map((o: { id: string }) => o.id)
  const { data: logs, error: logError } = await supabase
    .from('attendance_logs')
    .select('id, class_occurrence_id, headcount, created_by_name, updated_at, na_reason')
    .in('class_occurrence_id', occIds)

  if (logError) return { error: logError.message }
  const counted = (logs ?? []).filter((l: { na_reason?: string | null }) => l.na_reason !== 'cancelled')
  if (!counted.length) return { data: [] }

  type OccRow = {
    id: string
    class_templates: { program: string; title: string; start_time: string } | { program: string; title: string; start_time: string }[]
  }
  const occById = new Map<string, OccRow>()
  occs.forEach((o: OccRow) => occById.set(o.id, o))

  const data: LoggedClassRow[] = counted.map((l: { id: string; class_occurrence_id: string; headcount: number; created_by_name: string | null; updated_at: string }) => {
    const occ = occById.get(l.class_occurrence_id)
    const t = occ && (Array.isArray(occ.class_templates) ? occ.class_templates[0] : occ.class_templates)
    const time = t ? String(t.start_time).slice(0, 5) : ''
    const program = t?.program ?? ''
    const title = t?.title ?? ''
    return {
      logId: l.id,
      occurrenceId: l.class_occurrence_id,
      date: localDate,
      time,
      program,
      programLabel: getProgramLabel(program),
      title,
      headcount: l.headcount,
      loggedByName: l.created_by_name ?? null,
      loggedAt: l.updated_at,
    }
  })
  data.sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title))
  return { data }
}
