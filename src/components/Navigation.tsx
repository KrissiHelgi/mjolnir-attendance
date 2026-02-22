import { getCurrentProfile, isSuperAdmin } from '@/lib/helpers'
import { signOut } from '@/lib/actions/auth'
import { NavBar, type NavLinkItem } from '@/components/NavBar'

export async function Navigation() {
  const profile = await getCurrentProfile()
  const superAdmin = await isSuperAdmin()

  const displayName = profile?.full_name?.trim() || 'Kristján Helgi'

  const links: NavLinkItem[] = [
    { href: '/', label: 'Dashboard' },
    { href: '/profile', label: 'Profile' },
  ]
  if (process.env.NODE_ENV !== 'production' && profile) {
    links.push({ href: '/admin/bootstrap', label: 'Bootstrap' })
  }
  if (profile?.role === 'admin') {
    links.push({ href: '/admin/schedule', label: 'Schedule' })
    links.push({ href: '/admin/analytics', label: 'Analytics' })
  }
  if (superAdmin) {
    links.push({ href: '/admin/coaches', label: 'Coaches' })
  }

  return (
    <NavBar
      links={links}
      displayName={displayName}
      signOutAction={signOut}
    />
  )
}
