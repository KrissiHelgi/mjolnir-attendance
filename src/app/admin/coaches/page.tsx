import { getCurrentProfile } from '@/lib/helpers'
import { isSuperAdmin } from '@/lib/helpers'
import { redirect } from 'next/navigation'
import { CoachManagementClient } from '@/components/CoachManagementClient'
import { getCoachesForManagement } from '@/lib/actions/coaches'

export default async function AdminCoachesPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!(await isSuperAdmin())) redirect('/')

  const result = await getCoachesForManagement()
  const coaches = 'data' in result ? result.data : []

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Coach management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage coaches, set Head coach / Coach, copy reset-password links, or remove access. Only visible to super admin.
        </p>
      </div>
      {'error' in result && result.error && (
        <div className="rounded-md bg-red-50 p-4 mb-4">
          <p className="text-sm text-red-800">{result.error}</p>
          <p className="text-xs text-red-600 mt-1">
            Add SUPABASE_SERVICE_ROLE_KEY to env (Vercel and .env.local) for list/update/delete and reset links.
          </p>
        </div>
      )}
      <CoachManagementClient initialCoaches={coaches} />
    </div>
  )
}
