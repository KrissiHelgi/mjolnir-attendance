'use client'

import { useState } from 'react'

export function ClearScheduleButton({
  clearAction,
  hasRows,
}: {
  clearAction: () => Promise<{ error?: string }>
  hasRows: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClear() {
    if (!confirm('Clear the entire weekly schedule? All classes will be removed. You can re-import with Paste timetable.')) return
    setError(null)
    setLoading(true)
    const result = await clearAction()
    setLoading(false)
    if (result.error) setError(result.error)
    else if (typeof window !== 'undefined') window.location.reload()
  }

  if (!hasRows) return null

  return (
    <div className="flex items-center gap-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleClear}
        disabled={loading}
        className="min-h-[36px] px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm font-medium hover:bg-red-100 disabled:opacity-50"
      >
        {loading ? 'Clearing…' : 'Clear schedule'}
      </button>
    </div>
  )
}
