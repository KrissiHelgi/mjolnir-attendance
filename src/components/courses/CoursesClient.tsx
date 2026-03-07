'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProgramLabel } from '@/lib/programs'
import { getWeekdayLabel } from '@/lib/class-titles'
import {
  createCourse,
  updateCourse,
  deleteCourse,
  addSessionsToCourse,
  listCourseSessions,
  listTemplatesForCoursePicker,
  removeOccurrenceFromCourse,
  type Course,
  type CourseSessionRow,
} from '@/lib/actions/courses'

export function CoursesClient({ initialCourses }: { initialCourses: Course[] }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [program, setProgram] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<CourseSessionRow[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [addModalCourseId, setAddModalCourseId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<{ id: string; program: string; title: string; weekday: number; start_time: string }[]>([])
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set())
  const [addSessionsLoading, setAddSessionsLoading] = useState(false)
  const [addSessionsError, setAddSessionsError] = useState<string | null>(null)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [editName, setEditName] = useState('')
  const [editProgram, setEditProgram] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    setCreateLoading(true)
    const r = await createCourse({
      name: name.trim(),
      program: program.trim() || null,
      start_date: startDate,
      end_date: endDate,
    })
    setCreateLoading(false)
    if (r.error) {
      setCreateError(r.error)
      return
    }
    setName('')
    setProgram('')
    setStartDate('')
    setEndDate('')
    setCreating(false)
    router.refresh()
  }

  async function toggleSessions(courseId: string) {
    if (expandedId === courseId) {
      setExpandedId(null)
      return
    }
    setExpandedId(courseId)
    setSessionsLoading(true)
    const r = await listCourseSessions(courseId)
    setSessionsLoading(false)
    if (r.data) setSessions(r.data)
    else setSessions([])
  }

  function openAddModal(courseId: string) {
    setAddModalCourseId(courseId)
    setSelectedTemplateIds(new Set())
    setAddSessionsError(null)
    listTemplatesForCoursePicker().then((r) => {
      if (r.data) setTemplates(r.data)
      else setTemplates([])
    })
  }

  async function handleAddSessions() {
    if (!addModalCourseId) return
    setAddSessionsError(null)
    setAddSessionsLoading(true)
    const r = await addSessionsToCourse(addModalCourseId, [...selectedTemplateIds])
    setAddSessionsLoading(false)
    if (r.error) {
      setAddSessionsError(r.error)
      return
    }
    setAddModalCourseId(null)
    if (expandedId === addModalCourseId) {
      const r2 = await listCourseSessions(addModalCourseId)
      if (r2.data) setSessions(r2.data)
    }
    router.refresh()
  }

  async function handleRemoveFromCourse(occurrenceId: string) {
    const r = await removeOccurrenceFromCourse(occurrenceId)
    if (!r.error && expandedId) {
      const r2 = await listCourseSessions(expandedId)
      if (r2.data) setSessions(r2.data)
    }
    router.refresh()
  }

  function openEditModal(course: Course) {
    setEditingCourse(course)
    setEditName(course.name)
    setEditProgram(course.program ?? '')
    setEditStartDate(course.start_date)
    setEditEndDate(course.end_date)
    setEditError(null)
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editingCourse) return
    setEditError(null)
    setEditLoading(true)
    const r = await updateCourse(editingCourse.id, {
      name: editName.trim(),
      program: editProgram.trim() || null,
      start_date: editStartDate,
      end_date: editEndDate,
    })
    setEditLoading(false)
    if (r.error) {
      setEditError(r.error)
      return
    }
    setEditingCourse(null)
    router.refresh()
  }

  async function handleDeleteConfirm(courseId: string) {
    setDeleteLoading(true)
    const r = await deleteCourse(courseId)
    setDeleteLoading(false)
    if (!r.error) {
      setDeletingCourseId(null)
      if (expandedId === courseId) setExpandedId(null)
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow-sm border">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create course</h2>
        {!creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            New course
          </button>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4 max-w-md">
            {createError && (
              <p className="text-sm text-red-600">{createError}</p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="e.g. BJJ 201 Jan–Feb 2025"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Program (optional)</label>
              <input
                type="text"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="e.g. bjj"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createLoading}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-50"
              >
                {createLoading ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => { setCreating(false); setCreateError(null); }}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm border">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">All courses</h2>
        {initialCourses.length === 0 ? (
          <p className="text-gray-500 text-sm">No courses yet. Create one above.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {initialCourses.map((course) => (
              <li key={course.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-gray-900">{course.name}</span>
                    {course.program && (
                      <span className="ml-2 text-sm text-gray-500">{getProgramLabel(course.program)}</span>
                    )}
                    <span className="ml-2 text-sm text-gray-500">
                      {course.start_date} – {course.end_date}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSessions(course.id)}
                      className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {expandedId === course.id ? 'Hide sessions' : 'View sessions'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(course)}
                      className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => openAddModal(course.id)}
                      className="min-h-[40px] px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                    >
                      Add sessions
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingCourseId(course.id)}
                      className="min-h-[40px] px-3 py-2 rounded-lg border border-red-200 bg-white text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {expandedId === course.id && (
                  <div className="mt-4">
                    {sessionsLoading ? (
                      <p className="text-sm text-gray-500">Loading…</p>
                    ) : sessions.length === 0 ? (
                      <p className="text-sm text-gray-500">No sessions in this course. Use &quot;Add sessions&quot; to add classes from your weekly schedule (creates occurrences for each date in the course range).</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 text-left text-gray-600">
                              <th className="py-2 pr-4">Date</th>
                              <th className="py-2 pr-4">Time</th>
                              <th className="py-2 pr-4">Program</th>
                              <th className="py-2 pr-4">Title</th>
                              <th className="py-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sessions.map((s) => (
                              <tr key={s.id} className="border-b border-gray-100">
                                <td className="py-2 pr-4">{s.local_date}</td>
                                <td className="py-2 pr-4">{s.start_time}</td>
                                <td className="py-2 pr-4">{getProgramLabel(s.program)}</td>
                                <td className="py-2 pr-4">{s.title}</td>
                                <td className="py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFromCourse(s.id)}
                                    className="text-red-600 hover:text-red-800 text-xs"
                                  >
                                    Remove from course
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {editingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit course</h3>
            <form onSubmit={handleEditSave} className="space-y-4">
              {editError && <p className="text-sm text-red-600">{editError}</p>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Program (optional)</label>
                <input
                  type="text"
                  value={editProgram}
                  onChange={(e) => setEditProgram(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCourse(null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-50"
                >
                  {editLoading ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingCourseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900">Delete this course?</h3>
            <p className="mt-2 text-sm text-gray-600">
              The course will be removed. Sessions linked to it will be unlinked (they stay in the schedule). This cannot be undone.
            </p>
            <div className="mt-6 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeletingCourseId(null)}
                disabled={deleteLoading}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConfirm(deletingCourseId)}
                disabled={deleteLoading}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {addModalCourseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Add sessions to course</h3>
            <p className="text-sm text-gray-600 mb-4">
              Select which weekly classes belong to this course. Sessions will be created for every date in the course range.
            </p>
            {addSessionsError && (
              <p className="text-sm text-red-600 mb-2">{addSessionsError}</p>
            )}
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {templates.length === 0 ? (
                <p className="text-sm text-gray-500">Loading classes…</p>
              ) : (
                templates.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTemplateIds.has(t.id)}
                      onChange={(e) => {
                        setSelectedTemplateIds((prev) => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(t.id)
                          else next.delete(t.id)
                          return next
                        })
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">
                      {getWeekdayLabel(t.weekday)} {String(t.start_time).slice(0, 5)} — {getProgramLabel(t.program)} {t.title}
                    </span>
                  </label>
                ))
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setAddModalCourseId(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddSessions}
                disabled={addSessionsLoading || selectedTemplateIds.size === 0}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-50"
              >
                {addSessionsLoading ? 'Adding…' : `Add sessions (${selectedTemplateIds.size} selected)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
