'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canEditAttendance, LOCKED_MESSAGE } from '@/lib/attendance-lock'

export type LogAttendanceResult =
  | { success: true }
  | { error: string; code?: 'LOCKED' | 'UNAUTHORIZED' }

/**
 * Single entry point for logging/updating attendance.
 * Enforces 1-hour lock after class start; admins can override.
 */
export async function logAttendance(
  classOccurrenceId: string,
  headcount: number,
  options?: { notes?: string; adminOverride?: boolean }
): Promise<LogAttendanceResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated', code: 'UNAUTHORIZED' }
  }

  const { data: occurrence, error: occError } = await supabase
    .from('class_occurrences')
    .select('id, starts_at')
    .eq('id', classOccurrenceId)
    .single()

  if (occError || !occurrence?.starts_at) {
    return { error: occurrence ? 'Occurrence has no start time' : occError?.message ?? 'Occurrence not found' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const result = canEditAttendance(isAdmin, occurrence.starts_at)

  if (!result.allowed) {
    return { error: LOCKED_MESSAGE, code: 'LOCKED' }
  }
  if (result.locked && result.isOverride && !options?.adminOverride) {
    return { error: LOCKED_MESSAGE, code: 'LOCKED' }
  }

  const { error } = await supabase
    .from('attendance_logs')
    .upsert(
      {
        class_occurrence_id: classOccurrenceId,
        headcount,
        created_by: user.id,
        notes: options?.notes ?? null,
      },
      { onConflict: 'class_occurrence_id' }
    )

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}
