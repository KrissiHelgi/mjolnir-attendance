'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canEditAttendance, LOCKED_MESSAGE } from '@/lib/attendance-lock'

export type LogAttendanceResult =
  | { success: true }
  | { error: string; code?: 'LOCKED' | 'UNAUTHORIZED' }

/**
 * Single entry point for logging/updating attendance.
 * No log yet: lock 6h after class start. Already logged: lock 30 min after last save. Admins can override.
 * Logging only allowed once class has started (not upcoming).
 */
export async function logAttendance(
  classOccurrenceId: string,
  headcount: number,
  options?: { notes?: string; adminOverride?: boolean; createdByUserId?: string }
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
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  let createdBy = user.id
  let createdByName = (profile?.full_name ?? 'Coach')?.trim() || 'Coach'

  if (isAdmin && options?.createdByUserId) {
    const { data: coachProfile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', options.createdByUserId)
      .single()
    if (coachProfile?.id) {
      createdBy = coachProfile.id
      createdByName = (coachProfile.full_name ?? 'Coach')?.trim() || 'Coach'
    }
  }

  const startsAt = new Date(occurrence.starts_at)
  if (!isAdmin && Date.now() < startsAt.getTime()) {
    return { error: 'You can only log attendance after the class has started.', code: 'UNAUTHORIZED' }
  }

  const { data: existingLog } = await supabase
    .from('attendance_logs')
    .select('updated_at')
    .eq('class_occurrence_id', classOccurrenceId)
    .single()

  const result = canEditAttendance(isAdmin, occurrence.starts_at, existingLog?.updated_at ?? null)

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
        created_by: createdBy,
        created_by_name: createdByName,
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
