'use client'

import Link from 'next/link'

export function AdminMissingBanner({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <Link
      href="/admin/analytics?tab=alerts&view=missing"
      className="block rounded-lg bg-amber-100 border border-amber-200 px-4 py-3 text-sm font-medium text-amber-900 hover:bg-amber-200 mb-4"
    >
      Missing logs (last 7 days): {count}
    </Link>
  )
}
