'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui', padding: 24, background: '#fef2f2' }}>
        <h1 style={{ color: '#b91c1c' }}>Application error</h1>
        <p style={{ color: '#991b1b', marginBottom: 16 }}>{error.message}</p>
        <button
          onClick={reset}
          style={{
            padding: '8px 16px',
            background: '#b91c1c',
            color: 'white',
            border: 'none',
            borderRadius: 6,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
