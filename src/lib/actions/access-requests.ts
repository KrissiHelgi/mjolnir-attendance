'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { isSuperAdmin } from '@/lib/helpers'

export type AccessRequestRow = {
  id: string
  email: string
  full_name: string | null
  status: string
  created_at: string
}

/** Submit an access request (no auth required). */
export async function submitAccessRequest(
  email: string,
  fullName: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const em = (email ?? '').trim().toLowerCase()
  const name = (fullName ?? '').trim()
  if (!em) return { error: 'Email is required' }
  const { error } = await supabase.from('access_requests').insert({
    email: em,
    full_name: name || null,
    status: 'pending',
  })
  if (error) return { error: error.message }
  return {}
}

/** List pending access requests. Super-admin only. */
export async function getPendingAccessRequests(): Promise<
  { error: string } | { data: AccessRequestRow[] }
> {
  if (!(await isSuperAdmin())) return { error: 'Unauthorized' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('access_requests')
    .select('id, email, full_name, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) return { error: error.message }
  return { data: (data ?? []).map((r) => ({ ...r, created_at: String(r.created_at) })) }
}

/** Approve request: invite user by email, create profile as coach, mark request approved. Super-admin only. */
export async function approveAccessRequest(requestId: string): Promise<{ error?: string }> {
  if (!(await isSuperAdmin())) return { error: 'Unauthorized' }
  const supabase = await createClient()
  const { data: req, error: fetchErr } = await supabase
    .from('access_requests')
    .select('email, full_name')
    .eq('id', requestId)
    .eq('status', 'pending')
    .single()
  if (fetchErr || !req) return { error: 'Request not found or already handled' }

  let admin
  try {
    admin = createServiceRoleClient()
  } catch {
    return { error: 'Missing SUPABASE_SERVICE_ROLE_KEY.' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    req.email,
    {
      data: { full_name: req.full_name ?? '' },
      redirectTo: appUrl ? `${appUrl}/` : undefined,
    }
  )
  if (inviteErr) return { error: inviteErr.message }

  const userId = inviteData?.user?.id
  if (userId) {
    await admin.from('profiles').upsert({
      id: userId,
      full_name: req.full_name || null,
      role: 'coach',
      coached_programs: [],
    })
  }

  const { data: { user } } = await supabase.auth.getUser()
  await supabase
    .from('access_requests')
    .update({ status: 'approved', decided_at: new Date().toISOString(), decided_by: user?.id ?? null })
    .eq('id', requestId)
  return {}
}

/** Deny request. Super-admin only. */
export async function denyAccessRequest(requestId: string): Promise<{ error?: string }> {
  if (!(await isSuperAdmin())) return { error: 'Unauthorized' }
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('access_requests')
    .update({
      status: 'denied',
      decided_at: new Date().toISOString(),
      decided_by: user.data.user?.id ?? null,
    })
    .eq('id', requestId)
    .eq('status', 'pending')
  if (error) return { error: error.message }
  return {}
}
