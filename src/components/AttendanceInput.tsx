'use client'

import { useRef, useEffect, useState } from 'react'

const STEP_BUTTON_CLASS =
  'flex-1 min-w-0 min-h-[56px] flex items-center justify-center rounded-xl border-2 border-gray-300 bg-white text-2xl font-bold text-gray-800 active:bg-gray-100 disabled:opacity-50 touch-manipulation select-none'

const DEFAULT_MAX_HEADCOUNT = 60

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

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
  maxValue?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(clamp(initialValue, 0, maxValue))

  useEffect(() => {
    setValue(clamp(initialValue, 0, maxValue))
  }, [initialValue, maxValue])

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  function adjust(delta: number) {
    setValue((v) => clamp(v + delta, 0, maxValue))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(value)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '')
    if (raw === '') {
      setValue(0)
      return
    }
    const num = parseInt(raw, 10)
    if (!Number.isNaN(num)) setValue(clamp(num, 0, maxValue))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      inputRef.current?.blur()
    }
  }

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
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={loading}
          aria-label="Headcount"
          className="flex-1 min-w-0 min-h-[56px] text-center text-2xl font-bold rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white px-2 py-2 touch-manipulation [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
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

