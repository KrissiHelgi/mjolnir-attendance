'use client'

import type { CourseAttendanceResult } from '@/lib/analytics'

type Props = {
  courses: { id: string; name: string; program: string | null; start_date: string; end_date: string }[]
  selectedCourseId: string
  onCourseChange: (courseId: string) => void
  data: CourseAttendanceResult | null
  error?: string
}

export function CourseSection({
  courses,
  selectedCourseId,
  onCourseChange,
  data,
  error,
}: Props) {
  if (error) {
    return <p className="text-sm text-red-600">{error}</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        View attendance progress by week for a course. Create and add sessions under Admin → Courses.
      </p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
        <select
          value={selectedCourseId}
          onChange={(e) => onCourseChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-full max-w-md"
        >
          <option value="">— Select course —</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.start_date} – {c.end_date})
            </option>
          ))}
        </select>
      </div>
      {!selectedCourseId ? (
        <p className="text-gray-500 text-sm">Select a course to see attendance by week.</p>
      ) : !data ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : data.byWeek.length === 0 ? (
        <p className="text-gray-500 text-sm">No sessions in this course yet. Add sessions in Admin → Courses.</p>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-800">
            {data.courseName} — {data.startDate} to {data.endDate}
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600">
                  <th className="py-2 pr-4 font-medium">Week</th>
                  <th className="py-2 pr-4 font-medium text-right">Sessions</th>
                  <th className="py-2 pr-4 font-medium text-right">Logged</th>
                  <th className="py-2 font-medium text-right">Total attendance</th>
                </tr>
              </thead>
              <tbody>
                {data.byWeek.map((row) => (
                  <tr key={row.weekNumber} className="border-b border-gray-100">
                    <td className="py-2 pr-4 text-gray-900">{row.weekLabel}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{row.sessionCount}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{row.loggedCount}</td>
                    <td className="py-2 text-right tabular-nums font-medium">{row.totalHeadcount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
