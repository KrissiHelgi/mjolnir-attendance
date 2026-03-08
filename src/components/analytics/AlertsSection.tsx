'use client'

import { useState, useEffect, useMemo } from 'react'
import type { LowAttendanceAlert, SlotLowCount, OverCapacityRow, CancelledLogRow } from '@/lib/analytics'
import type { MissingLog } from '@/lib/analytics'
import type { ThresholdRow } from '@/lib/actions/analytics'
import { getThresholds, updateThreshold, markMissingAsNa, markMissingAsCancelled, markMissingAsNaBulk, markMissingAsCancelledBulk } from '@/lib/actions/analytics'
import { logAttendance } from '@/lib/actions/attendance'
import { deleteOccurrence, deleteOccurrences } from '@/lib/actions/dashboard'
import { formatLocalDateLabel } from '@/lib/dates'

type Props = {
  alerts: LowAttendanceAlert[] | null
  slotsWithRepeated: SlotLowCount[] | null
  missingLogs?: MissingLog[] | null
  overCapacity?: OverCapacityRow[] | null
  cancelledLogs?: CancelledLogRow[] | null
  error?: string
  onMissingMarked?: () => void
}

export function AlertsSection({ alerts, slotsWithRepeated, missingLogs, overCapacity, cancelledLogs, error, onMissingMarked }: Props) {
  const [thresholds, setThresholds] = useState<ThresholdRow[] | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null)
  const [markingNa, setMarkingNa] = useState<string | null>(null)
  const [naModalOccurrenceIds, setNaModalOccurrenceIds] = useState<string[]>([])
  const [naActionLoading, setNaActionLoading] = useState(false)
  const [selectedMissingIds, setSelectedMissingIds] = useState<Set<string>>(new Set())
  const [logModalItem, setLogModalItem] = useState<MissingLog | null>(null)
  const [logHeadcount, setLogHeadcount] = useState(0)
  const [logSaving, setLogSaving] = useState(false)

  useEffect(() => {
    getThresholds().then((r) => {
      if (r.data) setThresholds(r.data)
    })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
  }

  async function saveThreshold(program: string, minHeadcount: number) {
    const value = Math.max(0, Math.floor(minHeadcount))
    if (value !== minHeadcount) {
      showToast('Min headcount must be an integer ≥ 0', 'error')
      return
    }
    setSaving(true)
    const r = await updateThreshold(program, value)
    setSaving(false)
    if (r.error) {
      showToast(r.error, 'error')
      return
    }
    setThresholds((prev) =>
      prev?.map((t) => (t.program === program ? { ...t, minHeadcount: value } : t)) ?? []
    )
    setEditing(null)
    showToast('Threshold saved', 'success')
  }

  function openLogModal(m: MissingLog) {
    setLogModalItem(m)
    setLogHeadcount(0)
  }

  async function handleLogAttendanceSubmit() {
    if (!logModalItem) return
    const value = Math.max(0, Math.floor(logHeadcount))
    setLogSaving(true)
    const result = await logAttendance(logModalItem.occurrenceId, value, { adminOverride: true })
    setLogSaving(false)
    if ('error' in result) {
      showToast(result.error ?? 'Failed to log attendance', 'error')
      return
    }
    showToast(`Attendance logged: ${value}`, 'success')
    setLogModalItem(null)
    onMissingMarked?.()
  }

  function openMarkAsNaModal(occurrenceId: string) {
    setNaModalOccurrenceIds([occurrenceId])
  }

  function openBulkMarkAsNaModal() {
    if (selectedMissingIds.size === 0) return
    setNaModalOccurrenceIds(Array.from(selectedMissingIds))
  }

  function toggleMissingSelection(id: string) {
    setSelectedMissingIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleMissingSelectionDay(items: MissingLog[]) {
    const ids = items.map((m) => m.occurrenceId)
    const allSelected = ids.every((id) => selectedMissingIds.has(id))
    setSelectedMissingIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)))
      return next
    })
  }

  async function handleNaChoice(choice: 'no_show' | 'not_running' | 'cancelled') {
    const ids = naModalOccurrenceIds
    if (!ids.length) return
    setNaActionLoading(true)
    if (ids.length === 1) setMarkingNa(ids[0])
    let r: { error?: string; count?: number }
    if (choice === 'no_show') {
      if (ids.length === 1) {
        r = await markMissingAsNa(ids[0])
        if (!r.error) showToast('Marked as no one showed up (counted as 0)', 'success')
      } else {
        r = await markMissingAsNaBulk(ids)
        if (!r.error) showToast(`${r.count} marked as no one showed up (counted as 0)`, 'success')
      }
    } else if (choice === 'not_running') {
      if (ids.length === 1) {
        r = await deleteOccurrence(ids[0])
        if (!r.error) showToast('Removed from schedule (not counted)', 'success')
      } else {
        r = await deleteOccurrences(ids)
        if (!r.error) showToast(`${ids.length} removed from schedule (not counted)`, 'success')
      }
    } else {
      if (ids.length === 1) {
        r = await markMissingAsCancelled(ids[0])
        if (!r.error) showToast('Marked as cancelled (shown in Classes cancelled)', 'success')
      } else {
        r = await markMissingAsCancelledBulk(ids)
        if (!r.error) showToast(`${r.count} marked as cancelled (shown in Classes cancelled)`, 'success')
      }
    }
    setNaActionLoading(false)
    setMarkingNa(null)
    setNaModalOccurrenceIds([])
    setSelectedMissingIds(new Set())
    if (r?.error) showToast(r.error, 'error')
    else onMissingMarked?.()
  }

  const alertsBySlot = useMemo(() => {
    if (!alerts?.length) return new Map<string, LowAttendanceAlert[]>()
    const m = new Map<string, LowAttendanceAlert[]>()
    alerts.forEach((a) => {
      const list = m.get(a.templateId) ?? []
      list.push(a)
      m.set(a.templateId, list)
    })
    return m
  }, [alerts])

  const missingByDay = useMemo(() => {
    if (!missingLogs?.length) return [] as { date: string; items: MissingLog[] }[]
    const byDay = new Map<string, MissingLog[]>()
    missingLogs.forEach((m) => {
      const list = byDay.get(m.date) ?? []
      list.push(m)
      byDay.set(m.date, list)
    })
    return [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, items]) => ({ date, items }))
  }, [missingLogs])

  if (error) return <p className="text-sm text-red-600">{error}</p>

  return (
    <div className="space-y-8">
      {toast && (
        <div
          role="alert"
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg ${
            toast.type === 'success' ? 'bg-green-800 text-white' : 'bg-red-800 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Per-program thresholds</h3>
        <p className="text-xs text-gray-500 mb-3">
          Low attendance = headcount &lt; threshold. Only missing programs are seeded; existing values are kept.
        </p>
        {thresholds?.length ? (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Program</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Min headcount</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {thresholds.map((t) => (
                  <tr key={t.program} className="border-b border-gray-100">
                    <td className="py-2 px-3 font-medium text-gray-800">{t.programLabel}</td>
                    <td className="py-2 px-3">
                      {editing === t.program ? (
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={editValue}
                          onChange={(e) => setEditValue(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      ) : (
                        <span className="text-gray-600">{t.minHeadcount}</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {editing === t.program ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveThreshold(t.program, editValue)}
                            disabled={saving}
                            className="text-blue-600 hover:underline text-sm font-medium disabled:opacity-50 mr-2"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditing(null); setEditValue(t.minHeadcount) }}
                            className="text-gray-500 hover:underline text-sm"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setEditing(t.program); setEditValue(t.minHeadcount) }}
                          className="text-blue-600 hover:underline text-sm font-medium"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Loading thresholds…</p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Low attendance logs</h3>
        <p className="text-xs text-gray-500 mb-2">Within selected date range. Headcount below threshold is highlighted.</p>
        {!alerts?.length ? (
          <p className="text-gray-500 text-sm">None in range.</p>
        ) : (
          <div className="overflow-x-auto max-h-72 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Date</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Time</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Program</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Title</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-700">Headcount</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-700">Threshold</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-700">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 px-2">{formatLocalDateLabel(a.date)}</td>
                    <td className="py-2 px-2">{a.time}</td>
                    <td className="py-2 px-2">{a.programLabel}</td>
                    <td className="py-2 px-2 text-gray-600">{a.title}</td>
                    <td className={`text-right py-2 px-2 font-semibold ${a.headcount < a.threshold ? 'text-red-600' : ''}`}>
                      {a.headcount}
                    </td>
                    <td className="text-right py-2 px-2">{a.threshold}</td>
                    <td className="text-right py-2 px-2">{a.utilization != null ? `${(a.utilization * 100).toFixed(0)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Repeated low attendance slots</h3>
        <p className="text-xs text-gray-500 mb-2">Grouped by class slot. Click to see occurrences.</p>
        {!slotsWithRepeated?.length ? (
          <p className="text-gray-500 text-sm">None.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {slotsWithRepeated.map((s) => (
              <li key={s.templateId} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedSlotId(expandedSlotId === s.templateId ? null : s.templateId)}
                  className="w-full text-left px-3 py-2 flex justify-between items-center gap-2 hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-800">{s.slotLabel}</span>
                  <span className="text-amber-700 font-medium shrink-0">
                    {s.lowCount} low of {s.totalLogged} logged
                  </span>
                </button>
                {expandedSlotId === s.templateId && alertsBySlot.get(s.templateId)?.length ? (
                  <div className="border-t border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="text-xs font-medium text-gray-600 mb-1">Occurrences in range:</p>
                    <ul className="text-xs space-y-0.5">
                      {alertsBySlot.get(s.templateId)!.map((a, i) => (
                        <li key={i}>
                          {formatLocalDateLabel(a.date)} {a.time} — {a.programLabel} — {a.title} — headcount {a.headcount} (threshold {a.threshold})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {overCapacity != null && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Classes exceeding capacity</h3>
          <p className="text-xs text-gray-500 mb-2">Within selected date range. Headcount logged above the set capacity for that class.</p>
          {!overCapacity.length ? (
            <p className="text-gray-500 text-sm">None in range.</p>
          ) : (
            <>
              <p className="text-sm font-medium text-amber-800 mb-2">{overCapacity.length} class(es) over capacity</p>
              <div className="overflow-x-auto max-h-72 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Date</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Time</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Program</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Title</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-700">Capacity</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-700">Headcount</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-700">Over by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overCapacity.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2 px-2">{formatLocalDateLabel(row.date)}</td>
                        <td className="py-2 px-2">{row.time}</td>
                        <td className="py-2 px-2">{row.programLabel}</td>
                        <td className="py-2 px-2 text-gray-600">{row.title}</td>
                        <td className="text-right py-2 px-2">{row.capacity}</td>
                        <td className="text-right py-2 px-2 font-semibold">{row.headcount}</td>
                        <td className="text-right py-2 px-2 font-semibold text-amber-700">+{row.overBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {cancelledLogs != null && (
        <div id="alerts-cancelled">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Classes cancelled</h3>
          <p className="text-xs text-gray-500 mb-2">Classes you marked as cancelled (on us). Not counted in utilization or averages.</p>
          {!cancelledLogs.length ? (
            <p className="text-gray-500 text-sm">None in this range.</p>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-700">Date</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-700">Time</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-700">Program</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-700">Title</th>
                  </tr>
                </thead>
                <tbody>
                  {cancelledLogs.map((row) => (
                    <tr key={row.occurrenceId} className="border-b border-gray-100">
                      <td className="py-2 px-2">{formatLocalDateLabel(row.date)}</td>
                      <td className="py-2 px-2">{row.time}</td>
                      <td className="py-2 px-2">{row.programLabel}</td>
                      <td className="py-2 px-2 text-gray-600">{row.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {missingLogs != null && (
        <div id="alerts-missing">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Missing logs</h3>
          <p className="text-xs text-gray-500 mb-2">Past occurrences (or today after lock) with no attendance. Grouped by day, newest first. Select multiple to mark in bulk.</p>
          {!missingLogs.length ? (
            <p className="text-gray-500 text-sm">None.</p>
          ) : (
            <div className="space-y-4">
              {selectedMissingIds.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                  <span className="font-medium text-amber-900">{selectedMissingIds.size} selected</span>
                  <button
                    type="button"
                    onClick={() => setSelectedMissingIds(new Set())}
                    className="text-amber-800 underline hover:no-underline"
                  >
                    Clear selection
                  </button>
                  <button
                    type="button"
                    onClick={openBulkMarkAsNaModal}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-amber-200 text-amber-900 text-sm font-medium hover:bg-amber-300"
                  >
                    Mark selected as N/A
                  </button>
                </div>
              )}
              {missingByDay.map(({ date, items }) => (
                <div key={date} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800 flex items-center gap-2">
                    {formatLocalDateLabel(date)}
                    <button
                      type="button"
                      onClick={() => toggleMissingSelectionDay(items)}
                      className="text-xs text-gray-600 underline hover:no-underline"
                    >
                      {items.every((m) => selectedMissingIds.has(m.occurrenceId)) ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="w-10 py-2 px-2 text-left font-medium text-gray-700">Select</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Time</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Program</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Title</th>
                        <th className="text-right py-2 px-2 font-medium text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((m) => (
                        <tr key={m.occurrenceId} className="border-b border-gray-100 last:border-0">
                          <td className="py-2 px-2">
                            <input
                              type="checkbox"
                              checked={selectedMissingIds.has(m.occurrenceId)}
                              onChange={() => toggleMissingSelection(m.occurrenceId)}
                              className="rounded border-gray-300"
                              aria-label={`Select ${m.title} ${m.time}`}
                            />
                          </td>
                          <td className="py-2 px-2">{m.time}</td>
                          <td className="py-2 px-2">{m.programLabel}</td>
                          <td className="py-2 px-2 text-gray-600">{m.title}</td>
                          <td className="py-2 px-2 text-right">
                            <div className="flex flex-wrap gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => openLogModal(m)}
                                className="min-h-[44px] px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                              >
                                Log attendance
                              </button>
                              <button
                                type="button"
                                onClick={() => openMarkAsNaModal(m.occurrenceId)}
                                disabled={markingNa === m.occurrenceId}
                                className="min-h-[44px] px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-sm font-medium hover:bg-amber-200 disabled:opacity-50"
                              >
                                {markingNa === m.occurrenceId ? 'Saving…' : 'Mark as N/A'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {logModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Log attendance</h3>
            <p className="text-sm text-gray-600 mb-4">
              {logModalItem.title} — {formatLocalDateLabel(logModalItem.date)} {logModalItem.time}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Headcount</label>
              <input
                type="number"
                min={0}
                step={1}
                value={logHeadcount}
                onChange={(e) => setLogHeadcount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleLogAttendanceSubmit}
                disabled={logSaving}
                className="flex-1 min-h-[44px] px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {logSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { if (!logSaving) setLogModalItem(null) }}
                disabled={logSaving}
                className="flex-1 min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {naModalOccurrenceIds.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Mark as N/A</h3>
            <p className="text-sm text-gray-600 mb-4">
              {naModalOccurrenceIds.length === 1
                ? 'How should this missing class be handled?'
                : `How should these ${naModalOccurrenceIds.length} missing classes be handled?`}
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleNaChoice('no_show')}
                disabled={naActionLoading}
                className="w-full min-h-[44px] px-4 py-2 rounded-lg border border-gray-200 bg-white text-left text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                1. No one showed up — counted as 0 in analytics
              </button>
              <button
                type="button"
                onClick={() => handleNaChoice('not_running')}
                disabled={naActionLoading}
                className="w-full min-h-[44px] px-4 py-2 rounded-lg border border-gray-200 bg-white text-left text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                2. Class not running — removed from schedule (not counted)
              </button>
              <button
                type="button"
                onClick={() => handleNaChoice('cancelled')}
                disabled={naActionLoading}
                className="w-full min-h-[44px] px-4 py-2 rounded-lg border border-gray-200 bg-white text-left text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                3. Class cancelled (on us) — not counted; shown in Classes cancelled
              </button>
            </div>
            <button
              type="button"
              onClick={() => { if (!naActionLoading) setNaModalOccurrenceIds([]) }}
              disabled={naActionLoading}
              className="mt-4 w-full min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
