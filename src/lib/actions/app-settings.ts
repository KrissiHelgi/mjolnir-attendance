'use server'

import { createClient } from '@/lib/supabase/server'

/** Reserved for future app-wide settings. Schedule is paste-only (no CSV URL). */
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Unauthorized')
}

export async function getAppSetting(_key: string): Promise<{ error?: string; value?: string }> {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', _key).single()
  if (error) return { error: error.message }
  return { value: (data as { value: string } | null)?.value ?? '' }
}

export async function setAppSetting(key: string, value: string): Promise<{ error?: string }> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('app_settings').upsert({ key, value: value.trim(), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return { error: error.message }
  return {}
}
