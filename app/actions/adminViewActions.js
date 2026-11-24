'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function setAdminViewLevelAction(level) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data: profile } = await supabase.from('profiles').select('admin_level').eq('id', user.id).single()
    if ((profile?.admin_level || 0) < 7) {
      return { error: 'Unauthorized: Admin access required' }
    }

    const cookieStore = await cookies()
    if (level === null || level === undefined || level === 'real') {
      cookieStore.delete('admin_view_as_level')
    } else {
      cookieStore.set('admin_view_as_level', String(level), {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        httpOnly: true,
        sameSite: 'lax'
      })
    }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}
