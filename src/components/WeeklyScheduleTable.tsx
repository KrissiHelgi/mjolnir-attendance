'use client'

import { useState } from 'react'
import { getProgramLabel } from '@/lib/programs'
import { getWeekdayLabel } from '@/lib/class-titles'
import { ScheduleForm } from '@/components/ScheduleForm'
import type { ClassTemplate } from '@/lib/actions/schedule'

export function WeeklyScheduleTable({
  classes,
  updateAction,
  deleteAction,
  canModify = false,
}: {
  classes: (ClassTemplate & { id: string })[]
  updateAction?: (id: string, data: Partial<ClassTemplate>) => Promise<{ error?: string } | { success?: boolean }>
  deleteAction: (id: string) => Promise<{ error?: string }>
  canModify?: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [editingRow, setEditingRow] = useState<(ClassTemplate & { id: string }) | null>(null)
  const [deleteRow, setDeleteRow] = useState<(ClassTemplate & { id: string }) | null>(null)

  async function handleDelete(id: string) {
    setError(null)
    const result = await deleteAction(id)
    if (result.error) setError(result.error)
    else {
      setDeleteRow(null)
      if (typeof window !== 'undefined') window.location.reload()
    }
  }

  function formatTime(st: string): string {
    return String(st).slice(0, 5)
  }

  if (classes.length === 0) {
    return (
      <p className="text-gray-500">
        No classes yet.{canModify && ' Paste a timetable above or use Add class to add recurring classes.'}
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
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Duration</th>
              {canModify && (
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {classes.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{getWeekdayLabel(row.weekday)}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{formatTime(String(row.start_time))}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{getProgramLabel(row.program)}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{row.title}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{row.location || '—'}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{row.capacity ?? '—'}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{(row as { duration_minutes?: number }).duration_minutes ?? 60}</td>
                {canModify && (
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium space-x-2">
                    {updateAction && (
                      <button
                        type="button"
                        onClick={() => setEditingRow(row)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteRow(row)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingRow && updateAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Edit class</h3>
              <p className="text-sm text-amber-800 mb-4">
                Changing day, time, or title will effectively “move” this slot. History will still follow the same class (same ID).
              </p>
              <ScheduleForm
                updateAction={updateAction}
                templateId={editingRow.id}
                initialData={{
                  program: editingRow.program,
                  title: editingRow.title,
                  weekday: editingRow.weekday,
                  start_time: formatTime(String(editingRow.start_time)),
                  location: editingRow.location,
                  capacity: editingRow.capacity,
                  duration_minutes: (editingRow as { duration_minutes?: number }).duration_minutes ?? 60,
                }}
                onSuccess={() => setEditingRow(null)}
              />
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="mt-4 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900">Delete this class?</h3>
            <p className="mt-2 text-sm text-gray-600">
              Remove <strong>{getWeekdayLabel(deleteRow.weekday)} {formatTime(String(deleteRow.start_time))} — {getProgramLabel(deleteRow.program)} {deleteRow.title}</strong> from the weekly schedule?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteRow(null)}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteRow.id)}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
