'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const PLAN_NAMES = {
  0: 'Guest Account',
  1: 'Free Plan',
  2: 'Practice Plan',
  3: 'Practice Plan (Tester)',
  4: 'Flash Plan',
  5: 'Flash Plan (Tester)',
  6: 'Master Plan',
  7: 'Master Plan (Tester)'
}

export async function checkPendingUpgradeAction() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { pending: null }

  const authClient = await createServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user || !user.email) return { pending: null }

  const normalizedEmail = user.email.toLowerCase().trim()

  const { data: pending, error } = await supabaseAdmin
    .from('scheduled_upgrades')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (error || !pending) return { pending: null }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('user_level, full_name')
    .eq('id', user.id)
    .single()

  const currentLevel = profile?.user_level ?? 1
  const currentPlanName = PLAN_NAMES[currentLevel] || `Level ${currentLevel}`
  const targetPlanName = PLAN_NAMES[pending.target_level] || `Level ${pending.target_level}`
  const userName = pending.name || profile?.full_name || user.email.split('@')[0] || 'Student'

  return {
    pending: {
      id: pending.id,
      name: userName,
      currentPlanName,
      targetPlanName,
      targetLevel: pending.target_level,
      expiresAt: pending.expires_at
    }
  }
}

export async function claimScheduledUpgradeAction(upgradeId) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'Service role key not configured.' }
  }

  const authClient = await createServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user || !user.email) return { error: 'You must be logged in to claim an upgrade.' }

  const normalizedEmail = user.email.toLowerCase().trim()

  const { data: pending } = await supabaseAdmin
    .from('scheduled_upgrades')
    .select('*')
    .eq('id', upgradeId)
    .eq('email', normalizedEmail)
    .single()

  if (!pending) {
    return { error: 'Upgrade claim not found or expired.' }
  }

  // Update profile
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      user_level: pending.target_level,
      premium_expires_at: pending.expires_at
    })
    .eq('id', user.id)

  if (profileError) {
    return { error: profileError.message }
  }

  // Remove the trigger
  await supabaseAdmin
    .from('scheduled_upgrades')
    .delete()
    .eq('id', pending.id)

  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

export async function claimPracticePromoAction() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'Service role key not configured.' }
  }

  const authClient = await createServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user || !user.email) return { error: 'You must be logged in to claim.' }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('user_level, has_claimed_practice_promo, premium_expires_at')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'Profile not found.' }

  let isLevel1 = profile.user_level === 1
  if (profile.user_level >= 2 && profile.premium_expires_at) {
    if (new Date(profile.premium_expires_at) < new Date()) {
      isLevel1 = true
    }
  }

  if (!isLevel1) {
    return { error: 'This promotion is only available to Free Tier users.' }
  }

  if (profile.has_claimed_practice_promo) {
    return { error: 'You have already claimed this one-time promotion.' }
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 28)

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      user_level: 2,
      premium_expires_at: expiresAt.toISOString(),
      has_claimed_practice_promo: true
    })
    .eq('id', user.id)

  if (profileError) {
    return { error: profileError.message }
  }

  revalidatePath('/upgrade', 'layout')
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}
