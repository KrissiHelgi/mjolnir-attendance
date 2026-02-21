import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/helpers'
import { signOut } from '@/lib/actions/auth'
import Link from 'next/link'

export default async function PendingPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'pending') redirect('/')

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-md text-center">
        <h1 className="text-2xl font-bold text-gray-900">Access pending</h1>
        <p className="text-gray-600">
          Your account has been created. An admin will review your request and approve access. You’ll be able to sign in once approved.
        </p>
        <form action={signOut} className="pt-4">
          <button
            type="submit"
            className="w-full rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Sign out
          </button>
        </form>
        <p className="text-sm text-gray-500">
          <Link href="/login" className="text-blue-600 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
