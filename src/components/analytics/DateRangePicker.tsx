'use client'

type Props = {
  startDate: string
  endDate: string
  onRangeChange: (start: string, end: string) => void
}

export function DateRangePicker({ startDate, endDate, onRangeChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">From</span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onRangeChange(e.target.value, endDate)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">To</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onRangeChange(startDate, e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
    </div>
  )
}
