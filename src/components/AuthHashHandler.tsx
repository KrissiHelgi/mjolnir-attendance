'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * If the user landed with a recovery hash (e.g. old reset link that redirected to /),
 * exchange it for a session and clean the URL.
 */
export function AuthHashHandler() {
  const router = useRouter()

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash?.slice(1) : ''
    if (!hash) return
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type')
    if (type !== 'recovery' || !accessToken || !refreshToken) return

    const supabase = createClient()
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(() => {
        window.history.replaceState(null, '', window.location.pathname)
        router.refresh()
      })
      .catch(() => {})
  }, [router])

  return null
}
