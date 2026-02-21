import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/helpers'
import { CreateAccountForm } from '@/components/CreateAccountForm'

export default async function RequestAccessPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (data?.user) {
    const profile = await getCurrentProfile()
    redirect(profile?.role === 'pending' ? '/pending' : '/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-md">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create an account</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign up for coach access. An admin will review your request and approve it so you can sign in.
          </p>
        </div>
        <CreateAccountForm />
      </div>
    </div>
  )
}
