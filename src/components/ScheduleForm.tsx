'use client'

import { useState } from 'react'
import { type ClassTemplate } from '@/lib/actions/schedule'
import { PROGRAMS } from '@/lib/programs'

export function ScheduleForm({
  createAction,
  updateAction,
  templateId,
  initialData,
  onSuccess,
  submitLabel,
}: {
  createAction?: (data: ClassTemplate) => Promise<any>
  updateAction?: (id: string, data: Partial<ClassTemplate>) => Promise<any>
  templateId?: string
  initialData?: Partial<ClassTemplate>
  onSuccess?: () => void
  submitLabel?: string
}) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const isEdit = Boolean(templateId && updateAction)
  const label = submitLabel ?? (isEdit ? 'Save changes' : 'Add class')

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const rawDuration = formData.get('duration_minutes')
    const durationMinutes = rawDuration ? parseInt(String(rawDuration), 10) : 60
    const data: ClassTemplate = {
      program: formData.get('program') as string,
      title: formData.get('title') as string,
      weekday: parseInt(formData.get('weekday') as string),
      start_time: formData.get('start_time') as string,
      location: (formData.get('location') as string) || undefined,
      capacity: formData.get('capacity') ? parseInt(formData.get('capacity') as string) : undefined,
      duration_minutes: (durationMinutes > 0 ? durationMinutes : 60) || undefined,
    }

    const result = isEdit
      ? await updateAction!(templateId!, data)
      : await createAction!(data)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      onSuccess?.()
      setLoading(false)
      if (typeof window !== 'undefined') window.location.reload()
    }
  }

  return (
    <form id={templateId ? `schedule-form-${templateId}` : 'schedule-form'} action={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="program" className="block text-sm font-medium text-gray-700">
            Program *
          </label>
          <select
            id="program"
            name="program"
            required
            defaultValue={initialData?.program ?? ''}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          >
            <option value="">— Select —</option>
            {PROGRAMS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Title *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            required
            defaultValue={initialData?.title}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="weekday" className="block text-sm font-medium text-gray-700">
            Weekday *
          </label>
          <select
            id="weekday"
            name="weekday"
            required
            defaultValue={initialData?.weekday}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          >
            <option value="0">Sunday</option>
            <option value="1">Monday</option>
            <option value="2">Tuesday</option>
            <option value="3">Wednesday</option>
            <option value="4">Thursday</option>
            <option value="5">Friday</option>
            <option value="6">Saturday</option>
          </select>
        </div>

        <div>
          <label htmlFor="start_time" className="block text-sm font-medium text-gray-700">
            Start Time *
          </label>
          <input
            type="time"
            id="start_time"
            name="start_time"
            required
            defaultValue={initialData?.start_time}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700">
            Location
          </label>
          <input
            type="text"
            id="location"
            name="location"
            defaultValue={initialData?.location}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="capacity" className="block text-sm font-medium text-gray-700">
            Capacity
          </label>
          <input
            type="number"
            id="capacity"
            name="capacity"
            min="1"
            defaultValue={initialData?.capacity}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="duration_minutes" className="block text-sm font-medium text-gray-700">
            Duration (min)
          </label>
          <input
            type="number"
            id="duration_minutes"
            name="duration_minutes"
            min="1"
            defaultValue={initialData?.duration_minutes ?? 60}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Saving...' : label}
        </button>
      </div>
    </form>
  )
}
