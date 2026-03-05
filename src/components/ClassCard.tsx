'use client'

import { useState, useEffect, useRef } from 'react'
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
  viewOnly = false,
  status,
  finishedMinutesAgo,
  loggedByName,
  coachOptions = [],
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
  viewOnly?: boolean
  status?: 'finished' | 'ongoing' | 'upcoming'
  finishedMinutesAgo?: number
  loggedByName?: string
  coachOptions?: { id: string; full_name: string | null }[]
}) {
  const displayHeadcount = localHeadcount ?? currentHeadcount
  const hasAttendance = displayHeadcount !== undefined
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false)
  const [pendingHeadcount, setPendingHeadcount] = useState<number | null>(null)
  const [overrideCoachId, setOverrideCoachId] = useState<string>('')
  const submittingRef = useRef(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (expanded) setError(null)
  }, [expanded])

  const isLockedNoAction = viewOnly || (locked && !canEdit)

  async function submit(headcountNum: number, adminOverride?: boolean, createdByUserId?: string) {
    if (submittingRef.current) return
    submittingRef.current = true
    setLoading(true)
    setError(null)
    try {
      const result = await logAttendance(occurrenceId, headcountNum, { adminOverride, createdByUserId })
      if ('error' in result && result.error) {
        if (result.code === 'LOCKED') setToast(LOCKED_MESSAGE)
        setError(result.error)
        return
      }
      setShowOverrideConfirm(false)
      setPendingHeadcount(null)
      setOverrideCoachId('')
      onSaved?.(headcountNum)
      // Parent handleSaved already sets expandedId(null) so card closes with the toast
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  function handleSave(value: number) {
    if (isAdmin && coachOptions.length > 0 && !overrideCoachId) {
      setError('Select who coached this class')
      return
    }
    if (showOverride) {
      setPendingHeadcount(value)
      setShowOverrideConfirm(true)
      return
    }
    const createdBy = isAdmin && coachOptions.length > 0 ? overrideCoachId || undefined : undefined
    submit(value, false, createdBy)
  }

  function confirmOverride() {
    if (pendingHeadcount === null) return
    const createdBy = isAdmin && coachOptions.length > 0 ? overrideCoachId || undefined : undefined
    submit(pendingHeadcount, true, createdBy)
  }

  const primaryLabel =
    isLockedNoAction
      ? null
      : showOverride
        ? 'Override edit'
        : hasAttendance
          ? 'Edit attendance'
          : 'Log attendance'

  const statusLabel = viewOnly
    ? 'View only'
    : isLockedNoAction
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
                  setOverrideCoachId('')
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
        className={`rounded-2xl bg-white overflow-hidden ${
          status === 'ongoing'
            ? 'border-2 border-green-500 shadow-md active:bg-gray-50 [box-shadow:0_4px_14px_0_rgba(34,197,94,0.25)]'
            : status === 'finished' && finishedMinutesAgo !== undefined && finishedMinutesAgo < 60
              ? 'border-2 border-amber-500 shadow-md active:bg-gray-50 [box-shadow:0_4px_14px_0_rgba(245,158,11,0.3)]'
              : status === 'finished'
                ? 'border-2 border-red-500 shadow-md active:bg-gray-50 [box-shadow:0_4px_14px_0_rgba(239,68,68,0.25)]'
                : `border border-gray-200 shadow-sm ${isLockedNoAction ? '' : 'active:bg-gray-50'}`
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
                statusLabel === 'View only'
                  ? 'bg-gray-100 text-gray-600'
                  : statusLabel === 'Locked'
                    ? 'bg-amber-100 text-amber-800'
                    : statusLabel === 'Logged'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-700'
              }`}
            >
              {statusLabel === 'Locked' ? '🔒 Locked' : statusLabel}
            </span>
          </div>
          {hasAttendance && loggedByName && (
            <div className="flex justify-end mt-1">
              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full shrink-0">
                Coach {loggedByName} confirmed attendance
              </span>
            </div>
          )}
          {title && <p className="text-sm text-gray-600">{title}</p>}
          <p className="text-2xl font-bold text-gray-900 mt-1">{time}</p>
          {status === 'ongoing' && (
            <p className="text-sm font-medium text-blue-700 mt-0.5">Ongoing</p>
          )}
          {status === 'finished' && finishedMinutesAgo !== undefined && finishedMinutesAgo < 180 && (
            <p className="text-sm text-gray-600 mt-0.5">
              {finishedMinutesAgo === 0
                ? 'Just finished'
                : finishedMinutesAgo >= 60
                  ? `Finished ${Math.floor(finishedMinutesAgo / 60)} ${Math.floor(finishedMinutesAgo / 60) === 1 ? 'hour' : 'hours'} ago`
                  : `Finished ${finishedMinutesAgo} min ago`}
            </p>
          )}
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
            <span
              className={`mt-3 inline-flex items-center justify-center min-h-[44px] rounded-xl font-semibold text-base w-full max-w-[200px] ${
                primaryLabel === 'Log attendance'
                  ? 'bg-blue-600 text-white'
                  : primaryLabel === 'Override edit'
                    ? 'bg-amber-100 text-amber-900 border-2 border-amber-400'
                    : 'bg-gray-100 text-gray-800 border-2 border-gray-300'
              }`}
            >
              {primaryLabel}
            </span>
          )}
        </button>

        {expanded && (
          <div className="px-5 pb-5 pt-2 border-t border-gray-100">
            {isAdmin && coachOptions.length > 0 && (
              <div className="mb-4">
                <label htmlFor="override-coach" className="block text-sm font-medium text-gray-700 mb-1">
                  Who coached this class?
                </label>
                <select
                  id="override-coach"
                  value={overrideCoachId}
                  onChange={(e) => {
                    setOverrideCoachId(e.target.value)
                    setError(null)
                  }}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">— Select coach —</option>
                  {coachOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name?.trim() || 'Unnamed'}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <AttendanceInput
              initialValue={pendingHeadcount ?? displayHeadcount ?? 0}
              onSave={handleSave}
              loading={loading}
              error={error ?? undefined}
              autoFocus={!isAdmin || coachOptions.length === 0}
              maxValue={capacity != null ? Math.max(60, capacity + 15) : 60}
            />
          </div>
        )}
      </article>
    </>
  )
}
