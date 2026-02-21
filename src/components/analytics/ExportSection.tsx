'use client'

import { useState } from 'react'

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

type Props = {
  onExportLogs: () => Promise<{ csv?: string; error?: string }>
  onExportSlotSummary: () => Promise<{ csv?: string; error?: string }>
  startDate: string
  endDate: string
}

export function ExportSection({
  onExportLogs,
  onExportSlotSummary,
  startDate,
  endDate,
}: Props) {
  const [loading, setLoading] = useState<'logs' | 'slots' | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function handleExportLogs() {
    setErr(null)
    setLoading('logs')
    const r = await onExportLogs()
    setLoading(null)
    if (r.error) {
      setErr(r.error)
      return
    }
    if (r.csv) downloadBlob(r.csv, `attendance-logs-${startDate}-${endDate}.csv`, 'text/csv;charset=utf-8')
  }

  async function handleExportSlotSummary() {
    setErr(null)
    setLoading('slots')
    const r = await onExportSlotSummary()
    setLoading(null)
    if (r.error) {
      setErr(r.error)
      return
    }
    if (r.csv) downloadBlob(r.csv, `slot-summary-${startDate}-${endDate}.csv`, 'text/csv;charset=utf-8')
  }

  return (
    <div className="space-y-4">
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleExportLogs}
          disabled={loading !== null}
          className="min-h-[44px] px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
        >
          {loading === 'logs' ? 'Exporting…' : 'Export attendance logs (CSV)'}
        </button>
        <button
          type="button"
          onClick={handleExportSlotSummary}
          disabled={loading !== null}
          className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          {loading === 'slots' ? 'Exporting…' : 'Export slot summary (CSV)'}
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Logs: date, start time, program, title, location, capacity, headcount, logged_by, logged_at.
        Slot summary: template_id, weekday, time, program, avg headcount, avg utilization, occurrence count.
      </p>
    </div>
  )
}
