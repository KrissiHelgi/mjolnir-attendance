'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logAttendance } from '@/lib/actions/attendance'
import { LOCKED_MESSAGE } from '@/lib/attendance-lock'

type Mode = 'log' | 'edit' | 'override'

export function LogAttendanceForm({
  occurrenceId,
  initialHeadcount,
  mode = 'log',
}: {
  occurrenceId: string
  initialHeadcount?: number
  mode?: Mode
}) {
  const router = useRouter()
  const [headcount, setHeadcount] = useState(String(initialHeadcount ?? ''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false)
  const [pendingHeadcount, setPendingHeadcount] = useState<number | null>(null)

  useEffect(() => {
    if (initialHeadcount !== undefined) {
      setHeadcount(String(initialHeadcount))
    }
  }, [initialHeadcount])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  async function submit(headcountNum: number, adminOverride?: boolean) {
    setLoading(true)
    setError(null)
    const result = await logAttendance(occurrenceId, headcountNum, { adminOverride })
    setLoading(false)
    if ('error' in result && result.error) {
      if (result.code === 'LOCKED') {
        setToast(LOCKED_MESSAGE)
      }
      setError(result.error)
      return
    }
    setShowOverrideConfirm(false)
    setPendingHeadcount(null)
    router.refresh()
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const n = parseInt(headcount, 10)
    if (isNaN(n) || n < 0) {
      setError('Enter a valid number (0 or more).')
      return
    }
    if (mode === 'override') {
      setPendingHeadcount(n)
      setShowOverrideConfirm(true)
      return
    }
    submit(n)
  }

  function confirmOverride() {
    if (pendingHeadcount === null) return
    submit(pendingHeadcount, true)
  }

  const buttonLabel =
    mode === 'log'
      ? 'Log attendance'
      : mode === 'override'
        ? 'Override edit'
        : 'Edit attendance'

  return (
    <>
      {toast && (
        <div
          role="alert"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md rounded-lg bg-amber-900 text-white px-4 py-3 text-sm shadow-lg"
        >
          {toast}
        </div>
      )}

      {showOverrideConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
            <p className="text-gray-900 font-medium mb-4">
              You are overriding a locked attendance record.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowOverrideConfirm(false)
                  setPendingHeadcount(null)
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmOverride}
                disabled={loading}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Override'}
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded-md bg-red-50 p-2">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        <div>
          <label
            htmlFor={`headcount-${occurrenceId}`}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Headcount
          </label>
          <input
            id={`headcount-${occurrenceId}`}
            type="number"
            min={0}
            value={headcount}
            onChange={(e) => setHeadcount(e.target.value)}
            disabled={loading}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:opacity-50"
            placeholder="0"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Saving…' : buttonLabel}
        </button>
      </form>
    </>
  )
}
