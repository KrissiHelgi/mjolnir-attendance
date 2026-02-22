'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateCoachRole,
  generateResetPasswordLink,
  removeCoach,
  type CoachRow,
} from '@/lib/actions/coaches'
import { approveAccessRequest, denyAccessRequest } from '@/lib/actions/access-requests'
import type { AccessRequestRow } from '@/lib/actions/access-requests'
import { formatLocalDateLabel } from '@/lib/dates'

export function CoachManagementClient({
  initialCoaches,
  initialPending = [],
}: {
  initialCoaches: CoachRow[]
  initialPending?: AccessRequestRow[]
}) {
  const router = useRouter()
  const [coaches, setCoaches] = useState<CoachRow[]>(initialCoaches)
  const [pending, setPending] = useState<AccessRequestRow[]>(initialPending)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [resetLink, setResetLink] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  async function handleRoleChange(userId: string, role: 'coach' | 'head_coach') {
    setLoadingId(userId)
    const out = await updateCoachRole(userId, role)
    setLoadingId(null)
    if (out.error) {
      showToast(out.error)
      return
    }
    setCoaches((prev) => prev.map((c) => (c.id === userId ? { ...c, role } : c)))
    showToast('Role updated')
    router.refresh()
  }

  async function handleCopyResetLink(email: string) {
    if (!email) {
      showToast('No email for this user')
      return
    }
    setLoadingId(email)
    const out = await generateResetPasswordLink(email)
    setLoadingId(null)
    if ('error' in out) {
      showToast(out.error)
      return
    }
    setResetLink(out.link)
    try {
      await navigator.clipboard.writeText(out.link)
      showToast('Reset link copied to clipboard')
    } catch {
      setResetLink(out.link)
      showToast('Link generated — copy from below')
    }
    router.refresh()
  }

  async function handleRemove(userId: string, email: string) {
    if (!confirm(`Remove ${email}? They will lose access and cannot sign in.`)) return
    setLoadingId(userId)
    const out = await removeCoach(userId)
    setLoadingId(null)
    if (out.error) {
      showToast(out.error)
      return
    }
    setCoaches((prev) => prev.filter((c) => c.id !== userId))
    showToast('Coach removed')
    router.refresh()
  }

  async function handleApproveRequest(id: string) {
    setLoadingId(id)
    const out = await approveAccessRequest(id)
    setLoadingId(null)
    if (out.error) {
      showToast(out.error)
      return
    }
    setPending((prev) => prev.filter((r) => r.id !== id))
    showToast('Invite sent')
    router.refresh()
  }

  async function handleDenyRequest(id: string) {
    setLoadingId(id)
    const out = await denyAccessRequest(id)
    setLoadingId(null)
    if (out.error) {
      showToast(out.error)
      return
    }
    setPending((prev) => prev.filter((r) => r.id !== id))
    showToast('Request denied')
    router.refresh()
  }

  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending access requests</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Requested</th>
                  <th className="text-left px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{r.email}</td>
                    <td className="px-3 py-2">{r.full_name || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{formatLocalDateLabel(r.created_at.slice(0, 10))}</td>
                    <td className="px-3 py-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleApproveRequest(r.id)}
                        disabled={loadingId === r.id}
                        className="text-green-700 hover:underline text-sm font-medium disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDenyRequest(r.id)}
                        disabled={loadingId === r.id}
                        className="text-red-700 hover:underline text-sm disabled:opacity-50"
                      >
                        Deny
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    <div className="rounded-lg bg-white p-6 shadow-sm border">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-lg bg-gray-900 text-white px-4 py-3 text-sm"
        >
          {toast}
        </div>
      )}
      {resetLink && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
          <p className="text-xs font-medium text-amber-900">Reset link (copy if needed):</p>
          <p className="text-xs text-amber-800 break-all mt-1">{resetLink}</p>
        </div>
      )}
      {coaches.length === 0 ? (
        <p className="text-gray-500">No coaches yet. Coaches appear here once they have a profile with role Coach or Head coach.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2">Email</th>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Role</th>
                <th className="text-left px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coaches.map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">{c.email || '—'}</td>
                  <td className="px-3 py-2">{c.full_name || '—'}</td>
                  <td className="px-3 py-2">
                    <select
                      value={c.role}
                      onChange={(e) => handleRoleChange(c.id, e.target.value as 'coach' | 'head_coach')}
                      disabled={loadingId === c.id}
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                    >
                      <option value="coach">Coach</option>
                      <option value="head_coach">Head coach</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyResetLink(c.email)}
                      disabled={loadingId === c.id || !c.email}
                      className="text-amber-700 hover:underline text-sm disabled:opacity-50"
                    >
                      Copy reset link
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(c.id, c.email)}
                      disabled={loadingId === c.id}
                      className="text-red-700 hover:underline text-sm disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </div>
  )
}
