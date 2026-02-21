'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/helpers'
import { getProgramLabel } from '@/lib/programs'
import {
  defaultDateRange,
  getOverview,
  getSlotTimeSeries,
  getAvgAttendanceByProgram,
  getCoachPerformance,
  getCapacityUtilization,
  getLowAttendanceAlerts,
  getMissingLogs,
  getMissingLogsCount,
  type DateRange,
} from '@/lib/analytics'
import { logAttendance } from '@/lib/actions/attendance'

/** Ensure current user is admin. */
async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin') {
    throw new Error('Unauthorized')
  }
}

export type ThresholdRow = { program: string; programLabel: string; minHeadcount: number }

export async function getThresholds(): Promise<{ error?: string; data?: ThresholdRow[] }> {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('program_thresholds')
    .select('program, min_headcount')
    .order('program')
  if (error) return { error: error.message }
  const list: ThresholdRow[] = (data ?? []).map((r: { program: string; min_headcount: number }) => ({
    program: r.program,
    programLabel: getProgramLabel(r.program),
    minHeadcount: r.min_headcount,
  }))
  return { data: list }
}

export async function updateThreshold(
  program: string,
  minHeadcount: number
): Promise<{ error?: string }> {
  await requireAdmin()
  if (minHeadcount < 0) return { error: 'min_headcount must be >= 0' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('program_thresholds')
    .upsert({ program, min_headcount: minHeadcount }, { onConflict: 'program' })
  if (error) return { error: error.message }
  return {}
}

/** List slots (templates) that have occurrences in range, for filter dropdown. */
export type SlotOption = { templateId: string; label: string; program: string }

export async function getSlotOptions(range: DateRange): Promise<{
  error?: string
  data?: SlotOption[]
}> {
  await requireAdmin()
  const supabase = await createClient()
  const { data: occs, error } = await supabase
    .from('class_occurrences')
    .select('class_template_id, class_templates!inner(program, start_time)')
    .gte('local_date', range.startDate)
    .lte('local_date', range.endDate)
  if (error) return { error: error.message }
  const seen = new Set<string>()
  const out: SlotOption[] = []
  type Row = { class_template_id: string; class_templates: { program: string; start_time: string } | { program: string; start_time: string }[] }
  occs?.forEach((o: Row) => {
    const t = Array.isArray(o.class_templates) ? o.class_templates[0] : o.class_templates
    if (!t || seen.has(o.class_template_id)) return
    seen.add(o.class_template_id)
    const time = String(t.start_time).slice(0, 5)
    out.push({
      templateId: o.class_template_id,
      program: t.program,
      label: `${getProgramLabel(t.program)} ${time}`,
    })
  })
  out.sort((a, b) => a.label.localeCompare(b.label))
  return { data: out }
}

/** CSV: attendance logs (occurrence date, start time, program, title, location, capacity, headcount, logged_by, logged_at). */
export async function exportAttendanceLogsCSV(range: DateRange): Promise<{
  error?: string
  csv?: string
}> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: occs, error: occError } = await supabase
    .from('class_occurrences')
    .select(`
      id,
      local_date,
      starts_at,
      class_templates!inner(program, title, location, capacity)
    `)
    .gte('local_date', range.startDate)
    .lte('local_date', range.endDate)
    .order('local_date')

  if (occError) return { error: occError.message }
  if (!occs?.length) {
    return { csv: 'date,start_time,program,title,location,capacity,headcount,logged_by,logged_at\n' }
  }

  const occIds = occs.map((o: { id: string }) => o.id)
  const { data: logs, error: logError } = await supabase
    .from('attendance_logs')
    .select('class_occurrence_id, headcount, created_by, created_at')
    .in('class_occurrence_id', occIds)

  if (logError) return { error: logError.message }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', [...new Set((logs ?? []).map((l: { created_by: string }) => l.created_by))])

  const nameById = new Map<string, string>()
  profiles?.forEach((p: { id: string; full_name: string | null }) => {
    nameById.set(p.id, p.full_name ?? p.id)
  })

  const occById = new Map<
    string,
    { local_date: string; start_time: string; program: string; title: string; location: string | null; capacity: number | null }
  >()
  type OccRow = {
    id: string
    local_date: string
    starts_at: string
    class_templates: { program: string; title: string; location: string | null; capacity: number | null } | { program: string; title: string; location: string | null; capacity: number | null }[]
  }
  occs.forEach((o: OccRow) => {
    const t = Array.isArray(o.class_templates) ? o.class_templates[0] : o.class_templates
    const startTime = t ? new Date(o.starts_at).toISOString().slice(11, 16) : ''
    occById.set(o.id, {
      local_date: o.local_date,
      start_time: startTime,
      program: t?.program ?? '',
      title: t?.title ?? '',
      location: t?.location ?? null,
      capacity: t?.capacity ?? null,
    })
  })

  const rows: string[] = [
    'date,start_time,program,title,location,capacity,headcount,logged_by,logged_at',
  ]
  logs?.forEach((l: {
    class_occurrence_id: string
    headcount: number
    created_by: string
    created_at: string
  }) => {
    const occ = occById.get(l.class_occurrence_id)
    if (!occ) return
    const name = nameById.get(l.created_by) ?? l.created_by
    const createdAt = l.created_at ? new Date(l.created_at).toISOString() : ''
    rows.push(
      [
        occ.local_date,
        occ.start_time,
        getProgramLabel(occ.program),
        escapeCsv(occ.title),
        escapeCsv(occ.location ?? ''),
        occ.capacity ?? '',
        l.headcount,
        escapeCsv(name),
        createdAt,
      ].join(',')
    )
  })
  return { csv: rows.join('\n') }
}

/** CSV: slot summary (template_id, weekday, time, program, avg headcount, avg utilization). */
export async function exportSlotSummaryCSV(range: DateRange): Promise<{
  error?: string
  csv?: string
}> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: occs, error: occError } = await supabase
    .from('class_occurrences')
    .select(`
      id,
      class_template_id,
      class_templates!inner(program, weekday, start_time, capacity)
    `)
    .gte('local_date', range.startDate)
    .lte('local_date', range.endDate)

  if (occError) return { error: occError.message }
  if (!occs?.length) {
    return { csv: 'template_id,weekday,start_time,program,avg_headcount,avg_utilization,occurrence_count\n' }
  }

  const occIds = occs.map((o: { id: string }) => o.id)
  const { data: logs } = await supabase
    .from('attendance_logs')
    .select('class_occurrence_id, headcount')
    .in('class_occurrence_id', occIds)

  const logByOcc = new Map<string, number>()
  logs?.forEach((l: { class_occurrence_id: string; headcount: number }) => {
    logByOcc.set(l.class_occurrence_id, l.headcount)
  })

  type OccRow = {
    id: string
    class_template_id: string
    class_templates: { program: string; weekday: number; start_time: string; capacity: number | null } | { program: string; weekday: number; start_time: string; capacity: number | null }[]
  }
  const byTemplate = new Map<string, { headcounts: number[]; capacities: (number | null)[] }>()
  occs.forEach((o: OccRow) => {
    const t = Array.isArray(o.class_templates) ? o.class_templates[0] : o.class_templates
    if (!t) return
    const h = logByOcc.get(o.id)
    if (h === undefined) return
    if (!byTemplate.has(o.class_template_id)) {
      byTemplate.set(o.class_template_id, { headcounts: [], capacities: [] })
    }
    const b = byTemplate.get(o.class_template_id)!
    b.headcounts.push(h)
    b.capacities.push(t.capacity)
  })

  const templateMeta = new Map<string, { program: string; weekday: number; start_time: string }>()
  occs.forEach((o: OccRow) => {
    const t = Array.isArray(o.class_templates) ? o.class_templates[0] : o.class_templates
    if (!t || templateMeta.has(o.class_template_id)) return
    templateMeta.set(o.class_template_id, {
      program: t.program,
      weekday: t.weekday,
      start_time: String(t.start_time).slice(0, 5),
    })
  })

  const rows: string[] = [
    'template_id,weekday,start_time,program,avg_headcount,avg_utilization,occurrence_count',
  ]
  byTemplate.forEach((v, templateId) => {
    const meta = templateMeta.get(templateId)
    if (!meta) return
    const avgH = v.headcounts.reduce((a, b) => a + b, 0) / v.headcounts.length
    const withCap = v.headcounts.filter((_, i) => (v.capacities[i] ?? 0) > 0)
    const utils = withCap.map((h, i) => {
      const cap = v.capacities[v.headcounts.indexOf(h)]
      return (cap ?? 0) > 0 ? h / (cap as number) : null
    }).filter((u): u is number => u != null)
    const avgUtil = utils.length ? utils.reduce((a, b) => a + b, 0) / utils.length : ''
    rows.push(
      [
        templateId,
        meta.weekday,
        meta.start_time,
        getProgramLabel(meta.program),
        Math.round(avgH * 100) / 100,
        avgUtil !== '' ? Math.round((avgUtil as number) * 100) / 100 : '',
        v.headcounts.length,
      ].join(',')
    )
  })
  return { csv: rows.join('\n') }
}

function escapeCsv(val: string): string {
  if (!/[\n",]/.test(val)) return val
  return `"${val.replace(/"/g, '""')}"`
}

// --- Data fetchers for UI (admin-only, pass range from client)
export async function fetchOverview(range: DateRange) {
  await requireAdmin()
  return getOverview(range)
}

export async function fetchSlotTimeSeries(
  range: DateRange,
  program?: string,
  templateId?: string
) {
  await requireAdmin()
  return getSlotTimeSeries(range, { program, templateId })
}

export async function fetchAvgByProgram(range: DateRange) {
  await requireAdmin()
  return getAvgAttendanceByProgram(range)
}

export async function fetchCoachPerformance(range: DateRange) {
  await requireAdmin()
  return getCoachPerformance(range)
}

export async function fetchCapacityUtilization(range: DateRange) {
  await requireAdmin()
  return getCapacityUtilization(range, 'program')
}

export async function fetchCapacityUtilizationBySlot(range: DateRange) {
  await requireAdmin()
  return getCapacityUtilization(range, 'slot')
}

export async function fetchLowAttendanceAlerts(range: DateRange) {
  await requireAdmin()
  return getLowAttendanceAlerts(range)
}

export async function fetchMissingLogs(range: DateRange) {
  await requireAdmin()
  return getMissingLogs(range)
}

export async function fetchMissingLogsCount(range: DateRange) {
  await requireAdmin()
  return getMissingLogsCount(range)
}

/** Mark a missing occurrence as N/A (headcount 0, notes "N/A (admin)"). Admin only, uses override. */
export async function markMissingAsNa(occurrenceId: string): Promise<{ error?: string }> {
  await requireAdmin()
  const result = await logAttendance(occurrenceId, 0, {
    notes: 'N/A (admin)',
    adminOverride: true,
  })
  if ('error' in result) return { error: result.error }
  return {}
}
