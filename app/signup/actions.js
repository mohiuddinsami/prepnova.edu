'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function signup(formData) {
  const supabase = await createClient()

  const email = formData.get('email')
  const password = formData.get('password')
  const confirm_password = formData.get('confirm_password')
  const full_name = formData.get('full_name')
  const whatsapp_number = formData.get('whatsapp_number')
  const institution = formData.get('institution')
  const academic_year = formData.get('academic_year')
  const tos_agreed = formData.get('tos_agreed') === 'true'

  if (password !== confirm_password) {
    redirect('/signup?error=Passwords do not match')
  }

  if (!tos_agreed) {
    redirect('/signup?error=You must agree to the Terms of Service')
  }

  const tos_agreed_at = new Date().toISOString()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://prepnovaed.com'}/dashboard`,
      data: {
        full_name,
        whatsapp_number,
        institution,
        academic_year,
        tos_agreed,
        tos_agreed_at,
      },
    },
  })

  if (error) {
    console.error(error)
    const isDuplicate = error.message?.toLowerCase().includes('already') || error.status === 422
    const isRateLimit = error.message?.toLowerCase().includes('rate limit')
    const msg = isDuplicate 
      ? '⚠️ An account with this email address already exists. Please log in instead.' 
      : isRateLimit
      ? '⏳ Too many signup attempts or emails sent recently. Please wait a few minutes before trying again.'
      : error.message || 'Could not sign up user'
    redirect(`/signup?error=${encodeURIComponent(msg)}`)
  }

  // Supabase returns an empty identities array when email enumeration protection is enabled and email already exists
  if (data?.user && data.user.identities && data.user.identities.length === 0) {
    redirect('/signup?error=' + encodeURIComponent('⚠️ An account with this email address already exists. Please log in instead.'))
  }

  revalidatePath('/', 'layout')
  
  if (!data?.session) {
    redirect(`/login?message=${encodeURIComponent('✨ We have sent a verification link to your email! Please check your inbox (and spam folder) to activate your account.')}&email=${encodeURIComponent(email)}`)
  }

  redirect('/dashboard')
}
