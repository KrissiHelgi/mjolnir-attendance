'use server'

import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Unauthorized')
}

export async function getScheduleCsvUrl(): Promise<{ error?: string; url?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Unauthorized' }
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'schedule_csv_url').single()
  if (error) return { error: error.message }
  return { url: (data as { value: string } | null)?.value ?? '' }
}

export async function setScheduleCsvUrl(url: string): Promise<{ error?: string }> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('app_settings').upsert({ key: 'schedule_csv_url', value: url.trim() }, { onConflict: 'key' })
  if (error) return { error: error.message }
  return {}
}
