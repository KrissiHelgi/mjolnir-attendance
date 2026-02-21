import { createClient } from '@supabase/supabase-js'

/**
 * Server-only. Use only for super-admin Coach management (list users, generate reset link, delete user, update profile).
 * Requires SUPABASE_SERVICE_ROLE_KEY in env.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (required for Coach management)')
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
