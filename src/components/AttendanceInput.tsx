'use client'

import { useRef, useEffect, useState } from 'react'

const STEP_BUTTON_CLASS =
  'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border-2 border-gray-300 bg-white text-lg font-bold text-gray-800 active:bg-gray-100 disabled:opacity-50'

export function AttendanceInput({
  initialValue = 0,
  onSave,
  loading = false,
  error,
  autoFocus = true,
}: {
  initialValue?: number
  onSave: (value: number) => void
  loading?: boolean
  error?: string | null
  autoFocus?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(Math.max(0, initialValue))

  useEffect(() => {
    setValue((v) => Math.max(0, initialValue))
  }, [initialValue])

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [autoFocus])

  function adjust(delta: number) {
    setValue((v) => Math.max(0, v + delta))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(value)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 font-medium" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Decrease by 5"
            onClick={() => adjust(-5)}
            disabled={loading || value < 5}
            className={STEP_BUTTON_CLASS}
          >
            −5
          </button>
          <button
            type="button"
            aria-label="Decrease by 1"
            onClick={() => adjust(-1)}
            disabled={loading || value < 1}
            className={STEP_BUTTON_CLASS}
          >
            −1
          </button>
        </div>
        <input
          ref={inputRef}
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(Math.max(0, parseInt(e.target.value, 10) || 0))}
          disabled={loading}
          aria-label="Headcount"
          className="w-20 min-h-[48px] text-center text-2xl font-bold rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Increase by 1"
            onClick={() => adjust(1)}
            disabled={loading}
            className={STEP_BUTTON_CLASS}
          >
            +1
          </button>
          <button
            type="button"
            aria-label="Increase by 5"
            onClick={() => adjust(5)}
            disabled={loading}
            className={STEP_BUTTON_CLASS}
          >
            +5
          </button>
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-[48px] rounded-xl bg-blue-600 text-white font-semibold text-base active:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}

