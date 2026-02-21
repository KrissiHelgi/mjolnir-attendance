import { getCurrentProfile } from '@/lib/helpers'
import { redirect } from 'next/navigation'
import { updateCoachedPrograms } from '@/lib/actions/profile'
import { ProfileProgramsForm } from '@/components/ProfileProgramsForm'
import { PROGRAMS } from '@/lib/programs'

export default async function ProfilePage() {
  const profile = await getCurrentProfile()
  if (!profile) {
    redirect('/login')
  }

  const coachedPrograms = (profile.coached_programs ?? []) as string[]

  return (
    <div className="px-4 py-6 max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
      <p className="mt-1 text-sm text-gray-500 mb-6">
        Choose which programs you coach. Your dashboard will only show today’s classes for these programs.
      </p>
      <ProfileProgramsForm
        programs={PROGRAMS}
        selectedKeys={coachedPrograms}
        saveAction={updateCoachedPrograms}
        emptyHint="Veldu hvaða íþróttir þú kennir til að sjá tímana þína."
      />
    </div>
  )
}
