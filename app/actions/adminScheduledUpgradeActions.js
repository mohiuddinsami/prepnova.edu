'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'

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

async function verifyAdminCaller() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }
  }
  const authClient = await createServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { error: 'Unauthorized: No session found.' }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('admin_level')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.admin_level || 0) < 7) {
    return { error: 'Permission Denied: Requires Admin Level 7+.' }
  }
  return { caller: user }
}

export async function createScheduledUpgradesAction(records, targetLevel, expiresAt) {
  const authCheck = await verifyAdminCaller()
  if (authCheck.error) return { error: authCheck.error }

  if (!Array.isArray(records) || records.length === 0) {
    return { error: 'No user records provided.' }
  }

  const rowsToInsert = records.map(r => ({
    email: String(r.email || '').toLowerCase().trim(),
    name: String(r.name || '').trim() || 'Student',
    target_level: parseInt(targetLevel, 10) || 6,
    expires_at: new Date(expiresAt).toISOString()
  })).filter(r => r.email.includes('@'))

  if (rowsToInsert.length === 0) {
    return { error: 'No valid email records found in upload.' }
  }

  // Check if table exists / insert
  const { data, error } = await supabaseAdmin
    .from('scheduled_upgrades')
    .upsert(rowsToInsert, { onConflict: 'email' })
    .select()

  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return { 
        error: `Database table 'scheduled_upgrades' does not exist yet. Please run this SQL in your Supabase SQL Editor:\n\nCREATE TABLE IF NOT EXISTS scheduled_upgrades (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  email TEXT UNIQUE NOT NULL,\n  name TEXT,\n  target_level INT NOT NULL DEFAULT 6,\n  expires_at TIMESTAMPTZ NOT NULL,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);`
      }
    }
    return { error: error.message }
  }

  return { success: true, count: rowsToInsert.length }
}

export async function getScheduledUpgradesAction() {
  const authCheck = await verifyAdminCaller()
  if (authCheck.error) return { error: authCheck.error }

  const { data, error } = await supabaseAdmin
    .from('scheduled_upgrades')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return { data: [], missingTable: true }
    }
    return { error: error.message }
  }

  return { data: data || [] }
}

export async function deleteScheduledUpgradeAction(id) {
  const authCheck = await verifyAdminCaller()
  if (authCheck.error) return { error: authCheck.error }

  const { error } = await supabaseAdmin
    .from('scheduled_upgrades')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateScheduledUpgradeAction(id, updates) {
  const authCheck = await verifyAdminCaller()
  if (authCheck.error) return { error: authCheck.error }

  const payload = {}
  if (updates.name !== undefined) payload.name = String(updates.name).trim()
  if (updates.target_level !== undefined) payload.target_level = parseInt(updates.target_level, 10) || 6
  if (updates.expires_at !== undefined) payload.expires_at = new Date(updates.expires_at).toISOString()

  const { error } = await supabaseAdmin
    .from('scheduled_upgrades')
    .update(payload)
    .eq('id', id)

  if (error) return { error: error.message }
  return { success: true }
}
