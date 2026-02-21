'use client'

import { useState } from 'react'
import { getProgramLabel } from '@/lib/programs'
import type { ClassTemplate } from '@/lib/actions/schedule'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function WeeklyScheduleTable({
  classes,
  deleteAction,
}: {
  classes: (ClassTemplate & { id: string })[]
  deleteAction: (id: string) => Promise<{ error?: string }>
}) {
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Remove this class from the weekly schedule?')) return
    setError(null)
    const result = await deleteAction(id)
    if (result.error) setError(result.error)
    else if (typeof window !== 'undefined') window.location.reload()
  }

  if (classes.length === 0) {
    return (
      <p className="text-gray-500">
        No classes yet. Paste a timetable above and click <strong>Import (Overwrite schedule)</strong> to add them.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Day</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Program</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Capacity</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {classes.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{WEEKDAYS[row.weekday]}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{String(row.start_time).slice(0, 5)}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{getProgramLabel(row.program)}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{row.title}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{row.location || '—'}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{row.capacity ?? '—'}</td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => handleDelete(row.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
