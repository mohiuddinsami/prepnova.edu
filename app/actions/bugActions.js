'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { getEffectiveUserLevel } from '@/utils/getUserLevel'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

/**
 * Creates a bug report in Project A (User DB) with automated diagnostic context and up to 2000 chars of explanation.
 */
export async function createBugReportAction(payload) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set.' }
  }

  const {
    bugType = 'other',
    category = 'Other General / Platform Issue',
    description = '',
    currentUrl = '',
    routePath = '',
    targetQuestionId = null,
    targetModuleId = null,
    targetTestId = null,
    targetResourceTitle = null,
    questionIndex = null,
    clientErrors = [],
    userAgent = '',
    deviceInfo = {}
  } = payload || {}

  const validBugTypes = ['question', 'page', 'other', 'class']
  const normalizedBugType = validBugTypes.includes(bugType) ? bugType : 'other'

  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    return { error: 'Please enter a description explaining the issue.' }
  }

  if (description.length > 2000) {
    return { error: 'Description exceeds maximum allowed limit of 2000 characters.' }
  }

  // Smart Priority Calculation based on domain and severity of category
  let priority = 'medium'
  if (
    category.includes('Wrong Answer Key') ||
    category.includes('System Freeze') ||
    category.includes('Fatal Crash') ||
    category.includes('Submission Failed')
  ) {
    priority = 'critical'
  } else if (
    normalizedBugType === 'question' && (
      category.includes('Math LaTeX') ||
      category.includes('Context / Passage Text Broken') ||
      category.includes('Image / Figure / Graph Missing')
    )
  ) {
    priority = 'high'
  } else if (category.includes('Typo') || category.includes('Feature Request')) {
    priority = 'low'
  }

  // Get user session and verify eligibility (logged in & not banned/user_level === 0)
  let userId = null
  let reporterEmail = null
  let userTier = 'free'

  try {
    const authClient = await createServerClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return { error: '⚠️ You must be registered and logged in to submit a bug report.' }
    }

    userId = user.id
    reporterEmail = user.email || 'user@prepnova.edu'

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('user_level, admin_level, premium_expires_at')
      .eq('id', user.id)
      .single()

    if (!profile || profile.user_level === 0) {
      return { error: '⚠️ Your account is restricted (User Level 0). You are not permitted to submit bug reports.' }
    }

    if (profile.admin_level >= 7) {
      userTier = 'admin'
    } else {
      const eff = await getEffectiveUserLevel(profile)
      if (eff.effectiveUserLevel >= 6) userTier = 'master'
      else if (eff.effectiveUserLevel >= 3) userTier = 'pro'
      else if (eff.effectiveUserLevel >= 2) userTier = 'starter'
      else userTier = 'free'
    }
  } catch (err) {
    console.error('Bug report auth error:', err.message)
    return { error: '⚠️ Authentication failed. Please log in again to report a bug.' }
  }

  const enhancedDescription = targetResourceTitle
    ? `[Target Resource: ${targetResourceTitle}]\n\n${description}`
    : description

  const { data, error } = await supabaseAdmin
    .from('bug_reports')
    .insert({
      user_id: userId,
      user_tier: userTier,
      reporter_email: reporterEmail,
      bug_type: normalizedBugType,
      category,
      description: enhancedDescription.slice(0, 2000),
      status: 'open',
      priority,
      current_url: currentUrl,
      route_path: routePath,
      target_question_id: targetQuestionId,
      target_module_id: targetModuleId,
      target_test_id: targetTestId,
      question_index: questionIndex,
      user_agent: userAgent,
      device_info: {
        ...deviceInfo,
        target_resource_title: targetResourceTitle || null
      },
      client_errors: Array.isArray(clientErrors) ? clientErrors.slice(0, 10) : [],
      created_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (error) {
    console.error('Insert bug report error:', error)
    return { error: `Failed to submit bug report: ${error.message}` }
  }

  return { success: true, id: data?.id }
}

/**
 * Fetches bug reports for the Cyberpunk Triage Command Center (`/admin/analytics`).
 */
export async function fetchBugReportsAction(filters = {}) {
  const authClient = await createServerClient()
  const { data: { user: caller } } = await authClient.auth.getUser()
  if (!caller) return { error: 'Unauthorized' }

  const { data: profile } = await supabaseAdmin.from('profiles').select('admin_level').eq('id', caller.id).single()
  if (!profile || profile.admin_level < 7) {
    return { error: '⚠️ Administrative clearance Level 7+ required to view bug triage lists.' }
  }

  let query = supabaseAdmin
    .from('bug_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (filters.bugType && filters.bugType !== 'all') {
    query = query.eq('bug_type', filters.bugType)
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }
  if (filters.priority && filters.priority !== 'all') {
    query = query.eq('priority', filters.priority)
  }
  if (filters.category && filters.category !== 'all') {
    query = query.eq('category', filters.category)
  }

  const { data, error } = await query
  if (error) return { error: error.message }

  return { success: true, data: data || [] }
}

/**
 * Updates status or admin notes on a bug report.
 */
export async function updateBugStatusAction(bugId, newStatus, adminNotes = null) {
  const authClient = await createServerClient()
  const { data: { user: caller } } = await authClient.auth.getUser()
  if (!caller) return { error: 'Unauthorized' }

  const { data: profile } = await supabaseAdmin.from('profiles').select('admin_level').eq('id', caller.id).single()
  if (!profile || profile.admin_level < 7) {
    return { error: '⚠️ Administrative clearance Level 7+ required to modify bug triage status.' }
  }

  const payload = {
    status: newStatus,
    resolved_by: caller.id,
    resolved_at: newStatus === 'resolved' || newStatus === 'dismissed' ? new Date().toISOString() : null
  }

  if (adminNotes !== null) {
    payload.admin_notes = adminNotes
  }

  const { error } = await supabaseAdmin
    .from('bug_reports')
    .update(payload)
    .eq('id', bugId)

  if (error) return { error: error.message }
  return { success: true }
}

/**
 * Permanently deletes a single bug report by ID (Requires Level 7+ clearance).
 */
export async function deleteBugReportAction(bugId) {
  if (!bugId) return { error: 'Bug report ID is required.' }

  const authClient = await createServerClient()
  const { data: { user: caller } } = await authClient.auth.getUser()
  if (!caller) return { error: 'Unauthorized' }

  const { data: profile } = await supabaseAdmin.from('profiles').select('admin_level').eq('id', caller.id).single()
  if (!profile || profile.admin_level < 7) {
    return { error: '⚠️ Administrative clearance Level 7+ required to delete bug reports.' }
  }

  const { error } = await supabaseAdmin
    .from('bug_reports')
    .delete()
    .eq('id', bugId)

  if (error) return { error: error.message }
  return { success: true }
}

/**
 * Permanently deletes multiple bug reports by ID array (Requires Level 7+ clearance).
 */
export async function deleteBulkBugReportsAction(bugIds = []) {
  if (!Array.isArray(bugIds) || bugIds.length === 0) {
    return { error: 'No bug report IDs specified for deletion.' }
  }

  const authClient = await createServerClient()
  const { data: { user: caller } } = await authClient.auth.getUser()
  if (!caller) return { error: 'Unauthorized' }

  const { data: profile } = await supabaseAdmin.from('profiles').select('admin_level').eq('id', caller.id).single()
  if (!profile || profile.admin_level < 7) {
    return { error: '⚠️ Administrative clearance Level 7+ required to delete bug reports.' }
  }

  const { error } = await supabaseAdmin
    .from('bug_reports')
    .delete()
    .in('id', bugIds)

  if (error) return { error: error.message }
  return { success: true }
}

