import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RequestAccessForm } from '@/components/RequestAccessForm'

export default async function RequestAccessPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (data?.user) redirect('/')

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-md">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Request coach access</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter your details. An admin will review your request and send you an invite to sign in.
          </p>
        </div>
        <RequestAccessForm />
      </div>
    </div>
  )
}
