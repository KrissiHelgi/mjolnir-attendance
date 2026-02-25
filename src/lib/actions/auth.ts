'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/** For use with useFormState: (prevState, formData). Returns { error } on auth failure. */
export async function signIn(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: 'Wrong password or email' }
  }

  // Ensure profile exists and redirect pending users
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: user.email?.split('@')[0] || '',
          role: 'coach',
        })
    } else if (profile.role === 'pending') {
      revalidatePath('/', 'layout')
      redirect('/pending')
    }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
