import { getCurrentProfile, isSuperAdmin } from '@/lib/helpers'
import { signOut } from '@/lib/actions/auth'
import Link from 'next/link'

export async function Navigation() {
  const profile = await getCurrentProfile()
  const superAdmin = await isSuperAdmin()

  const displayName = profile?.full_name?.trim() || 'Kristján Helgi'

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-4 min-w-0">
          <div className="flex items-center min-w-0 flex-1">
            <div className="flex-shrink-0">
              <Link href="/" className="text-xl font-bold text-gray-900 whitespace-nowrap">
                Mjolnir Attendance
              </Link>
            </div>
            <div className="hidden sm:ml-4 md:ml-6 sm:flex sm:gap-4 lg:gap-8 min-w-0 flex-shrink">
              <Link
                href="/"
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium whitespace-nowrap"
              >
                Dashboard
              </Link>
              <Link
                href="/profile"
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium whitespace-nowrap"
              >
                Profile
              </Link>
              {process.env.NODE_ENV !== 'production' && profile && (
                <Link
                  href="/admin/bootstrap"
                  className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium whitespace-nowrap"
                >
                  Bootstrap
                </Link>
              )}
              {profile?.role === 'admin' && (
                <>
                  <Link
                    href="/admin/schedule"
                    className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium whitespace-nowrap"
                  >
                    Schedule
                  </Link>
                  <Link
                    href="/admin/analytics"
                    className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium whitespace-nowrap"
                  >
                    Analytics
                  </Link>
                </>
              )}
              {superAdmin && (
                <Link
                  href="/admin/coaches"
                  className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium whitespace-nowrap"
                >
                  Coaches
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center flex-shrink-0 gap-2 sm:gap-3">
            <span className="text-sm text-gray-700 truncate max-w-[90px] sm:max-w-[140px] md:max-w-[180px]" title={displayName}>
              {displayName}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </nav>
  )
}
