'use client'

import { useRef, useEffect, useState } from 'react'

const STEP_BUTTON_CLASS =
  'flex-1 min-w-0 min-h-[56px] flex items-center justify-center rounded-xl border-2 border-gray-300 bg-white text-2xl font-bold text-gray-800 active:bg-gray-100 disabled:opacity-50 touch-manipulation select-none'

const DEFAULT_MAX_HEADCOUNT = 60

export function AttendanceInput({
  initialValue = 0,
  onSave,
  loading = false,
  error,
  autoFocus = true,
  maxValue = DEFAULT_MAX_HEADCOUNT,
}: {
  initialValue?: number
  onSave: (value: number) => void
  loading?: boolean
  error?: string | null
  autoFocus?: boolean
  /** Max option in dropdown (e.g. from capacity). Default 60. */
  maxValue?: number
}) {
  const selectRef = useRef<HTMLSelectElement>(null)
  const [value, setValue] = useState(Math.max(0, Math.min(initialValue, maxValue)))

  useEffect(() => {
    setValue((v) => Math.max(0, Math.min(initialValue, maxValue)))
  }, [initialValue, maxValue])

  useEffect(() => {
    if (autoFocus && selectRef.current) {
      selectRef.current.focus()
    }
  }, [autoFocus])

  function adjust(delta: number) {
    setValue((v) => Math.max(0, Math.min(maxValue, v + delta)))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(value)
  }

  const options = Array.from({ length: maxValue + 1 }, (_, i) => i)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 font-medium" role="alert">
          {error}
        </p>
      )}
      <div className="flex w-full items-stretch gap-2 sm:gap-3">
        <button
          type="button"
          aria-label="Decrease by 1"
          onClick={() => adjust(-1)}
          disabled={loading || value < 1}
          className={STEP_BUTTON_CLASS}
        >
          −1
        </button>
        <select
          ref={selectRef}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          disabled={loading}
          aria-label="Headcount"
          className="flex-1 min-w-0 min-h-[56px] text-center text-2xl font-bold rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white cursor-pointer px-2 py-2 touch-manipulation [&>option]:text-lg"
        >
          {options.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Increase by 1"
          onClick={() => adjust(1)}
          disabled={loading || value >= maxValue}
          className={STEP_BUTTON_CLASS}
        >
          +1
        </button>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-[52px] rounded-xl bg-blue-600 text-white font-semibold text-base active:bg-blue-700 disabled:opacity-50 touch-manipulation"
      >
        {loading ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}

