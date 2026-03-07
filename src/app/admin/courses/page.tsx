import { getCurrentProfile } from '@/lib/helpers'
import { redirect } from 'next/navigation'
import { listCourses } from '@/lib/actions/courses'
import { CoursesClient } from '@/components/courses/CoursesClient'

export default async function AdminCoursesPage() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin') redirect('/')

  const { data: courses, error } = await listCourses()

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
        <p className="mt-1 text-sm text-gray-500">
          Time-bounded groups of classes (e.g. 4–8 week courses). Create a course, then add sessions from your weekly schedule to track attendance across the course.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <CoursesClient initialCourses={courses ?? []} />
    </div>
  )
}
