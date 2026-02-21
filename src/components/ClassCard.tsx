'use client'

import { useState, useEffect } from 'react'
import { logAttendance } from '@/lib/actions/attendance'
import { LOCKED_MESSAGE } from '@/lib/attendance-lock'
import { AttendanceInput } from '@/components/AttendanceInput'

export function ClassCard({
  occurrenceId,
  programLabel,
  title,
  time,
  location,
  capacity,
  currentHeadcount,
  locked,
  canEdit,
  showOverride,
  isAdmin,
  expanded = false,
  onExpandToggle,
  onSaved,
  localHeadcount,
}: {
  occurrenceId: string
  programLabel: string
  title: string
  time: string
  location?: string
  capacity?: number
  currentHeadcount?: number
  locked: boolean
  canEdit: boolean
  showOverride: boolean
  isAdmin: boolean
  expanded?: boolean
  onExpandToggle?: () => void
  onSaved?: (headcount: number) => void
  localHeadcount?: number
}) {
  const displayHeadcount = localHeadcount ?? currentHeadcount
  const hasAttendance = displayHeadcount !== undefined
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false)
  const [pendingHeadcount, setPendingHeadcount] = useState<number | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (expanded) setError(null)
  }, [expanded])

  const isLockedNoAction = locked && !canEdit

  async function submit(headcountNum: number, adminOverride?: boolean) {
    setLoading(true)
    setError(null)
    const result = await logAttendance(occurrenceId, headcountNum, { adminOverride })
    setLoading(false)
    if ('error' in result && result.error) {
      if (result.code === 'LOCKED') setToast(LOCKED_MESSAGE)
      setError(result.error)
      return
    }
    setShowOverrideConfirm(false)
    setPendingHeadcount(null)
    onSaved?.(headcountNum)
    onExpandToggle?.()
  }

  function handleSave(value: number) {
    if (showOverride) {
      setPendingHeadcount(value)
      setShowOverrideConfirm(true)
      return
    }
    submit(value)
  }

  function confirmOverride() {
    if (pendingHeadcount === null) return
    submit(pendingHeadcount, true)
  }

  const primaryLabel =
    isLockedNoAction
      ? null
      : showOverride
        ? 'Override edit'
        : hasAttendance
          ? 'Edit attendance'
          : 'Log attendance'

  const statusLabel = isLockedNoAction
    ? 'Locked'
    : hasAttendance
      ? 'Logged'
      : 'Not logged'

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full">
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
                className="min-h-[44px] px-4 rounded-xl text-gray-700 bg-gray-100 active:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmOverride}
                disabled={loading}
                className="min-h-[44px] px-4 rounded-xl bg-amber-600 text-white active:bg-amber-700 disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Override'}
              </button>
            </div>
          </div>
        </div>
      )}

      <article
        className={`rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden ${
          isLockedNoAction ? '' : 'active:bg-gray-50'
        }`}
      >
        <button
          type="button"
          onClick={isLockedNoAction ? undefined : onExpandToggle}
          disabled={isLockedNoAction}
          className="w-full text-left p-5 min-h-[44px] flex flex-col gap-1 disabled:pointer-events-none"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-bold text-gray-900">{programLabel}</span>
            <span
              className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${
                statusLabel === 'Locked'
                  ? 'bg-amber-100 text-amber-800'
                  : statusLabel === 'Logged'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-700'
              }`}
            >
              {statusLabel === 'Locked' ? '🔒 Locked' : statusLabel}
            </span>
          </div>
          {title && <p className="text-sm text-gray-600">{title}</p>}
          <p className="text-2xl font-bold text-gray-900 mt-1">{time}</p>
          {location && <p className="text-sm text-gray-500 mt-0.5">{location}</p>}
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
            {capacity != null && <span>Capacity: {capacity}</span>}
            {hasAttendance && (
              <span className="font-semibold text-gray-700">
                Headcount: {displayHeadcount}
              </span>
            )}
          </div>
          {!expanded && primaryLabel && (
            <span className="mt-3 inline-flex items-center justify-center min-h-[44px] rounded-xl bg-blue-600 text-white font-semibold text-base w-full max-w-[200px]">
              {primaryLabel}
            </span>
          )}
        </button>

        {expanded && (
          <div className="px-5 pb-5 pt-2 border-t border-gray-100">
            <AttendanceInput
              initialValue={pendingHeadcount ?? displayHeadcount ?? 0}
              onSave={handleSave}
              loading={loading}
              error={error ?? undefined}
              autoFocus
            />
          </div>
        )}
      </article>
    </>
  )
}
