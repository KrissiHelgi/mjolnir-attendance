'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { isSuperAdmin } from '@/lib/helpers'

export type AccessRequestRow = {
  id: string
  user_id: string | null
  email: string
  full_name: string | null
  status: string
  created_at: string
}

/** Create account: creates auth user, profile (pending), and access request. Requires service role. */
export async function createAccount(
  email: string,
  fullName: string,
  password: string
): Promise<{ error?: string }> {
  const em = (email ?? '').trim().toLowerCase()
  const name = (fullName ?? '').trim()
  const pw = password ?? ''
  if (!em) return { error: 'Email is required' }
  if (pw.length < 6) return { error: 'Password must be at least 6 characters' }

  let admin
  try {
    admin = createServiceRoleClient()
  } catch {
    return { error: 'Server configuration error. Try again later.' }
  }

  const { data: userData, error: createErr } = await admin.auth.admin.createUser({
    email: em,
    password: pw,
    email_confirm: true,
    user_metadata: { full_name: name || '' },
  })
  if (createErr) return { error: createErr.message }
  const userId = userData?.user?.id
  if (!userId) return { error: 'Account could not be created' }

  await admin.from('profiles').upsert({
    id: userId,
    full_name: name || null,
    role: 'pending',
    coached_programs: [],
  })

  const { error: reqErr } = await admin.from('access_requests').insert({
    user_id: userId,
    email: em,
    full_name: name || null,
    status: 'pending',
  })
  if (reqErr) return { error: reqErr.message }
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
    .select('id, user_id, email, full_name, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) return { error: error.message }
  return {
    data: (data ?? []).map((r) => ({
      ...r,
      user_id: r.user_id ?? null,
      created_at: String(r.created_at),
    })),
  }
}

/** Approve request: set profile to coach, mark request approved. Super-admin only. */
export async function approveAccessRequest(requestId: string): Promise<{ error?: string }> {
  if (!(await isSuperAdmin())) return { error: 'Unauthorized' }
  const supabase = await createClient()
  const { data: req, error: fetchErr } = await supabase
    .from('access_requests')
    .select('user_id, email, full_name')
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

  const userId = req.user_id
  if (userId) {
    await admin.from('profiles').update({ role: 'coach' }).eq('id', userId)
  } else {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
    const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      req.email,
      {
        data: { full_name: req.full_name ?? '' },
        redirectTo: appUrl ? `${appUrl}/` : undefined,
      }
    )
    if (inviteErr) return { error: inviteErr.message }
    const id = inviteData?.user?.id
    if (id) {
      await admin.from('profiles').upsert({
        id,
        full_name: req.full_name || null,
        role: 'coach',
        coached_programs: [],
      })
    }
  }

  const { data } = await supabase.auth.getUser()
  await supabase
    .from('access_requests')
    .update({ status: 'approved', decided_at: new Date().toISOString(), decided_by: data?.user?.id ?? null })
    .eq('id', requestId)
  return {}
}

/** Deny request: if user_id set, delete auth user (removes profile). Super-admin only. */
export async function denyAccessRequest(requestId: string): Promise<{ error?: string }> {
  if (!(await isSuperAdmin())) return { error: 'Unauthorized' }
  const supabase = await createClient()
  const { data: req } = await supabase
    .from('access_requests')
    .select('user_id')
    .eq('id', requestId)
    .eq('status', 'pending')
    .single()

  if (req?.user_id) {
    let admin
    try {
      admin = createServiceRoleClient()
    } catch {
      // still mark denied
    }
    if (admin) await admin.auth.admin.deleteUser(req.user_id)
  }

  const { data } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('access_requests')
    .update({
      status: 'denied',
      decided_at: new Date().toISOString(),
      decided_by: data?.user?.id ?? null,
    })
    .eq('id', requestId)
    .eq('status', 'pending')
  if (error) return { error: error.message }
  return {}
}
