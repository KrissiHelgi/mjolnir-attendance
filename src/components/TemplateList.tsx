'use client'

import { useState } from 'react'
import { type ClassTemplate } from '@/lib/actions/schedule'
import { getProgramLabel } from '@/lib/programs'
import { ScheduleForm } from './ScheduleForm'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function TemplateList({
  templates,
  updateAction,
  deleteAction,
}: {
  templates: any[]
  updateAction: (id: string, data: Partial<ClassTemplate>) => Promise<any>
  deleteAction: (id: string) => Promise<any>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this template?')) return
    const result = await deleteAction(id)
    if (result.error) setError(result.error)
    else if (typeof window !== 'undefined') window.location.reload()
  }

  if (templates.length === 0) {
    return <p className="text-gray-500">No templates yet. Create one above.</p>
  }

  const editing = editingId ? templates.find((t) => t.id === editingId) : null

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Program</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Day/Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Capacity</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {templates.map((template) => (
              <tr key={template.id}>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{getProgramLabel(template.program)}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{template.title}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {WEEKDAYS[template.weekday]} {template.start_time}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{template.location || '-'}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{template.capacity ?? '-'}</td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(template.id)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(template.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit template</h3>
            <ScheduleForm
              updateAction={updateAction}
              templateId={editing.id}
              initialData={{
                program: editing.program,
                title: editing.title,
                weekday: editing.weekday,
                start_time: editing.start_time,
                location: editing.location,
                capacity: editing.capacity,
              }}
              onSuccess={() => setEditingId(null)}
            />
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
