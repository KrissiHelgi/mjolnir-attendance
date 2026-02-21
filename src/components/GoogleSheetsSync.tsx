'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getScheduleCsvUrl, setScheduleCsvUrl } from '@/lib/actions/app-settings'
import { getProgramLabel } from '@/lib/programs'

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type PreviewResponse = {
  totalRows: number
  includedCount: number
  excludedCount: number
  excludedReasons: Record<string, number>
  excludedSample: Array<{ reason: string; row: string[]; line: number }>
  preview: Array<{ program: string; title: string; weekday: number; start_time: string }>
}

export function GoogleSheetsSync() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [savingUrl, setSavingUrl] = useState(false)
  const [urlSaved, setUrlSaved] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null)

  useEffect(() => {
    getScheduleCsvUrl().then((r) => {
      if (r.url) setUrl(r.url)
    })
  }, [])

  async function handleSaveUrl() {
    if (!url.trim()) return
    setSavingUrl(true)
    const r = await setScheduleCsvUrl(url.trim())
    setSavingUrl(false)
    if (r.error) {
      setPreviewError(r.error)
      return
    }
    setUrlSaved(true)
    setPreviewError(null)
    setTimeout(() => setUrlSaved(false), 3000)
  }

  async function handlePreview() {
    setPreviewError(null)
    setPreview(null)
    setPreviewLoading(true)
    try {
      const res = await fetch('/api/admin/schedule/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPreviewError(data.error ?? res.statusText)
        return
      }
      setPreview(data)
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleSync() {
    setSyncError(null)
    setSyncSuccess(null)
    setSyncLoading(true)
    try {
      const res = await fetch('/api/admin/schedule/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSyncError(data.error ?? res.statusText)
        return
      }
      const msg =
        data.imported > 0
          ? `Imported ${data.imported} templates. ${data.excluded > 0 ? `(${data.excluded} rows excluded)` : ''}`
          : `Imported 0 templates. ${data.excluded > 0 ? `${data.excluded} rows excluded. Run Preview to see reasons.` : data.totalRows ? 'No rows matched. Check column headers (Time/Tími, Class name/Kennsla, Sport/Íþrótt).' : 'No data.'}`
      setSyncSuccess(msg)
      router.refresh()
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setSyncLoading(false)
    }
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm border">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Google Sheets Sync</h2>
      <p className="text-sm text-gray-600 mb-4">
        Use a public Google Sheet CSV export URL. Required columns: Time (e.g. Mán 12:10), Class name, Sport. Rows with &quot;Barna og unglingastarf&quot; or unknown sport are excluded.
      </p>

      <div className="space-y-3 mb-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">CSV export URL</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/.../export?format=csv&gid=0"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveUrl}
            disabled={savingUrl || !url.trim()}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-gray-700 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {savingUrl ? 'Saving…' : 'Save URL'}
          </button>
          {urlSaved && <span className="text-sm text-green-600">Saved</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={handlePreview}
          disabled={previewLoading || !url.trim()}
          className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          {previewLoading ? 'Loading…' : 'Preview import'}
        </button>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncLoading || !url.trim()}
          className="min-h-[44px] px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          {syncLoading ? 'Syncing…' : 'Sync now (overwrite)'}
        </button>
      </div>

      {(previewError || syncError) && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {previewError || syncError}
        </div>
      )}
      {syncSuccess && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          {syncSuccess}
        </div>
      )}

      {preview && (
        <div className="space-y-4 border-t border-gray-200 pt-4">
          <p className="text-sm text-gray-700">
            <strong>Total rows:</strong> {preview.totalRows} · <strong>Included:</strong> {preview.includedCount} · <strong>Excluded:</strong> {preview.excludedCount}
          </p>
          {preview.excludedCount > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Exclusion reasons:</p>
              <ul className="text-sm text-gray-600 list-disc list-inside">
                {Object.entries(preview.excludedReasons).map(([reason, count]) => (
                  <li key={reason}>{reason}: {count}</li>
                ))}
              </ul>
              {preview.excludedSample.length > 0 && (
                <details className="mt-2">
                  <summary className="text-sm text-gray-600 cursor-pointer">Sample excluded rows</summary>
                  <ul className="mt-1 text-xs text-gray-500 space-y-1">
                    {preview.excludedSample.map((e, i) => (
                      <li key={i}>Line {e.line}: {e.reason} — {e.row.slice(0, 3).join(', ')}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Preview (first 20 included rows)</p>
            <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-700">Weekday</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-700">Time</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-700">Program</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-700">Title</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 px-2">{WEEKDAY_NAMES[row.weekday] ?? row.weekday}</td>
                      <td className="py-2 px-2">{row.start_time}</td>
                      <td className="py-2 px-2">{getProgramLabel(row.program)}</td>
                      <td className="py-2 px-2 text-gray-600">{row.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
