'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData) {
  const supabase = await createClient()

  const email = formData.get('email')
  const password = formData.get('password')

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.error(error)
    redirect(`/login?error=${encodeURIComponent(error.message)}&email=${encodeURIComponent(email || '')}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function resendEmail(formData) {
  const supabase = await createClient()
  const email = formData.get('email')

  if (!email) {
    redirect('/login?error=' + encodeURIComponent('Please enter your email to resend verification'))
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://prepnovaed.com'}/dashboard`,
    },
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}&email=${encodeURIComponent(email)}`)
  }

  redirect(`/login?error=${encodeURIComponent('✨ Verification email re-sent! Please check your inbox.')}&email=${encodeURIComponent(email)}`)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
