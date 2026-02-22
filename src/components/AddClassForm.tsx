'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PROGRAMS, toCustomProgramKey } from '@/lib/programs'
import { getTitlesForProgram, WEEKDAY_LABELS } from '@/lib/class-titles'
import { createWeeklyClasses } from '@/lib/actions/schedule'

const NEW_PROGRAM_VALUE = '__new_program__'
const NEW_TITLE_VALUE = '__new_title__'

export function AddClassForm({ onSaveSuccess }: { onSaveSuccess?: () => void }) {
  const router = useRouter()
  const [program, setProgram] = useState('')
  const [customProgramName, setCustomProgramName] = useState('')
  const [title, setTitle] = useState('')
  const [customTitleName, setCustomTitleName] = useState('')
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [startTime, setStartTime] = useState('')
  const [location, setLocation] = useState('')
  const [capacity, setCapacity] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const isCustomProgram = program === NEW_PROGRAM_VALUE
  const isCustomTitle = title === NEW_TITLE_VALUE
  const effectiveProgramKey = isCustomProgram ? toCustomProgramKey(customProgramName) : program
  const effectiveTitle = isCustomTitle ? customTitleName.trim() : title

  const titleOptions = useMemo(() => getTitlesForProgram(effectiveProgramKey), [effectiveProgramKey])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  function toggleWeekday(d: number) {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)))
  }

  async function handleSubmit(saveAndAddAnother: boolean) {
    setError(null)
    const programToUse = isCustomProgram ? toCustomProgramKey(customProgramName) : program
    const titleToUse = isCustomTitle ? customTitleName.trim() : title
    if (!programToUse) {
      setError(isCustomProgram ? 'Enter a program name' : 'Select a program')
      return
    }
    if (!titleToUse) {
      setError(isCustomTitle ? 'Enter a title' : 'Select a title')
      return
    }
    if (weekdays.length === 0) {
      setError('Select at least one day')
      return
    }
    const timeStr = startTime.trim()
    if (!timeStr) {
      setError('Enter start time (HH:MM)')
      return
    }
    const capNum = capacity.trim() === '' ? undefined : parseInt(capacity, 10)
    if (capacity.trim() !== '' && (isNaN(capNum!) || capNum! < 0)) {
      setError('Capacity must be 0 or greater')
      return
    }

    setSaving(true)
    const result = await createWeeklyClasses({
      program: programToUse,
      title: titleToUse,
      weekdays,
      start_time: timeStr,
      location: location.trim() || undefined,
      capacity: capNum,
    })
    setSaving(false)

    if ('count' in result) {
      setToast(`Saved ${result.count} class${result.count !== 1 ? 'es' : ''}`)

      if (saveAndAddAnother) {
        setWeekdays([])
        setStartTime('')
      } else {
        onSaveSuccess?.()
      }
      router.refresh()
    } else {
      setError(result.error ?? 'Failed to save')
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {toast && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800" role="status">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="add-program" className="block text-sm font-medium text-gray-700">
            Program *
          </label>
          <select
            id="add-program"
            value={program}
            onChange={(e) => {
              setProgram(e.target.value)
              setTitle('')
              if (e.target.value !== NEW_PROGRAM_VALUE) setCustomProgramName('')
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          >
            <option value="">— Select —</option>
            {PROGRAMS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
            <option value={NEW_PROGRAM_VALUE}>Create new program…</option>
          </select>
          {isCustomProgram && (
            <input
              type="text"
              value={customProgramName}
              onChange={(e) => setCustomProgramName(e.target.value)}
              placeholder="e.g. Yoga"
              className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              autoFocus
            />
          )}
        </div>

        <div>
          <label htmlFor="add-title" className="block text-sm font-medium text-gray-700">
            Title *
          </label>
          <select
            id="add-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (e.target.value !== NEW_TITLE_VALUE) setCustomTitleName('')
            }}
            disabled={!program && !isCustomProgram}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:bg-gray-100 sm:text-sm"
          >
            <option value="">— Select —</option>
            {titleOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value={NEW_TITLE_VALUE}>Create new title…</option>
          </select>
          {isCustomTitle && (
            <input
              type="text"
              value={customTitleName}
              onChange={(e) => setCustomTitleName(e.target.value)}
              placeholder="e.g. Yoga Sunday"
              className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              autoFocus
            />
          )}
        </div>
      </div>

      <div>
        <span className="block text-sm font-medium text-gray-700 mb-2">Days *</span>
        <div className="flex flex-wrap gap-3">
          {WEEKDAY_LABELS.map((label, i) => (
            <label key={i} className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={weekdays.includes(i)}
                onChange={() => toggleWeekday(i)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="add-time" className="block text-sm font-medium text-gray-700">
            Time (HH:MM) *
          </label>
          <input
            id="add-time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="add-location" className="block text-sm font-medium text-gray-700">
            Location
          </label>
          <input
            id="add-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Optional"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="add-capacity" className="block text-sm font-medium text-gray-700">
            Capacity
          </label>
          <input
            id="add-capacity"
            type="number"
            min={0}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="Optional"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={saving}
          className="min-h-[44px] px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save & add another'}
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={saving}
          className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  )
}
