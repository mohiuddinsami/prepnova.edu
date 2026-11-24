'use server'

import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function updateProfile(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const updates = {}
  if (formData.has('full_name')) updates.full_name = formData.get('full_name')
  if (formData.has('institution')) updates.institution = formData.get('institution')
  if (formData.has('whatsapp_number')) updates.whatsapp_number = formData.get('whatsapp_number')
  if (formData.has('academic_year')) updates.academic_year = formData.get('academic_year')
  
  if (formData.has('latest_sat_rw')) {
    const rw = formData.get('latest_sat_rw')
    updates.latest_sat_rw = rw && rw !== '' ? parseInt(rw, 10) : null
  }
  if (formData.has('latest_sat_math')) {
    const math = formData.get('latest_sat_math')
    updates.latest_sat_math = math && math !== '' ? parseInt(math, 10) : null
  }
  if (formData.has('first_mock_sat_rw')) {
    const rw = formData.get('first_mock_sat_rw')
    updates.first_mock_sat_rw = rw && rw !== '' ? parseInt(rw, 10) : null
  }
  if (formData.has('first_mock_sat_math')) {
    const math = formData.get('first_mock_sat_math')
    updates.first_mock_sat_math = math && math !== '' ? parseInt(math, 10) : null
  }
  if (formData.has('weak_topics')) {
    updates.weak_topics = formData.getAll('weak_topics')
  }

  try {
    const queryPromise = supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database request timed out after 8 seconds. Please check if Supabase database columns exist.')), 8000)
    )

    const { error } = await Promise.race([queryPromise, timeoutPromise])

    if (error) return { error: error.message }

    revalidatePath('/dashboard', 'layout')
    revalidatePath('/dashboard/profile')
    return { success: 'Profile successfully updated!' }
  } catch (err) {
    return { error: err.message || 'Database connection timeout.' }
  }
}

export async function updatePassword(formData) {
  const supabase = await createClient()
  const password = formData.get('password')
  const confirm_password = formData.get('confirm_password')

  if (password !== confirm_password) {
    return { error: 'Passwords do not match' }
  }

  if (!password || password.length < 6) {
    return { error: 'Password must be at least 6 characters long' }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) return { error: error.message }

  return { success: 'Password successfully updated!' }
}

export async function resetUserProgress() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error: subErr } = await supabaseAdmin
    .from('submissions')
    .delete()
    .eq('student_id', user.id)

  if (subErr) return { error: subErr.message }

  const { error: testErr } = await supabaseAdmin
    .from('test_submissions')
    .delete()
    .eq('student_id', user.id)

  if (testErr) return { error: testErr.message }

  await supabaseAdmin
    .from('profiles')
    .update({ today_submitted: 0 })
    .eq('id', user.id)

  revalidatePath('/dashboard', 'layout')
  revalidatePath('/dashboard/history')
  revalidatePath('/dashboard/profile')
  return { success: 'Practice history wiped clean!' }
}
