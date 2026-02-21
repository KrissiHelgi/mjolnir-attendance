'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isValidProgramKey } from '@/lib/programs'
import { parsePasteTimetable } from '@/lib/paste-timetable'

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
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
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

export async function updateTemplate(id: string, data: Partial<ClassTemplate>) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
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

export async function deleteTemplate(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
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

/** Parse pasted TSV and overwrite class_templates via sync_class_templates RPC. Admin only. */
export async function importPasteTimetable(tsv: string): Promise<
  | { error: string }
  | { imported: number; excluded: number }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Unauthorized' }

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

/** Clear entire weekly schedule (delete all class_templates). Admin only. */
export async function clearSchedule(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Unauthorized' }
  const { error } = await supabase.rpc('sync_class_templates', { p_templates: [] })
  if (error) return { error: error.message }
  revalidatePath('/admin/schedule')
  revalidatePath('/')
  return {}
}
