'use client'

import { useState, useMemo } from 'react'
import type { CoachPerformanceRow } from '@/lib/analytics'
import { getProgramLabel } from '@/lib/programs'

type SortBy = 'avg_headcount' | 'total_logs'

export function CoachesSection({ data, error }: { data: CoachPerformanceRow[] | null; error?: string }) {
  const [sortBy, setSortBy] = useState<SortBy>('avg_headcount')

  const sortedData = useMemo(() => {
    if (!data?.length) return []
    const copy = [...data]
    if (sortBy === 'avg_headcount') {
      copy.sort((a, b) => b.avgHeadcount - a.avgHeadcount)
    } else {
      copy.sort((a, b) => b.totalLogs - a.totalLogs)
    }
    return copy
  }, [data, sortBy])

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!data?.length) return <p className="text-gray-500 text-sm">No data.</p>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-600">Sort by:</span>
        <button
          type="button"
          onClick={() => setSortBy('avg_headcount')}
          className={`px-2.5 py-1 rounded-md font-medium ${
            sortBy === 'avg_headcount'
              ? 'bg-gray-200 text-gray-800'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Avg headcount
        </button>
        <button
          type="button"
          onClick={() => setSortBy('total_logs')}
          className={`px-2.5 py-1 rounded-md font-medium ${
            sortBy === 'total_logs'
              ? 'bg-gray-200 text-gray-800'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Total logs
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 font-medium text-gray-700">Coach</th>
              <th className="text-right py-2 font-medium text-gray-700">Total logs</th>
              <th className="text-right py-2 font-medium text-gray-700">Avg headcount</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row) => (
              <tr key={row.coachId} className="border-b border-gray-100">
                <td className="py-2">
                  <div className="font-medium text-gray-900">{row.coachName}</div>
                  {row.programs.length > 0 && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {row.programs.map((p) => getProgramLabel(p)).join(', ')}
                    </div>
                  )}
                </td>
                <td className="text-right py-2">{row.totalLogs}</td>
                <td className="text-right py-2">{row.avgHeadcount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
