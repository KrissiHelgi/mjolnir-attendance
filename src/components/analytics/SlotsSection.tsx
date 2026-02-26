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
import type { SlotTimeSeriesPoint } from '@/lib/analytics'
import type { SlotOption } from '@/lib/actions/analytics'

type Props = {
  data: SlotTimeSeriesPoint[] | null
  slotOptions: SlotOption[] | null
  programKeys: string[]
  programFilter: string
  slotFilter: string
  onProgramFilterChange: (v: string) => void
  onSlotFilterChange: (v: string) => void
  error?: string
}

export function SlotsSection({
  data,
  slotOptions,
  programKeys,
  programFilter,
  slotFilter,
  onProgramFilterChange,
  onSlotFilterChange,
  error,
}: Props) {
  const chartData = useMemo(() => {
    if (!data?.length) return []
    const byWeek = new Map<string, Record<string, number | string>>()
    data.forEach((d) => {
      if (!byWeek.has(d.weekStart)) byWeek.set(d.weekStart, { weekStart: d.weekStart })
      const row = byWeek.get(d.weekStart)!
      row[d.slotLabel] = d.avgHeadcount
    })
    return [...byWeek.values()].sort((a, b) => (a.weekStart as string).localeCompare(b.weekStart as string))
  }, [data])

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>
  }

  const slotLabels = useMemo(() => [...new Set(data?.map((d) => d.slotLabel) ?? [])], [data])
  const colors = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2']
  const slotsForProgram = useMemo(
    () =>
      !programFilter
        ? slotOptions ?? []
        : (slotOptions ?? []).filter((s) => s.program === programFilter),
    [slotOptions, programFilter]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Program</span>
          <select
            value={programFilter}
            onChange={(e) => {
              onProgramFilterChange(e.target.value)
              onSlotFilterChange('')
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {programKeys.map((k) => (
              <option key={k} value={k}>
                {getProgramLabel(k)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Slot</span>
          <select
            value={slotsForProgram.some((s) => s.templateId === slotFilter) ? slotFilter : ''}
            onChange={(e) => onSlotFilterChange(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm min-w-[220px]"
          >
            <option value="">All</option>
            {slotsForProgram.map((s) => (
              <option key={s.templateId} value={s.templateId}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {chartData.length === 0 ? (
        <p className="text-gray-500 text-sm">No data for this range and filters.</p>
      ) : (
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="weekStart" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip labelStyle={{ color: '#111' }} />
              <Legend />
              {slotLabels.slice(0, 6).map((label, i) => (
                <Line
                  key={label}
                  type="monotone"
                  dataKey={label}
                  stroke={colors[i % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={label}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
