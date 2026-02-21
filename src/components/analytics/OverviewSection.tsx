'use client'

type Overview = {
  totalOccurrences?: number
  totalLogged?: number
  uniquePrograms?: number
}

export function OverviewSection({ data }: { data: Overview | null; error?: string }) {
  if (!data) return null
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">Total class occurrences</p>
        <p className="text-2xl font-bold text-gray-900">{data.totalOccurrences ?? 0}</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">Attendance logs</p>
        <p className="text-2xl font-bold text-gray-900">{data.totalLogged ?? 0}</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">Programs with classes</p>
        <p className="text-2xl font-bold text-gray-900">{data.uniquePrograms ?? 0}</p>
      </div>
    </div>
  )
}
