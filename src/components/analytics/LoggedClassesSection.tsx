'use client'

import { useState, useEffect } from 'react'
import type { LoggedClassRow } from '@/lib/analytics'
import { deleteAttendanceLog } from '@/lib/actions/analytics'
import { formatLocalDateLabel } from '@/lib/dates'

type Props = {
  selectedDate: string
  onDateChange: (date: string) => void
  data: LoggedClassRow[] | null
  error?: string
  onDeleted?: () => void
}

export function LoggedClassesSection({
  selectedDate,
  onDateChange,
  data,
  error,
  onDeleted,
}: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmLogId, setConfirmLogId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  async function handleDelete(logId: string) {
    setDeletingId(logId)
    const r = await deleteAttendanceLog(logId)
    setDeletingId(null)
    setConfirmLogId(null)
    if (r.error) setToast(r.error)
    else {
      setToast('Record removed')
      onDeleted?.()
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Classes with logged attendance on this day (these affect Overview and other analytics). Remove a record to correct mistakes (e.g. wrong headcount).
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
      {toast && (
        <p className="text-sm text-gray-800" role="status">
          {toast}
        </p>
      )}
      {!data ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-gray-500 text-sm">No logged classes on {formatLocalDateLabel(selectedDate)}.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-2 px-3 font-medium text-gray-700">Time</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">Program</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">Title</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Headcount</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">Logged by</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">Logged at</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((row) => (
                <tr key={row.logId} className="bg-white">
                  <td className="py-2 px-3">{row.time}</td>
                  <td className="py-2 px-3">{row.programLabel}</td>
                  <td className="py-2 px-3 text-gray-800">{row.title}</td>
                  <td className="text-right py-2 px-3 font-medium">{row.headcount}</td>
                  <td className="py-2 px-3 text-gray-600">{row.loggedByName ?? '—'}</td>
                  <td className="py-2 px-3 text-gray-500">
                    {row.loggedAt ? new Date(row.loggedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </td>
                  <td className="text-right py-2 px-3">
                    <button
                      type="button"
                      onClick={() => setConfirmLogId(row.logId)}
                      disabled={deletingId !== null}
                      className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmLogId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <p className="text-gray-900 font-medium mb-2">Remove this attendance record?</p>
            <p className="text-sm text-gray-600 mb-4">
              The class will no longer count in Overview or other analytics and may appear in Missing logs.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmLogId(null)}
                disabled={deletingId !== null}
                className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmLogId)}
                disabled={deletingId !== null}
                className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId === confirmLogId ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
