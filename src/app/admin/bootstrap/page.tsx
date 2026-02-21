import { getCurrentProfile, getCurrentUser } from '@/lib/helpers'
import { makeMeAdmin } from '@/lib/actions/bootstrap'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'

const IS_DEV = process.env.NODE_ENV !== 'production'

export default async function AdminBootstrapPage() {
  if (!IS_DEV) {
    notFound()
  }

  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const profile = await getCurrentProfile()

  async function handleMakeAdmin() {
    'use server'
    await makeMeAdmin()
  }

  return (
    <div className="px-4 py-6 max-w-md">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dev bootstrap</h1>
      <p className="text-sm text-amber-700 mb-6">
        Only available when NODE_ENV !== &quot;production&quot;. Use this to make your user an admin.
      </p>
      <div className="rounded-lg bg-white p-6 shadow-sm border space-y-4">
        <div>
          <p className="text-sm text-gray-500">Logged-in user</p>
          <p className="font-medium text-gray-900">{user.email ?? '—'}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Profile role</p>
          <p className="font-medium text-gray-900">{profile?.role ?? '—'}</p>
        </div>
        <form action={handleMakeAdmin}>
          <button
            type="submit"
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
          >
            Make me admin
          </button>
        </form>
      </div>
    </div>
  )
}
