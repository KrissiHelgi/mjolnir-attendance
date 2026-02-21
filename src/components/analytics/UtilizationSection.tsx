'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { UtilizationRow } from '@/lib/analytics'

type Props = {
  byProgram: UtilizationRow[] | null
  bySlot: UtilizationRow[] | null
  capacityMissingCount?: number
  error?: string
}

export function UtilizationSection({
  byProgram,
  bySlot,
  capacityMissingCount = 0,
  error,
}: Props) {
  if (error) return <p className="text-sm text-red-600">{error}</p>

  const programData = byProgram?.map((r) => ({
    name: r.programLabel ?? r.program ?? '',
    utilization: r.avgUtilization,
    count: r.occurrenceCount,
  })) ?? []

  return (
    <div className="space-y-6">
      {capacityMissingCount > 0 && (
        <p className="text-amber-700 text-sm font-medium">
          Warning: {capacityMissingCount} occurrence(s) in range have no capacity set; excluded from utilization.
        </p>
      )}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Average utilization by program</h3>
        {!programData.length ? (
          <p className="text-gray-500 text-sm">No data (or no capacity set on templates).</p>
        ) : (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={programData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 1.2]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip formatter={(v: number | undefined) => [v != null ? `${(v * 100).toFixed(1)}%` : '—', 'Utilization']} />
                <Bar dataKey="utilization" fill="#059669" name="Utilization" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      {bySlot?.length ? (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">By slot</h3>
          <ul className="text-sm space-y-1">
            {bySlot.map((r) => (
              <li key={r.slotId ?? r.program} className="flex justify-between gap-2">
                <span className="text-gray-700">{r.slotLabel ?? r.programLabel}</span>
                <span>{(r.avgUtilization * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
