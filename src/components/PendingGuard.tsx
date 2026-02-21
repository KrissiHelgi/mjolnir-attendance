'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

const ALLOWED_WHEN_PENDING = ['/pending', '/request-access', '/login']

export function PendingGuard({
  role,
}: {
  role: string | null | undefined
}) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (role !== 'pending') return
    const path = pathname ?? '/'
    if (ALLOWED_WHEN_PENDING.some((p) => path.startsWith(p))) return
    router.replace('/pending')
  }, [role, pathname, router])

  return null
}
