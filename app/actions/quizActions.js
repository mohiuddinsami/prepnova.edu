'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { recordItemAttemptO1Action, recordBatchAttemptsO1Action } from '@/app/actions/difficultyEngineActions'

// Secure Admin Client for User DB (Profiles & Submissions)
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

// Secure Admin Client for Content DB (Questions & Modules CMS)
const contentAdminClient = createAdminClient(
  process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL,
  process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function getSecureQuizDataAction(moduleId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: "LOGIN_REQUIRED" }
  }

  // Fetch Profile using Admin Client (User DB)
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('premium_expires_at, user_level, admin_level')
    .eq('id', user.id)
    .single()

  // Fetch Module using Content Admin Client (Content DB)
  const { data: mod } = await contentAdminClient
    .from('modules')
    .select('*')
    .eq('id', moduleId)
    .single()

  if (!mod) {
    return { error: "MODULE_NOT_FOUND" }
  }

  let userLevel = profile?.user_level || 1
  const adminLevel = profile?.admin_level || 0

  if (userLevel >= 2 && profile?.premium_expires_at) {
    if (new Date(profile.premium_expires_at) < new Date()) {
      userLevel = 1
    }
  }

  const reqLevel = mod.required_level || 1

  if (userLevel < reqLevel && adminLevel < 7) {
    return { error: "PREMIUM_REQUIRED" }
  }

  // The Fetch: Securely get questions from Content DB
  if (!mod.question_ids || mod.question_ids.length === 0) {
    return { moduleData: mod, questions: [] }
  }

  const { data: qs } = await contentAdminClient
    .from('questions')
    .select('*')
    .in('qid', mod.question_ids)

  const orderedQs = mod.question_ids.map(id => qs.find(q => q.qid === id)).filter(Boolean)

  return { moduleData: mod, questions: orderedQs }
}

export async function submitQuizAction(submissionData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: { message: "Not authenticated" } }
  }

  // 1. Fetch Profile using Admin Client
  const { data: profile, error: profileFetchErr } = await supabaseAdmin
    .from('profiles')
    .select('today_submitted, last_submission_date, user_level, admin_level')
    .eq('id', user.id)
    .single()

  if (profileFetchErr) {
    return { error: { message: "Failed to fetch profile data" } }
  }

  const userLevel = profile?.user_level || 1
  const adminLevel = profile?.admin_level || 0

  // 2. Perform Rate Limiting for Basic Free Users (Level 1)
  if (userLevel < 2 && adminLevel < 7) {
    const now = new Date()
    const utcNow = now.getTime() + (now.getTimezoneOffset() * 60000)
    const bstNow = new Date(utcNow + (3600000 * 6))
    const bstTodayString = bstNow.toDateString()

    let todaySubmitted = profile?.today_submitted || 0
    let lastDateString = null

    if (profile?.last_submission_date) {
      const lastDate = new Date(profile.last_submission_date)
      const utcLast = lastDate.getTime() + (lastDate.getTimezoneOffset() * 60000)
      const bstLast = new Date(utcLast + (3600000 * 6))
      lastDateString = bstLast.toDateString()
    }

    if (lastDateString !== bstTodayString) {
      todaySubmitted = 0 // Reset if it's a new day
    }

    if (todaySubmitted >= 5) {
      return { 
        error: { 
          message: "Daily Limit Reached: Free users can only submit 5 modules per day. Please upgrade to Premium for unlimited practice.",
          isRateLimit: true
        } 
      }
    }
    
    // Update profile securely
    const { error: profileErr } = await supabaseAdmin.from('profiles').update({ 
      today_submitted: todaySubmitted + 1,
      last_submission_date: new Date().toISOString()
    }).eq('id', user.id)

    if (profileErr) {
      return { error: { message: "Security Error: Could not update rate limit counter in database." } }
    }
  }

  // 3. Insert Submission
  const submission = {
    student_id: user.id,
    ...submissionData
  }

  const { error: insertError } = await supabaseAdmin.from('submissions').insert([submission])
  
  if (insertError) {
    return { error: insertError }
  }

  // Asynchronously record item difficulty attempts for O(1) rating engine
  if (submissionData?.student_answers && Object.keys(submissionData.student_answers).length > 0) {
    const qids = Object.keys(submissionData.student_answers)
    contentAdminClient.from('questions').select('qid, correct_answer, question_type, subject_tag').in('qid', qids).then(({ data: qs }) => {
      if (!qs || qs.length === 0) return
      const attempts = []
      for (const q of qs) {
        const sa = submissionData.student_answers[q.qid]
        if (sa === undefined || sa === null || String(sa).trim() === '') continue

        let isCorrect = false
        const qType = (q.question_type || 'MCQ').toUpperCase()
        if (qType === 'SPR') {
          const possible = String(q.correct_answer || '').split('||')
          isCorrect = possible.some(ans => String(sa).trim() === String(ans).trim() || Math.abs(parseFloat(sa) - parseFloat(ans)) < 0.01)
        } else {
          isCorrect = sa === q.correct_answer
        }
        attempts.push({
          qid: q.qid,
          isCorrect,
          subjectTag: q.subject_tag || 'MATH'
        })
      }
      if (attempts.length > 0) {
        recordBatchAttemptsO1Action({ attempts }).catch(err => console.error('Error recording batch quiz O(1) telemetry:', err))
      }
    }).catch(err => console.error('Error in quiz O(1) telemetry:', err))
  }

  return { success: true }
}
