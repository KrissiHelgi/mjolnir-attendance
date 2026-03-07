'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
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
        View attendance for each class in the course. Create and add sessions under Admin → Courses.
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
        <p className="text-gray-500 text-sm">Select a course to see attendance.</p>
      ) : !data ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : !data.bySession?.length ? (
        <p className="text-gray-500 text-sm">No sessions in this course yet. Add sessions in Admin → Courses.</p>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-800">
            {data.courseName} — {data.startDate} to {data.endDate}
          </p>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.bySession}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="sessionLabel"
                  tick={{ fontSize: 11 }}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  labelStyle={{ color: '#111' }}
                  formatter={(value: number | undefined) => [value ?? 0, 'Attendance']}
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as { sessionLabel: string; date: string } | undefined
                    return p ? `${p.sessionLabel} (${p.date})` : ''
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="headcount"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 6, fill: '#2563eb', strokeWidth: 0 }}
                  name="Attendance"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
