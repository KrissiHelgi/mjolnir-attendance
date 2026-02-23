'use client'

import { useMemo } from 'react'
import { getProgramLabel } from '@/lib/programs'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { WeeklyWeekdayRow } from '@/lib/analytics'

const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#ea580c', '#4f46e5', '#0d9488', '#ca8a04']

type Props = {
  data: WeeklyWeekdayRow[] | null
  programKeys: string[]
  programFilter: string
  onProgramFilterChange: (v: string) => void
  error?: string
}

export function WeeklySection({
  data,
  programKeys,
  programFilter,
  onProgramFilterChange,
  error,
}: Props) {
  const programKeysInData = useMemo(() => {
    if (!data?.length) return []
    const keys = new Set<string>()
    data.forEach((row) => {
      Object.keys(row).forEach((k) => {
        if (k !== 'weekday') keys.add(k)
      })
    })
    return [...keys].sort()
  }, [data])

  const linesToShow = programFilter
    ? programKeysInData.filter((k) => k === programFilter)
    : programKeysInData

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Shows average attendance per weekday for the selected date range. If you select a single week (Mon–Sun), the values equal that week’s totals per day.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Program</span>
          <select
            value={programFilter}
            onChange={(e) => onProgramFilterChange(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All programs</option>
            {programKeys.map((k) => (
              <option key={k} value={k}>
                {getProgramLabel(k)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!data?.length || linesToShow.length === 0 ? (
        <p className="text-gray-500 text-sm">No data for this range and program filter.</p>
      ) : (
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="weekday" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip labelStyle={{ color: '#111' }} />
              <Legend />
              {linesToShow.map((programKey, i) => (
                <Line
                  key={programKey}
                  type="monotone"
                  dataKey={programKey}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={getProgramLabel(programKey)}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
