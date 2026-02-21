import { getCurrentProfile, isSuperAdmin } from '@/lib/helpers'
import { signOut } from '@/lib/actions/auth'
import Link from 'next/link'

export async function Navigation() {
  const profile = await getCurrentProfile()
  const superAdmin = await isSuperAdmin()

  return (
    <nav className="app-nav shadow-sm border-b border-[var(--foreground)]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Mjolnir Attendance
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/"
                className="border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                Dashboard
              </Link>
              <Link
                href="/profile"
                className="border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                Profile
              </Link>
              {process.env.NODE_ENV !== 'production' && profile && (
                <Link
                  href="/admin/bootstrap"
                  className="border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Bootstrap
                </Link>
              )}
              {profile?.role === 'admin' && (
                <>
                  <Link
                    href="/admin/schedule"
                    className="border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Schedule
                  </Link>
                  <Link
                    href="/admin/analytics"
                    className="border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Analytics
                  </Link>
                </>
              )}
              {superAdmin && (
                <Link
                  href="/admin/coaches"
                  className="border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Coaches
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center">
            <span className="text-sm text-gray-700 dark:text-gray-300 mr-4 truncate max-w-[140px] sm:max-w-none">
              {profile?.full_name || profile?.id}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
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
