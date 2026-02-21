'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { parsePasteTimetable, type PasteResult } from '@/lib/paste-timetable'
import { getProgramLabel } from '@/lib/programs'
import { importPasteTimetable } from '@/lib/actions/schedule'

const WEEKDAY_NAMES = ['Sun', 'Mán', 'Þri', 'Mið', 'Fim', 'Fös', 'Lau']

export function PasteTimetableImporter() {
  const router = useRouter()
  const [tsv, setTsv] = useState('')
  const [preview, setPreview] = useState<PasteResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  function handlePreview() {
    setImportError(null)
    const result = parsePasteTimetable(tsv)
    setPreview(result)
  }

  async function handleImport() {
    setImportError(null)
    setImporting(true)
    try {
      const out = await importPasteTimetable(tsv)
      if ('error' in out) {
        setImportError(out.error)
        return
      }
      setToast(`Imported ${out.imported} classes. ${out.excluded > 0 ? `(${out.excluded} excluded)` : ''}`)
      setTsv('')
      setPreview(null)
      router.refresh()
    } finally {
      setImporting(false)
    }
  }

  const excludedByReason = preview
    ? preview.excluded.reduce((acc, e) => {
        acc[e.reason] = (acc[e.reason] ?? 0) + 1
        return acc
      }, {} as Record<string, number>)
    : {}

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm border">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Paste timetable</h2>
      <p className="text-sm text-gray-600 mb-3">
        Paste tab- or space-separated rows: <strong>Day, Time, Class name, Sport</strong>. Example: <code className="bg-gray-100 px-1">Mán	12:10	Nogi 201	BJJ</code>. Header row is optional.
      </p>
      <textarea
        value={tsv}
        onChange={(e) => setTsv(e.target.value)}
        placeholder={'Mán\t12:10\tNogi 201\tBJJ\nÞri\t19:15\tBJJ 101\tBJJ'}
        rows={6}
        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
      />
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={handlePreview}
          disabled={!tsv.trim()}
          className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={!tsv.trim() || importing || (preview != null && preview.included.length === 0)}
          className="min-h-[44px] px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          {importing ? 'Importing…' : 'Import (Overwrite schedule)'}
        </button>
      </div>

      {importError && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {importError}
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800"
        >
          {toast}
        </div>
      )}

      {preview && (
        <div className="mt-6 space-y-4 border-t border-gray-200 pt-4">
          <p className="text-sm text-gray-700">
            <strong>Total parsed rows:</strong> {preview.totalRows} · <strong>Included:</strong> {preview.included.length} · <strong>Excluded:</strong> {preview.excluded.length}
          </p>

          {preview.excluded.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-800 mb-2">Excluded (reasons)</p>
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2">Reason</th>
                    <th className="text-right px-3 py-2">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(excludedByReason).map(([reason, count]) => (
                    <tr key={reason} className="border-t border-gray-100">
                      <td className="px-3 py-2">{reason}</td>
                      <td className="px-3 py-2 text-right">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.included.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-800 mb-2">Included (first 30)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-2">Weekday</th>
                      <th className="text-left px-3 py-2">Time</th>
                      <th className="text-left px-3 py-2">Program</th>
                      <th className="text-left px-3 py-2">Title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.included.slice(0, 30).map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2">{WEEKDAY_NAMES[row.weekday] ?? row.weekday}</td>
                        <td className="px-3 py-2">{row.start_time}</td>
                        <td className="px-3 py-2">{getProgramLabel(row.program)}</td>
                        <td className="px-3 py-2">{row.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.included.length > 30 && (
                <p className="text-xs text-gray-500 mt-1">… and {preview.included.length - 30} more</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
