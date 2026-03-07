'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/helpers'
import { getOrCreateOccurrence } from '@/lib/actions/dashboard'

async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin') throw new Error('Unauthorized')
}

export type Course = {
  id: string
  name: string
  program: string | null
  start_date: string
  end_date: string
  created_at: string
}

export async function listCourses(): Promise<{ data?: Course[]; error?: string }> {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('courses')
    .select('id, name, program, start_date, end_date, created_at')
    .order('start_date', { ascending: false })
  if (error) return { error: error.message }
  return { data: (data ?? []) as Course[] }
}

export async function createCourse(params: {
  name: string
  program?: string | null
  start_date: string
  end_date: string
}): Promise<{ data?: Course; error?: string }> {
  await requireAdmin()
  const name = params.name?.trim()
  if (!name || name.length > 200) return { error: 'Name is required (max 200 characters)' }
  const start = params.start_date
  const end = params.end_date
  if (!start || !end) return { error: 'Start and end date are required' }
  if (end < start) return { error: 'End date must be on or after start date' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('courses')
    .insert({
      name,
      program: params.program?.trim() || null,
      start_date: start,
      end_date: end,
    })
    .select('id, name, program, start_date, end_date, created_at')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/admin/courses')
  revalidatePath('/admin/analytics')
  return { data: data as Course }
}

export async function updateCourse(
  id: string,
  params: { name?: string; program?: string | null; start_date?: string; end_date?: string }
): Promise<{ error?: string }> {
  await requireAdmin()
  const supabase = await createClient()
  const updates: { name?: string; program?: string | null; start_date?: string; end_date?: string } = {}
  if (params.name !== undefined) {
    const name = params.name?.trim()
    if (!name || name.length > 200) return { error: 'Name is required (max 200 characters)' }
    updates.name = name
  }
  if (params.program !== undefined) updates.program = params.program?.trim() || null
  if (params.start_date !== undefined) updates.start_date = params.start_date
  if (params.end_date !== undefined) updates.end_date = params.end_date
  if (params.start_date !== undefined && params.end_date !== undefined && params.end_date < params.start_date) {
    return { error: 'End date must be on or after start date' }
  }
  if (Object.keys(updates).length === 0) return {}

  const { error } = await supabase.from('courses').update(updates).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/courses')
  revalidatePath('/admin/analytics')
  return {}
}

export async function deleteCourse(id: string): Promise<{ error?: string }> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/courses')
  revalidatePath('/admin/analytics')
  return {}
}

/** Get or create occurrences for each (template, date) in course range and set course_id. */
export async function addSessionsToCourse(
  courseId: string,
  templateIds: string[]
): Promise<{ error?: string; added?: number }> {
  await requireAdmin()
  if (!templateIds?.length) return { error: 'Select at least one class (template)' }

  const supabase = await createClient()
  const { data: course, error: courseErr } = await supabase
    .from('courses')
    .select('id, start_date, end_date')
    .eq('id', courseId)
    .single()
  if (courseErr || !course) return { error: courseErr?.message ?? 'Course not found' }

  const { data: templates, error: tplErr } = await supabase
    .from('class_templates')
    .select('id, start_time')
    .in('id', templateIds)
  if (tplErr || !templates?.length) return { error: 'Could not load templates' }

  const start = new Date((course as { start_date: string }).start_date + 'T12:00:00Z')
  const end = new Date((course as { end_date: string }).end_date + 'T12:00:00Z')
  let added = 0
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    const localDate = `${y}-${m}-${day}`
    for (const t of templates as { id: string; start_time: string }[]) {
      const st = String(t.start_time).slice(0, 5)
      const result = await getOrCreateOccurrence(t.id, localDate, st)
      if (result.error) continue
      if (result.data?.id) {
        const { error: updateErr } = await supabase
          .from('class_occurrences')
          .update({ course_id: courseId })
          .eq('id', result.data.id)
        if (!updateErr) added++
      }
    }
  }
  revalidatePath('/admin/courses')
  revalidatePath('/admin/analytics')
  return { added }
}

export type CourseSessionRow = {
  id: string
  local_date: string
  starts_at: string
  program: string
  title: string
  start_time: string
  weekday: number
}

/** List occurrences that belong to this course (for admin course detail). */
export async function listCourseSessions(courseId: string): Promise<{
  data?: CourseSessionRow[]
  error?: string
}> {
  await requireAdmin()
  const supabase = await createClient()
  const { data: occs, error: occErr } = await supabase
    .from('class_occurrences')
    .select(`
      id,
      local_date,
      starts_at,
      class_templates!inner(program, title, start_time, weekday)
    `)
    .eq('course_id', courseId)
    .order('local_date')
    .order('starts_at')
  if (occErr) return { error: occErr.message }
  const rows: CourseSessionRow[] = (occs ?? []).map((o: {
    id: string
    local_date: string
    starts_at: string
    class_templates: { program: string; title: string; start_time: string; weekday: number } | { program: string; title: string; start_time: string; weekday: number }[]
  }) => {
    const t = Array.isArray(o.class_templates) ? o.class_templates[0] : o.class_templates
    return {
      id: o.id,
      local_date: o.local_date,
      starts_at: o.starts_at,
      program: t?.program ?? '',
      title: t?.title ?? '',
      start_time: String(t?.start_time ?? '').slice(0, 5),
      weekday: t?.weekday ?? 0,
    }
  })
  return { data: rows }
}

/** List class_templates for the "Add sessions" picker (live only). Deduplicated by (weekday, start_time, program, title) so the same logical slot does not appear twice and cause duplicate sessions. */
export async function listTemplatesForCoursePicker(): Promise<{
  data?: { id: string; program: string; title: string; weekday: number; start_time: string }[]
  error?: string
}> {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('class_templates')
    .select('id, program, title, weekday, start_time')
    .eq('live', true)
    .order('weekday')
    .order('start_time')
  if (error) return { error: error.message }
  const list = (data ?? []) as { id: string; program: string; title: string; weekday: number; start_time: string }[]
  const seen = new Set<string>()
  const deduped = list.filter((t) => {
    const key = `${t.weekday}|${String(t.start_time).slice(0, 5)}|${t.program}|${t.title}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { data: deduped }
}

/** Remove course from an occurrence (set course_id to null). */
export async function removeOccurrenceFromCourse(occurrenceId: string): Promise<{ error?: string }> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase
    .from('class_occurrences')
    .update({ course_id: null })
    .eq('id', occurrenceId)
  if (error) return { error: error.message }
  revalidatePath('/admin/courses')
  revalidatePath('/admin/analytics')
  return {}
}
