'use client'

import { useState } from 'react'
import { submitAccessRequest } from '@/lib/actions/access-requests'
import Link from 'next/link'

export function RequestAccessForm() {
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)
    const form = e.currentTarget
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim()
    const fullName = (form.elements.namedItem('fullName') as HTMLInputElement).value.trim()
    setSubmitting(true)
    const out = await submitAccessRequest(email, fullName)
    setSubmitting(false)
    if (out.error) {
      setMessage({ type: 'error', text: out.error })
      return
    }
    setMessage({
      type: 'success',
      text: 'Request sent. You’ll receive an email with a sign-in link once an admin approves your access.',
    })
    form.reset()
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
            Full name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-600 py-2 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Sending…' : 'Request access'}
        </button>
      </form>
      {message && (
        <div
          className={`rounded-md p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
        >
          {message.text}
        </div>
      )}
      <p className="text-center text-sm text-gray-500">
        Already have access? <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
      </p>
    </>
  )
}
