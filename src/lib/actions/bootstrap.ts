'use server'

import { createClient } from '@/lib/supabase/server'

export async function makeMeAdmin() {
  if (process.env.NODE_ENV === 'production') {
    return { error: 'Not available in production' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', user.id)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
