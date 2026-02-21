import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/helpers'
import { redirect } from 'next/navigation'
import { deleteTemplate, clearSchedule, type ClassTemplate } from '@/lib/actions/schedule'
import { PasteTimetableImporter } from '@/components/PasteTimetableImporter'
import { WeeklyScheduleTable } from '@/components/WeeklyScheduleTable'
import { ClearScheduleButton } from '@/components/ClearScheduleButton'

export default async function AdminSchedulePage() {
  const profile = await getCurrentProfile()

  if (!profile || profile.role !== 'admin') {
    redirect('/')
  }

  const supabase = await createClient()
  const { data: classes, error } = await supabase
    .from('class_templates')
    .select('id, program, title, weekday, start_time, location, capacity')
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) {
    return (
      <div className="px-4 py-6">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">Error loading: {error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Weekly schedule</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage the base weekly schedule. Today’s classes are derived from this. Use <strong>Paste timetable</strong> to overwrite the schedule.
        </p>
      </div>

      <div className="space-y-6">
        <PasteTimetableImporter />

        <div className="rounded-lg bg-white p-6 shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Classes</h2>
            <ClearScheduleButton clearAction={clearSchedule} hasRows={(classes?.length ?? 0) > 0} />
          </div>
          <WeeklyScheduleTable
            classes={(classes ?? []) as (ClassTemplate & { id: string })[]}
            deleteAction={deleteTemplate}
          />
        </div>
      </div>
    </div>
  )
}
