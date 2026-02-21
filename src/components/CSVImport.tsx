'use client'

import { useState } from 'react'
import { type ClassTemplate } from '@/lib/actions/schedule'

export function CSVImport({
  importAction,
}: {
  importAction: (data: ClassTemplate[]) => Promise<any>
}) {
  const [showModal, setShowModal] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<ClassTemplate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function parseCSV(text: string): ClassTemplate[] {
    const lines = text.trim().split('\n')
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header and one data row')
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const requiredHeaders = ['program', 'title', 'weekday', 'start_time', 'duration_minutes']
    
    for (const req of requiredHeaders) {
      if (!headers.includes(req)) {
        throw new Error(`Missing required column: ${req}`)
      }
    }

    const templates: ClassTemplate[] = []
    const weekdayMap: Record<string, number> = {
      'sunday': 0, 'sun': 0,
      'monday': 1, 'mon': 1,
      'tuesday': 2, 'tue': 2, 'tues': 2,
      'wednesday': 3, 'wed': 3,
      'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
      'friday': 5, 'fri': 5,
      'saturday': 6, 'sat': 6,
    }

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      if (values.length !== headers.length) {
        throw new Error(`Row ${i + 1} has incorrect number of columns`)
      }

      const row: any = {}
      headers.forEach((header, idx) => {
        row[header] = values[idx]
      })

      let weekday: number
      const weekdayStr = row.weekday.toLowerCase()
      if (weekdayMap[weekdayStr] !== undefined) {
        weekday = weekdayMap[weekdayStr]
      } else {
        weekday = parseInt(row.weekday)
        if (isNaN(weekday) || weekday < 0 || weekday > 6) {
          throw new Error(`Row ${i + 1}: Invalid weekday "${row.weekday}"`)
        }
      }

      templates.push({
        program: row.program,
        title: row.title,
        weekday,
        start_time: row.start_time,
        duration_minutes: parseInt(row.duration_minutes),
        location: row.location || undefined,
        capacity: row.capacity ? parseInt(row.capacity) : undefined,
      })
    }

    return templates
  }

  function handlePreview() {
    setError(null)
    try {
      const parsed = parseCSV(csvText)
      setPreview(parsed)
    } catch (e: any) {
      setError(e.message)
      setPreview(null)
    }
  }

  async function handleImport() {
    if (!preview) return

    setLoading(true)
    setError(null)

    const result = await importAction(preview)
    
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setShowModal(false)
      setCsvText('')
      setPreview(null)
      setLoading(false)
      window.location.reload()
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
      >
        Import CSV
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Import Templates from CSV</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste CSV content:
              </label>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={10}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="program,title,weekday,start_time,duration_minutes,location,capacity&#10;CrossFit,Morning WOD,Monday,06:00,60,Main Gym,20"
              />
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {preview && (
              <div className="mb-4 rounded-md bg-gray-50 p-3">
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Preview ({preview.length} templates):
                </p>
                <div className="max-h-40 space-y-1 overflow-y-auto text-xs text-gray-600">
                  {preview.map((t, i) => (
                    <div key={i}>
                      {t.program} - {t.title} ({['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][t.weekday]} {t.start_time})
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowModal(false)
                  setCsvText('')
                  setPreview(null)
                  setError(null)
                }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePreview}
                className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Preview
              </button>
              {preview && (
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Importing...' : 'Import'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
