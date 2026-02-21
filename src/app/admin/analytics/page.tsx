import { getCurrentProfile } from '@/lib/helpers'
import { redirect } from 'next/navigation'
import { defaultDateRange } from '@/lib/analytics'
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient'

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; view?: string }>
}) {
  const profile = await getCurrentProfile()

  if (!profile || profile.role !== 'admin') {
    redirect('/')
  }

  const params = await searchParams
  const initialRange = defaultDateRange()

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Date range, attendance trends, coach performance, capacity utilization, alerts, and CSV export.
        </p>
      </div>

      <AnalyticsClient
        initialRange={initialRange}
        initialTab={params.tab === 'alerts' ? 'Alerts' : undefined}
        initialView={params.view === 'missing' ? 'missing' : undefined}
      />
    </div>
  )
}
