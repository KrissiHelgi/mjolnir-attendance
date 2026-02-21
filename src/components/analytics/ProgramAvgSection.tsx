'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { ProgramAvgRow } from '@/lib/analytics'

export function ProgramAvgSection({ data, error }: { data: ProgramAvgRow[] | null; error?: string }) {
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!data?.length) return <p className="text-gray-500 text-sm">No data.</p>

  return (
    <div className="space-y-4">
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="programLabel" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="avgHeadcount" fill="#2563eb" name="Avg headcount" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 font-medium text-gray-700">Program</th>
            <th className="text-right py-2 font-medium text-gray-700">Avg headcount</th>
            <th className="text-right py-2 font-medium text-gray-700">Classes logged</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.program} className="border-b border-gray-100">
              <td className="py-2">{row.programLabel}</td>
              <td className="text-right py-2">{row.avgHeadcount}</td>
              <td className="text-right py-2">{row.occurrenceCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
