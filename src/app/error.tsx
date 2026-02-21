'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  const isEnvError =
    error.message?.includes('SUPABASE') ||
    error.message?.includes('env') ||
    error.message?.includes('NEXT_PUBLIC')

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full rounded-lg bg-red-50 border border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-red-800 mb-4 font-mono break-all">
          {error.message}
        </p>
        {isEnvError && (
          <p className="text-sm text-red-700 mb-4">
            Check your <code className="bg-red-100 px-1 rounded">.env.local</code> and ensure
            NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
          </p>
        )}
        <button
          onClick={reset}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
