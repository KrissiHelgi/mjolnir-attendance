'use client'

import type { CoachPerformanceRow } from '@/lib/analytics'
import { getProgramLabel } from '@/lib/programs'

export function CoachesSection({ data, error }: { data: CoachPerformanceRow[] | null; error?: string }) {
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!data?.length) return <p className="text-gray-500 text-sm">No data.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 font-medium text-gray-700">Coach</th>
            <th className="text-right py-2 font-medium text-gray-700">Total logs</th>
            <th className="text-right py-2 font-medium text-gray-700">Avg headcount</th>
            <th className="text-left py-2 font-medium text-gray-700">Programs</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.coachId} className="border-b border-gray-100">
              <td className="py-2 font-medium">{row.coachName}</td>
              <td className="text-right py-2">{row.totalLogs}</td>
              <td className="text-right py-2">{row.avgHeadcount}</td>
              <td className="py-2 text-gray-600">
                {row.programs.map((p) => getProgramLabel(p)).join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
