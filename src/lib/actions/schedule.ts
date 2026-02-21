'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isValidProgramKey } from '@/lib/programs'
import { parsePasteTimetable } from '@/lib/paste-timetable'
import { isSuperAdmin } from '@/lib/helpers'
import { getTitlesForProgram } from '@/lib/class-titles'

export type ClassTemplate = {
  id?: string
  program: string
  title: string
  weekday: number
  start_time: string
  location?: string
  capacity?: number
}

export async function createTemplate(data: ClassTemplate) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await isSuperAdmin())) {
    return { error: 'Unauthorized' }
  }

  if (!isValidProgramKey(data.program)) {
    return { error: 'Invalid program key' }
  }

  const { error, data: template } = await supabase
    .from('class_templates')
    .insert({ program: data.program, title: data.title, weekday: data.weekday, start_time: data.start_time, location: data.location ?? null, capacity: data.capacity ?? null })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/schedule')
  return { data: template }
}

/** Create multiple weekly classes (one per selected weekday). Super admin only. */
export async function createWeeklyClasses(params: {
  program: string
  title: string
  weekdays: number[]
  start_time: string
  location?: string
  capacity?: number
}): Promise<{ error?: string } | { count: number; ids: string[] }> {
  if (!(await isSuperAdmin())) return { error: 'Unauthorized' }
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { program, title, weekdays, start_time, location, capacity } = params
  if (!isValidProgramKey(program)) return { error: 'Invalid program' }
  const allowedTitles = getTitlesForProgram(program)
  if (!allowedTitles.includes(title)) return { error: 'Invalid title for this program' }
  if (!Array.isArray(weekdays) || weekdays.length === 0) return { error: 'Select at least one day' }
  const validDays = weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  if (validDays.length === 0) return { error: 'Select at least one day' }
  const timeStr = String(start_time ?? '').trim()
  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/)
  if (!timeMatch) return { error: 'Invalid time (use HH:MM)' }
  const h = parseInt(timeMatch[1], 10)
  const m = parseInt(timeMatch[2], 10)
  if (h < 0 || h > 23 || m < 0 || m > 59) return { error: 'Invalid time' }
  const normalizedTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

  const rows = validDays.map((weekday) => ({
    program,
    title,
    weekday,
    start_time: normalizedTime,
    location: location?.trim() || null,
    capacity: capacity != null && capacity >= 0 ? capacity : null,
  }))

  const { data: inserted, error } = await supabase
    .from('class_templates')
    .insert(rows)
    .select('id')

  if (error) return { error: error.message }
  revalidatePath('/admin/schedule')
  revalidatePath('/')
  return { count: inserted?.length ?? 0, ids: (inserted ?? []).map((r) => r.id) }
}

export async function updateTemplate(id: string, data: Partial<ClassTemplate>) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await isSuperAdmin())) {
    return { error: 'Unauthorized' }
  }

  if (data.program !== undefined && !isValidProgramKey(data.program)) {
    return { error: 'Invalid program key' }
  }

  const { error } = await supabase
    .from('class_templates')
    .update(data)
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/schedule')
  return { success: true }
}

/** Update capacity and/or location for all class_templates with the given program. Super admin only. */
export async function updateProgramDefaults(
  program: string,
  data: { location?: string | null; capacity?: number | null }
): Promise<{ error?: string } | { updated: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await isSuperAdmin())) return { error: 'Unauthorized' }
  if (!isValidProgramKey(program)) return { error: 'Invalid program' }

  const updatePayload: { location?: string | null; capacity?: number | null } = {}
  if (data.location !== undefined) updatePayload.location = data.location === '' ? null : data.location
  if (data.capacity !== undefined) updatePayload.capacity = data.capacity === null || data.capacity === '' || Number.isNaN(Number(data.capacity)) || Number(data.capacity) < 0 ? null : Number(data.capacity)

  if (Object.keys(updatePayload).length === 0) return { error: 'Nothing to update' }

  const { data: updated, error } = await supabase
    .from('class_templates')
    .update(updatePayload)
    .eq('program', program)
    .select('id')

  if (error) return { error: error.message }
  revalidatePath('/admin/schedule')
  revalidatePath('/')
  return { updated: updated?.length ?? 0 }
}

export async function deleteTemplate(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await isSuperAdmin())) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('class_templates')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/schedule')
  return { success: true }
}

/** Parse pasted TSV and overwrite class_templates via sync_class_templates RPC. Super admin only. */
export async function importPasteTimetable(tsv: string): Promise<
  | { error: string }
  | { imported: number; excluded: number }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await isSuperAdmin())) return { error: 'Unauthorized' }

  const result = parsePasteTimetable(tsv)
  if (result.included.length === 0) {
    return { error: 'No rows to import. Check format: Day, Time, Class name, Sport (tab or space separated). Excluded: ' + result.excluded.length }
  }

  const payload = result.included.map((t) => ({
    program: t.program,
    title: t.title,
    weekday: t.weekday,
    start_time: t.start_time,
    location: t.location ?? undefined,
    capacity: t.capacity ?? undefined,
  }))

  const { error } = await supabase.rpc('sync_class_templates', { p_templates: payload })
  if (error) return { error: error.message }
  revalidatePath('/admin/schedule')
  revalidatePath('/')
  return { imported: result.included.length, excluded: result.excluded.length }
}

/** Clear entire weekly schedule (delete all class_templates). Super admin only. */
export async function clearSchedule(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await isSuperAdmin())) return { error: 'Unauthorized' }
  const { error } = await supabase.rpc('sync_class_templates', { p_templates: [] })
  if (error) return { error: error.message }
  revalidatePath('/admin/schedule')
  revalidatePath('/')
  return {}
}

/** Whether any attendance logs exist (used to strengthen overwrite warning). */
export async function hasAttendanceLogs(): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('id')
    .limit(1)
  if (error) return false
  return (data?.length ?? 0) > 0
}
