'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export type NavLinkItem = { href: string; label: string }

export function NavBar({
  links,
  displayName,
  signOutAction,
}: {
  links: NavLinkItem[]
  displayName: string
  signOutAction: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const onResize = () => setMenuOpen(false)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const handler = () => setMenuOpen(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [menuOpen])

  const linkClass =
    'block py-3 px-4 text-gray-700 hover:bg-gray-100 hover:text-gray-900 font-medium border-b border-gray-100 last:border-0'

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 md:h-16">
          <Link href="/" className="text-xl font-bold text-gray-900 whitespace-nowrap flex-shrink-0">
            Mjolnir Attendance
          </Link>

          {/* Desktop: links + name + sign out */}
          <div className="hidden md:flex md:items-center md:gap-4 lg:gap-6 min-w-0 flex-1 justify-end">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
            <span className="text-sm text-gray-700 truncate max-w-[160px]" title={displayName}>
              {displayName}
            </span>
            <form action={signOutAction}>
              <button type="submit" className="text-sm text-gray-500 hover:text-gray-700 whitespace-nowrap">
                Sign out
              </button>
            </form>
          </div>

          {/* Mobile: hamburger */}
          <div className="flex md:hidden items-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen((o) => !o)
              }}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              aria-expanded={menuOpen}
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu panel */}
        {menuOpen && (
          <div
            className="md:hidden border-t border-gray-200 bg-white shadow-lg rounded-b-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {links.map((item) => (
              <Link key={item.href} href={item.href} className={linkClass} onClick={() => setMenuOpen(false)}>
                {item.label}
              </Link>
            ))}
            <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
              <span className="text-sm font-medium text-gray-700 truncate" title={displayName}>
                {displayName}
              </span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
