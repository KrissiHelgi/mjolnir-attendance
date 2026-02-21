import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/helpers'
import { redirect } from 'next/navigation'
import { createTemplate, updateTemplate, deleteTemplate, importTemplatesFromCSV, type ClassTemplate } from '@/lib/actions/schedule'
import { ScheduleForm } from '@/components/ScheduleForm'
import { TemplateList } from '@/components/TemplateList'
import { CSVImport } from '@/components/CSVImport'
import { GoogleSheetsSync } from '@/components/GoogleSheetsSync'
import { PasteTimetableImporter } from '@/components/PasteTimetableImporter'

export default async function AdminSchedulePage() {
  const profile = await getCurrentProfile()

  if (!profile || profile.role !== 'admin') {
    redirect('/')
  }

  const supabase = await createClient()
  const { data: templates, error } = await supabase
    .from('class_templates')
    .select('*')
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
        <h1 className="text-2xl font-bold text-gray-900">Weekly timetable</h1>
        <p className="mt-1 text-sm text-gray-500">Manage the base weekly schedule. Today’s classes are derived from this.</p>
      </div>

      <div className="space-y-6">
        <GoogleSheetsSync />
        <PasteTimetableImporter />

        <div className="rounded-lg bg-white p-6 shadow-sm border">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create template</h2>
          <ScheduleForm createAction={createTemplate} />
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Templates</h2>
            <CSVImport importAction={importTemplatesFromCSV} />
          </div>
          <TemplateList
            templates={templates ?? []}
            updateAction={updateTemplate}
            deleteAction={deleteTemplate}
          />
        </div>
      </div>
    </div>
  )
}
