'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { getEffectiveUserLevel } from '@/utils/getUserLevel'

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

const contentAdminClient = createClient(
  process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL,
  process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function forceChangePassword(userId, newPassword) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }

  const authClient = await createServerClient()
  const { data: { user: caller } } = await authClient.auth.getUser()
  if (!caller) return { error: 'Unauthorized: No active session' }

  const { data: callerProfile } = await supabaseAdmin.from('profiles').select('admin_level').eq('id', caller.id).single()
  const callerLevel = callerProfile?.admin_level || 0

  const { data: targetProfile } = await supabaseAdmin.from('profiles').select('admin_level').eq('id', userId).single()
  const targetLevel = targetProfile?.admin_level || 0

  if (targetLevel >= callerLevel && caller.id !== userId) {
    return { error: `⚠️ Permission Denied: You cannot reset the password of a user with an equal or higher administrative tier (Level ${targetLevel}).` }
  }

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { password: newPassword }
  )

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function deleteUserAction(userId) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }

  const authClient = await createServerClient()
  const { data: { user: caller } } = await authClient.auth.getUser()
  if (!caller) return { error: 'Unauthorized: No active session' }

  if (caller.id === userId) {
    return { error: '⚠️ You cannot delete your own administrative account.' }
  }

  const { data: callerProfile } = await supabaseAdmin.from('profiles').select('admin_level').eq('id', caller.id).single()
  const callerLevel = callerProfile?.admin_level || 0

  const { data: targetProfile } = await supabaseAdmin.from('profiles').select('admin_level').eq('id', userId).single()
  const targetLevel = targetProfile?.admin_level || 0

  if (targetLevel >= callerLevel) {
    return { error: `⚠️ Permission Denied: You cannot delete a user account with an equal or higher administrative tier (Level ${targetLevel}).` }
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) {
    return { error: error.message }
  }

  await supabaseAdmin.from('profiles').delete().eq('id', userId)
  return { success: true }
}

export async function getLightweightUsers() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, premium_expires_at, admin_level, user_level')
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export async function getUserDetails(userId) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email, institution, academic_year, whatsapp_number, created_at, premium_expires_at, admin_level, user_level, today_submitted, last_submission_date')
    .eq('id', userId)
    .single()

  if (error) {
    return { error: error.message }
  }

  // Perform Auto-Downgrade Check Server-Side
  if (data.user_level >= 2 && data.premium_expires_at) {
    if (new Date(data.premium_expires_at) < new Date()) {
      await supabaseAdmin
        .from('profiles')
        .update({ premium_expires_at: null, user_level: 1 })
        .eq('id', userId)
      
      data.premium_expires_at = null
      data.user_level = 1
    }
  }

  // Fetch practice config for limits
  const { data: config } = await supabaseAdmin.from('practice_config').select('*').single()
  data.practice_config = config || null

  return { data }
}

export async function getUserActivity(userId) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }

  // 1. Fetch Module Submissions
  const { data: modSubs, error: modErr } = await supabaseAdmin
    .from('submissions')
    .select('id, submitted_at, score_estimate, correct_count, total_questions, module_id')
    .eq('student_id', userId)

  if (modErr) return { error: modErr.message }

  // 2. Fetch Practice Test Submissions
  const { data: testSubs, error: testErr } = await supabaseAdmin
    .from('test_submissions')
    .select('id, submitted_at, rw_score_estimate, math_score_estimate, total_questions, test_id')
    .eq('student_id', userId)

  if (testErr) return { error: testErr.message }

  // 3. Resolve Module Names
  const modIds = [...new Set(modSubs.map(s => s.module_id).filter(Boolean))]
  const { data: mods } = await contentAdminClient.from('modules').select('id, module_name').in('id', modIds)
  
  const mappedModSubs = modSubs.map(s => ({
    id: s.id,
    type: 'module',
    submitted_at: s.submitted_at,
    title: mods?.find(m => m.id === s.module_id)?.module_name || 'Unknown Module',
    score_estimate: s.score_estimate,
    correct_count: s.correct_count,
    total_questions: s.total_questions,
  }))

  // 4. Resolve Test Names
  const testIds = [...new Set(testSubs.map(s => s.test_id).filter(Boolean))]
  const { data: tests } = await contentAdminClient.from('practice_tests').select('id, test_name').in('id', testIds)

  const mappedTestSubs = testSubs.map(s => {
    // Determine overall score if both exist, or fallback to individual
    const rwScore = parseInt(s.rw_score_estimate) || 0;
    const mathScore = parseInt(s.math_score_estimate) || 0;
    const totalScore = (rwScore > 0 && mathScore > 0) ? (rwScore + mathScore) : (rwScore || mathScore);

    return {
      id: s.id,
      type: 'test',
      submitted_at: s.submitted_at,
      title: tests?.find(t => t.id === s.test_id)?.test_name || 'Unknown Practice Test',
      score_estimate: totalScore,
      correct_count: null, // Full tests don't easily sum correct_count across modules here
      total_questions: s.total_questions,
      rw_score: rwScore,
      math_score: mathScore
    }
  })

  // 5. Merge and Sort chronologically (newest first)
  const combinedData = [...mappedModSubs, ...mappedTestSubs].sort((a, b) => {
    return new Date(b.submitted_at) - new Date(a.submitted_at);
  })

  return { data: combinedData }
}

export async function updateUserPlan(userId, isPremium, expiresAt = null) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ premium_expires_at: expiresAt, user_level: isPremium ? 6 : 1 })
    .eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function updateUserLevelsAction(userId, adminLevel, userLevel, expiresAt = null) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }

  const authClient = await createServerClient()
  const { data: { user: caller } } = await authClient.auth.getUser()
  if (!caller) return { error: 'Unauthorized: No active session' }

  const { data: callerProfile } = await supabaseAdmin.from('profiles').select('admin_level').eq('id', caller.id).single()
  const callerAdminLevel = callerProfile?.admin_level || 0

  const { data: targetProfile } = await supabaseAdmin.from('profiles').select('admin_level').eq('id', userId).single()
  const targetAdminLevel = targetProfile?.admin_level || 0

  const numAdmin = parseInt(adminLevel, 10) || 1
  const numUser = parseInt(userLevel, 10) || 1

  // Strict Owner Security: Only Owner (Level 9) can assign, modify, or revoke Admin roles
  if (numAdmin !== targetAdminLevel || targetAdminLevel >= 7) {
    if (callerAdminLevel < 9 && caller.id !== userId) {
      return { error: '⚠️ Only the Owner (Level 9) can assign or modify Administrative roles.' }
    }
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ 
      admin_level: numAdmin, 
      user_level: numUser, 
      premium_expires_at: numUser >= 2 ? expiresAt : null 
    })
    .eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

const DEFAULT_TOOLS = [
  { tool_id: 'users', tool_name: 'User Management', min_admin_level: 7 },
  { tool_id: 'classes', tool_name: 'Class Packages Management', min_admin_level: 7 },
  { tool_id: 'question-bank', tool_name: 'Question Bank & Modules CMS', min_admin_level: 8 },
  { tool_id: 'module-builder', tool_name: 'Standalone Module Builder', min_admin_level: 7 },
  { tool_id: 'test-builder', tool_name: 'Full Practice Test Builder', min_admin_level: 7 },
  { tool_id: 'bulk-uploader', tool_name: 'Bulk JSON Question Uploader', min_admin_level: 8 },
  { tool_id: 'directory-manager', tool_name: 'Directory Manager', min_admin_level: 7 },
  { tool_id: 'hash-rehash', tool_name: 'Hash Rehasher Engine', min_admin_level: 9 },
  { tool_id: 'scheduled-upgrades', tool_name: 'Bulk Scheduled Auto-Trigger Upgrades', min_admin_level: 7 },
  { tool_id: 'analytics', tool_name: 'Cyberpunk Analytics & Bug Triage Room', min_admin_level: 8 },
  { tool_id: 'bug-reports', tool_name: 'Bug Reports & Triage Command Center', min_admin_level: 7 }
]

export async function getToolPermissionsAction() {
  const { data, error } = await supabaseAdmin
    .from('admin_tool_permissions')
    .select('*')
    .order('tool_id', { ascending: true })
  
  if (error) return { error: error.message }

  const existingMap = new Set((data || []).map(t => t.tool_id))
  const missing = DEFAULT_TOOLS.filter(t => !existingMap.has(t.tool_id))

  if (missing.length > 0) {
    await supabaseAdmin.from('admin_tool_permissions').upsert(missing, { onConflict: 'tool_id' })
    const { data: updated } = await supabaseAdmin
      .from('admin_tool_permissions')
      .select('*')
      .order('tool_id', { ascending: true })
    return { data: updated || data }
  }

  return { data }
}

export async function updateToolPermissionsAction(permissionsArray) {
  const authClient = await createServerClient()
  const { data: { user: caller } } = await authClient.auth.getUser()
  if (!caller) return { error: 'Unauthorized' }

  const { data: callerProfile } = await supabaseAdmin.from('profiles').select('admin_level').eq('id', caller.id).single()
  if (!callerProfile || callerProfile.admin_level < 9) {
    return { error: '⚠️ Only the Owner (Level 9) can modify control room tool permissions.' }
  }

  for (const item of permissionsArray) {
    const { error } = await supabaseAdmin
      .from('admin_tool_permissions')
      .update({ min_admin_level: parseInt(item.min_admin_level, 10) || 7 })
      .eq('tool_id', item.tool_id)
    if (error) return { error: error.message }
  }

  return { success: true }
}

export async function deleteQuestionsAction(qidsArray) {
  if (!process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'CONTENT_SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }

  if (!qidsArray || qidsArray.length === 0) {
    return { error: 'No questions provided for deletion.' }
  }

  const chunkSize = 100;
  for (let i = 0; i < qidsArray.length; i += chunkSize) {
    const chunk = qidsArray.slice(i, i + chunkSize);
    const { error } = await contentAdminClient
      .from('questions')
      .delete()
      .in('qid', chunk);

    if (error) {
      return { error: error.message };
    }
  }

  return { success: true }
}

export async function verifyToolAccessAction(toolId) {
  const authClient = await createServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { authorized: false, level: 0, minReq: 9, reason: 'Unauthenticated' }

  const { data: profile } = await supabaseAdmin.from('profiles').select('admin_level').eq('id', user.id).single()
  const adminLevel = profile?.admin_level || 0

  const { data: perm } = await supabaseAdmin.from('admin_tool_permissions').select('min_admin_level').eq('tool_id', toolId).single()
  let minReq = perm?.min_admin_level

  if (minReq === undefined || minReq === null) {
    const defaultEntry = DEFAULT_TOOLS.find(t => t.tool_id === toolId)
    minReq = defaultEntry ? defaultEntry.min_admin_level : 7
  }

  if (adminLevel < minReq) {
    return { authorized: false, level: adminLevel, minReq, reason: `Requires Level ${minReq}` }
  }

  return { authorized: true, level: adminLevel, minReq }
}

export async function getSiteFeatureTogglesAction() {
  const { data, error } = await supabaseAdmin
    .from('site_feature_toggles')
    .select('*')
    .order('feature_id', { ascending: true })

  if (error) return { error: error.message }
  return { data }
}

export async function updateSiteFeatureToggleAction(featureId, isEnabled) {
  const authClient = await createServerClient()
  const { data: { user: caller } } = await authClient.auth.getUser()
  if (!caller) return { error: 'Unauthorized' }

  const { data: callerProfile } = await supabaseAdmin.from('profiles').select('admin_level').eq('id', caller.id).single()
  if (!callerProfile || callerProfile.admin_level < 9) {
    return { error: '⚠️ Only the Owner (Level 9) can modify website feature toggles.' }
  }

  const { error } = await supabaseAdmin
    .from('site_feature_toggles')
    .update({ is_enabled: isEnabled, updated_at: new Date().toISOString() })
    .eq('feature_id', featureId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function verifyFeatureAccessAction(featureId) {
  const authClient = await createServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  
  let adminLevel = 0
  let isOverride = false
  if (user) {
    const { data: profile } = await supabaseAdmin.from('profiles').select('admin_level, user_level, premium_expires_at').eq('id', user.id).single()
    adminLevel = profile?.admin_level || 0
    const eff = await getEffectiveUserLevel(profile)
    isOverride = eff.isOverride || false
  }

  const { data: toggle } = await supabaseAdmin.from('site_feature_toggles').select('*').eq('feature_id', featureId).single()
  if (!toggle || toggle.is_enabled !== false) {
    return { authorized: true, isAdminBypass: false, adminLevel }
  }

  // Admins (Level 7+) bypass maintenance lock screens when section is locked (unless Admin View override is active)
  if (adminLevel >= 7 && !isOverride) {
    return { authorized: true, isAdminBypass: true, adminLevel }
  }

  return { 
    authorized: false, 
    isAdminBypass: false, 
    adminLevel, 
    featureName: toggle.feature_name,
    message: toggle.maintenance_message 
  }
}
