'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ProgramItem = { key: string; label: string }

export function ProfileProgramsForm({
  programs,
  selectedKeys,
  saveAction,
  emptyHint,
}: {
  programs: readonly ProgramItem[]
  selectedKeys: string[]
  saveAction: (programKeys: string[]) => Promise<{ error?: string }>
  emptyHint?: string
}) {
  const router = useRouter()
  const [checked, setChecked] = useState<Set<string>>(new Set(selectedKeys))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await saveAction(Array.from(checked))
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  const hasSelection = checked.size > 0

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {!hasSelection && emptyHint && (
        <p className="text-amber-700 text-sm rounded-md bg-amber-50 p-3">
          {emptyHint}
        </p>
      )}
      <div className="rounded-lg border bg-white p-4 space-y-2">
        {programs.map((p) => (
          <label key={p.key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={checked.has(p.key)}
              onChange={() => toggle(p.key)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-900">{p.label}</span>
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
