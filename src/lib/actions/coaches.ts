'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { isSuperAdmin } from '@/lib/helpers'

export type CoachRow = {
  id: string
  email: string
  full_name: string | null
  role: 'coach' | 'head_coach'
}

/** List all coaches (and head coaches) for super-admin Coach management. */
export async function getCoachesForManagement(): Promise<
  { error: string } | { data: CoachRow[] }
> {
  if (!(await isSuperAdmin())) return { error: 'Unauthorized' }
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    return { error: 'Missing SUPABASE_SERVICE_ROLE_KEY. Add it in Vercel (and .env.local) for Coach management.' }
  }
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['coach', 'head_coach'])
    .order('full_name', { ascending: true, nullsFirst: false })
  if (!profiles?.length) return { data: [] }
  const emails: Record<string, string> = {}
  for (const p of profiles) {
    const { data: user } = await supabase.auth.admin.getUserById(p.id)
    emails[p.id] = user?.user?.email ?? ''
  }
  const data: CoachRow[] = profiles.map((p) => ({
    id: p.id,
    email: emails[p.id] ?? '',
    full_name: p.full_name ?? null,
    role: p.role as 'coach' | 'head_coach',
  }))
  return { data }
}

/** Update a coach's role (coach | head_coach). Super-admin only. */
export async function updateCoachRole(
  userId: string,
  role: 'coach' | 'head_coach'
): Promise<{ error?: string }> {
  if (!(await isSuperAdmin())) return { error: 'Unauthorized' }
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { error: 'Missing SUPABASE_SERVICE_ROLE_KEY.' }
  }
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) return { error: error.message }
  return {}
}

/** Generate a password-reset link for the user. Super-admin only. */
export async function generateResetPasswordLink(
  email: string
): Promise<{ error: string } | { link: string }> {
  if (!(await isSuperAdmin())) return { error: 'Unauthorized' }
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { error: 'Missing SUPABASE_SERVICE_ROLE_KEY.' }
  }
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: email.trim(),
  })
  if (error) return { error: error.message }
  const link = data?.properties?.action_link
  if (!link) return { error: 'No link generated' }
  return { link }
}

/** Remove coach: delete auth user (cascade deletes profile). Super-admin only. */
export async function removeCoach(userId: string): Promise<{ error?: string }> {
  if (!(await isSuperAdmin())) return { error: 'Unauthorized' }
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { error: 'Missing SUPABASE_SERVICE_ROLE_KEY.' }
  }
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }
  return {}
}
