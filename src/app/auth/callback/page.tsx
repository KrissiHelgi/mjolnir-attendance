'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Handles redirect from Supabase after user clicks a reset-password (recovery) link.
 * Tokens are in the URL hash; we set the session and redirect to dashboard.
 */
export default function AuthCallbackPage() {
  const router = useRouter()
  const [message, setMessage] = useState<string>('Completing sign-in…')

  useEffect(() => {
    const hash = window.location.hash?.slice(1)
    if (!hash) {
      setMessage('Invalid or expired link.')
      return
    }
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type')

    if (type !== 'recovery' || !accessToken || !refreshToken) {
      setMessage('Invalid or expired link.')
      return
    }

    const supabase = createClient()
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(() => {
        router.replace('/')
        router.refresh()
      })
      .catch(() => {
        setMessage('Something went wrong. Try the link again or request a new one.')
      })
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-gray-700">{message}</p>
      </div>
    </div>
  )
}
