'use client'

import { useState, useEffect, useMemo } from 'react'
import type { LowAttendanceAlert, SlotLowCount, OverCapacityRow } from '@/lib/analytics'
import type { MissingLog } from '@/lib/analytics'
import type { ThresholdRow } from '@/lib/actions/analytics'
import { getThresholds, updateThreshold, markMissingAsNa } from '@/lib/actions/analytics'
import { formatLocalDateLabel } from '@/lib/dates'

type Props = {
  alerts: LowAttendanceAlert[] | null
  slotsWithRepeated: SlotLowCount[] | null
  missingLogs?: MissingLog[] | null
  overCapacity?: OverCapacityRow[] | null
  error?: string
  onMissingMarked?: () => void
}

export function AlertsSection({ alerts, slotsWithRepeated, missingLogs, overCapacity, error, onMissingMarked }: Props) {
  const [thresholds, setThresholds] = useState<ThresholdRow[] | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null)
  const [markingNa, setMarkingNa] = useState<string | null>(null)

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

  async function handleMarkAsNa(occurrenceId: string) {
    setMarkingNa(occurrenceId)
    const r = await markMissingAsNa(occurrenceId)
    setMarkingNa(null)
    if (r.error) {
      showToast(r.error, 'error')
      return
    }
    showToast('Marked as N/A', 'success')
    onMissingMarked?.()
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

      {missingLogs != null && (
        <div id="alerts-missing">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Missing logs</h3>
          <p className="text-xs text-gray-500 mb-2">Past occurrences (or today after lock) with no attendance. Grouped by day, newest first.</p>
          {!missingLogs.length ? (
            <p className="text-gray-500 text-sm">None.</p>
          ) : (
            <div className="space-y-4">
              {missingByDay.map(({ date, items }) => (
                <div key={date} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800">{formatLocalDateLabel(date)}</div>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Time</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Program</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Title</th>
                        <th className="text-right py-2 px-2 font-medium text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((m) => (
                        <tr key={m.occurrenceId} className="border-b border-gray-100 last:border-0">
                          <td className="py-2 px-2">{m.time}</td>
                          <td className="py-2 px-2">{m.programLabel}</td>
                          <td className="py-2 px-2 text-gray-600">{m.title}</td>
                          <td className="py-2 px-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleMarkAsNa(m.occurrenceId)}
                              disabled={markingNa === m.occurrenceId}
                              className="min-h-[44px] px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-sm font-medium hover:bg-amber-200 disabled:opacity-50"
                            >
                              {markingNa === m.occurrenceId ? 'Saving…' : 'Mark as N/A'}
                            </button>
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
    </div>
  )
}
