'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/helpers'

/**
 * Delete a class occurrence (this instance only). Admin only. Template stays so class appears again next week.
 */
export async function deleteOccurrence(occurrenceId: string): Promise<{ error?: string }> {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin') return { error: 'Unauthorized' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('class_occurrences')
    .delete()
    .eq('id', occurrenceId)

  if (error) return { error: error.message }
  revalidatePath('/')
  return {}
}

/**
 * Get or create a class_occurrence for (template_id, local_date).
 * starts_at is required; pass startTime (HH:MM or HH:MM:SS).
 * Returns id and starts_at (ISO string).
 */
export async function getOrCreateOccurrence(
  classTemplateId: string,
  localDate: string,
  startTime: string
): Promise<{ data?: { id: string; starts_at: string }; error?: string }> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('class_occurrences')
    .select('id, starts_at')
    .eq('class_template_id', classTemplateId)
    .eq('local_date', localDate)
    .single()

  if (existing?.starts_at) {
    return { data: { id: existing.id, starts_at: existing.starts_at } }
  }
  if (existing?.id) {
    return { data: { id: existing.id, starts_at: existing.starts_at ?? '' } }
  }

  const [h, m] = startTime.split(':').map(Number)
  const d = new Date(localDate + 'T00:00:00Z')
  d.setUTCHours(h, m ?? 0, 0, 0)
  const startsAt = d.toISOString()

  const { data: created, error } = await supabase
    .from('class_occurrences')
    .insert({
      class_template_id: classTemplateId,
      local_date: localDate,
      starts_at: startsAt,
    })
    .select('id, starts_at')
    .single()

  if (error) return { error: error.message }
  return { data: { id: created!.id, starts_at: created!.starts_at ?? startsAt } }
}
