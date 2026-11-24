'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'

// Secure Admin Client for User DB (Profiles & Submissions)
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Secure Admin Client for Content DB (Questions & Modules CMS)
const contentAdminClient = createAdminClient(
  process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL || '',
  process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

/**
 * Fetches all question metadata for a given subject (to power the dashboard filters)
 * and merges it with the user's question_attempts from their profile.
 * @param {string} subjectTag - 'READING_WRITING' or 'MATH'
 * @returns {Promise<{success: boolean, questions?: Array, userAttempts?: Object, error?: string}>}
 */
export async function getPracticeDashboardMetadataAction(subjectTag) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // 1. Fetch user's question attempts
    const { data: profile, error: profError } = await supabaseAdmin
      .from('profiles')
      .select('question_attempts')
      .eq('id', user.id)
      .single()

    if (profError) {
      console.error('Failed to fetch profile for practice dashboard:', profError)
      return { success: false, error: 'Database error fetching profile.' }
    }

    const userAttempts = profile?.question_attempts || {}

    // Fetch practice config to know which sources are allowed
    const { data: config, error: configError } = await supabaseAdmin
      .from('practice_config')
      .select('allowed_sources')
      .eq('id', 1)
      .single()

    if (configError && configError.code !== 'PGRST116') {
      console.error('Failed to fetch practice_config in dashboard metadata:', configError)
    }

    let allowedSources = config?.allowed_sources || []
    
    // Safety check in case it's a stringified JSON
    if (typeof allowedSources === 'string') {
      try { allowedSources = JSON.parse(allowedSources) } catch(e) {}
    }

    // 2. Fetch all questions for this subject (just the metadata needed for filtering)
    let query = contentAdminClient
      .from('questions')
      .select('qid, topic_tag, difficulty, question_source')
      .eq('subject_tag', subjectTag)

    if (allowedSources.length > 0) {
      query = query.in('question_source', allowedSources)
    } else {
      // If configured to empty, return empty list
      return { success: true, questions: [], userAttempts }
    }

    const { data: questions, error: qError } = await query

    if (qError) {
      console.error('Failed to fetch questions for practice dashboard:', qError)
      return { success: false, error: 'Database error fetching questions.' }
    }

    const debugInfo = `allowedSources: ${JSON.stringify(allowedSources)}, subjectTag: ${subjectTag}, questionsCount: ${questions?.length || 0}`;
    
    // Return the stripped down metadata
    return {
      success: true,
      questions: questions || [],
      userAttempts,
      debugInfo
    }

  } catch (error) {
    console.error('getPracticeDashboardMetadataAction error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Fetches the full question data for the selected practice QIDs.
 * @param {Array<string>} qids - Array of question IDs to fetch
 * @returns {Promise<{success: boolean, questions?: Array, error?: string}>}
 */
export async function fetchPracticeQuestionsAction(qids) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    if (!qids || qids.length === 0) {
       return { success: true, questions: [] }
    }

    // 1. Fetch user profile and limits
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('today_submitted, last_submission_date, user_level, admin_level')
      .eq('id', user.id)
      .single()

    const { data: config } = await supabaseAdmin
      .from('practice_config')
      .select('level_1_limit, level_2_limit, level_3_limit, level_4_limit, level_5_limit, level_6_limit')
      .eq('id', 1)
      .single()

    const userLevel = profile?.user_level || 1
    const adminLevel = profile?.admin_level || 0

    let limit = -1
    if (adminLevel < 7) {
      if (userLevel === 1) limit = config?.level_1_limit ?? 10
      else if (userLevel === 2) limit = config?.level_2_limit ?? 100
      else if (userLevel === 3) limit = config?.level_3_limit ?? -1
      else if (userLevel === 4) limit = config?.level_4_limit ?? -1
      else if (userLevel === 5) limit = config?.level_5_limit ?? -1
      else if (userLevel >= 6) limit = config?.level_6_limit ?? -1
    }

    let todaySubmitted = profile?.today_submitted || 0
    let processedQids = qids

    // 2. Enforce Quota
    if (limit !== -1) {
      const now = new Date()
      const utcNow = now.getTime() + (now.getTimezoneOffset() * 60000)
      const bstNow = new Date(utcNow + (3600000 * 6))
      const bstTodayString = bstNow.toDateString()

      let lastDateString = null
      if (profile?.last_submission_date) {
        const lastDate = new Date(profile.last_submission_date)
        const utcLast = lastDate.getTime() + (lastDate.getTimezoneOffset() * 60000)
        const bstLast = new Date(utcLast + (3600000 * 6))
        lastDateString = bstLast.toDateString()
      }

      if (lastDateString !== bstTodayString) {
        todaySubmitted = 0 // Reset if new day
      }

      const remainingQuota = Math.max(0, limit - todaySubmitted)

      if (remainingQuota === 0) {
        return { success: false, error: 'Daily practice limit reached. Please upgrade to continue practicing.' }
      }

      if (processedQids.length > remainingQuota) {
        processedQids = processedQids.slice(0, remainingQuota)
      }
    }

    // 3. Fetch questions
    const { data: questions, error: qError } = await contentAdminClient
      .from('questions')
      .select('*')
      .in('qid', processedQids)

    if (qError) {
      console.error('Failed to fetch practice questions:', qError)
      return { success: false, error: 'Database error fetching question details.' }
    }

    // 4. Irreversible Deduction
    if (limit !== -1 && questions && questions.length > 0) {
      await supabaseAdmin.from('profiles').update({
        today_submitted: todaySubmitted + questions.length,
        last_submission_date: new Date().toISOString()
      }).eq('id', user.id)
    }

    return {
      success: true,
      questions: questions || []
    }

  } catch (error) {
    console.error('fetchPracticeQuestionsAction error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Fetches the current practice configuration (Admin).
 * @returns {Promise<{success: boolean, allowedSources?: string[], error?: string}>}
 */
export async function getPracticeConfigAction() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Unauthorized' }

    // Check admin level
    const { data: profile } = await supabaseAdmin.from('profiles').select('admin_level').eq('id', user.id).single()
    if (!profile || profile.admin_level < 7) {
      return { success: false, error: 'Forbidden' }
    }

    const { data: config, error } = await supabaseAdmin
      .from('practice_config')
      .select('allowed_sources, level_1_limit, level_2_limit, level_3_limit, level_4_limit, level_5_limit, level_6_limit')
      .eq('id', 1)
      .single()

    if (error && !['PGRST116', '42P01', 'PGRST204', '42703', 'PGRST205'].includes(error.code)) {
      console.error('Failed to fetch practice config:', JSON.stringify(error, null, 2))
      return { success: false, error: 'Database error: ' + (error.message || error.code) }
    }

    return { success: true, config: config || { allowed_sources: [] } }

  } catch (error) {
    console.error('getPracticeConfigAction error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Updates the practice configuration (Admin).
 * @param {Object} configData - Contains allowed_sources and limits
 */
export async function updatePracticeConfigAction(configData) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Unauthorized' }

    // Check admin level
    const { data: profile } = await supabaseAdmin.from('profiles').select('admin_level').eq('id', user.id).single()
    if (!profile || profile.admin_level < 7) {
      return { success: false, error: 'Forbidden' }
    }

    const { error } = await supabaseAdmin
      .from('practice_config')
      .upsert({ 
        id: 1, 
        allowed_sources: configData.allowed_sources || [],
        level_1_limit: configData.level_1_limit ?? 10,
        level_2_limit: configData.level_2_limit ?? 100,
        level_3_limit: configData.level_3_limit ?? -1,
        level_4_limit: configData.level_4_limit ?? -1,
        level_5_limit: configData.level_5_limit ?? -1,
        level_6_limit: configData.level_6_limit ?? -1
      })

    if (error) {
      console.error('Failed to update practice config:', error)
      return { success: false, error: 'Database error' }
    }

    return { success: true }

  } catch (error) {
    console.error('updatePracticeConfigAction error:', error)
    return { success: false, error: error.message }
  }
}
