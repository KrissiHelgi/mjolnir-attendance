'use client'

import { useState } from 'react'
import { getProgramLabel } from '@/lib/programs'
import { updateProgramDefaults } from '@/lib/actions/schedule'

type Template = { program: string; location?: string | null; capacity?: number | null; duration_minutes?: number | null }

export function EditProgramSection({
  programKeys,
  classes,
}: {
  /** Unique program keys that appear in the schedule */
  programKeys: string[]
  /** All classes (used to pre-fill current location/capacity per program) */
  classes: Template[]
}) {
  const [selectedProgram, setSelectedProgram] = useState<string>('')
  const [open, setOpen] = useState(false)
  const [location, setLocation] = useState('')
  const [capacity, setCapacity] = useState<string>('')
  const [duration, setDuration] = useState('60')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function openModal(program: string) {
    const first = classes.find((c) => c.program === program)
    setSelectedProgram(program)
    setLocation(first?.location ?? '')
    setCapacity(first?.capacity != null ? String(first.capacity) : '')
    setDuration(first?.duration_minutes != null ? String(first.duration_minutes) : '60')
    setError(null)
    setSuccess(null)
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProgram) return
    setLoading(true)
    setError(null)
    const durNum = duration.trim() === '' ? 60 : parseInt(duration, 10)
    const result = await updateProgramDefaults(selectedProgram, {
      location: location.trim() || null,
      capacity: capacity === '' ? null : parseInt(capacity, 10),
      duration_minutes: durNum > 0 ? durNum : 60,
    })
    setLoading(false)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      return
    }
    const count = result && 'updated' in result ? result.updated : 0
    setSuccess(`Updated ${count} class(es). You can still fine-tune each class in the table.`)
    setTimeout(() => {
      setOpen(false)
      if (typeof window !== 'undefined') window.location.reload()
    }, 1500)
  }

  if (programKeys.length === 0) return null

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Edit program (capacity, location & duration)</h3>
        <p className="text-xs text-gray-600 mb-3">
          Set default capacity, location and/or duration for all classes of a program. You can still edit each class individually below.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {programKeys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => openModal(key)}
              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {getProgramLabel(key)} — Edit
            </button>
          ))}
        </div>
      </div>

      {open && selectedProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900">Edit program: {getProgramLabel(selectedProgram)}</h3>
            <p className="text-sm text-gray-500 mt-1">Set capacity, location and/or duration for all classes in this program.</p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
              {success && (
                <div className="rounded-md bg-green-50 p-3">
                  <p className="text-sm text-green-800">{success}</p>
                </div>
              )}
              <div>
                <label htmlFor="edit-program-location" className="block text-sm font-medium text-gray-700">Location</label>
                <input
                  id="edit-program-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="e.g. Main hall"
                />
              </div>
              <div>
                <label htmlFor="edit-program-capacity" className="block text-sm font-medium text-gray-700">Capacity</label>
                <input
                  id="edit-program-capacity"
                  type="number"
                  min="0"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="Leave empty to keep current"
                />
              </div>
              <div>
                <label htmlFor="edit-program-duration" className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
                <input
                  id="edit-program-duration"
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="60"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-[44px] px-4 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-[44px] px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
