'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { recordItemAttemptO1Action, recordBatchAttemptsO1Action } from '@/app/actions/difficultyEngineActions'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const contentAdminClient = createAdminClient(
  process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL,
  process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// --- Grading Helpers (server-side, mirroring quiz page logic) ---

function parseSprValue(inputStr) {
  if (!inputStr) return null
  const cleanStr = String(inputStr).trim()
  if (cleanStr.includes('/')) {
    const [num, den] = cleanStr.split('/')
    return parseFloat(num) / parseFloat(den)
  }
  return parseFloat(cleanStr)
}

function gradeSpr(studentInput, dbAnswer) {
  if (String(studentInput).trim() === String(dbAnswer).trim()) return true
  const sv = parseSprValue(studentInput)
  const cv = parseSprValue(dbAnswer)
  if (isNaN(sv) || isNaN(cv)) return false
  return Math.abs(sv - cv) < (cv >= 0 ? 0.001 : 0.01)
}

function checkMultipleSprs(studentInput, dbAnswer) {
  if (!dbAnswer) return false
  return String(dbAnswer).split('||').some(ans => gradeSpr(studentInput, ans))
}

function gradeAnswers(questions, answers) {
  let correct = 0
  questions.forEach(q => {
    const sa = answers[q.qid]
    if (!sa) return
    const qType = (q.question_type || 'MCQ').toUpperCase()
    if (qType === 'SPR') {
      if (checkMultipleSprs(sa, q.correct_answer)) correct++
    } else {
      if (sa === q.correct_answer) correct++
    }
  })
  return { correct, total: questions.length }
}

async function fetchModuleQuestions(moduleId) {
  const { data: mod } = await contentAdminClient.from('modules').select('*').eq('id', moduleId).single()
  if (!mod || !mod.question_ids?.length) return { moduleData: mod, questions: [] }
  const { data: qs } = await contentAdminClient.from('questions').select('*').in('qid', mod.question_ids)
  const ordered = mod.question_ids.map(id => qs.find(q => q.qid === id)).filter(Boolean)
  return { moduleData: mod, questions: ordered }
}

// --- Server Actions ---

export async function getTestInfoAction(testId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'LOGIN_REQUIRED' }
  const { data: profile } = await supabaseAdmin.from('profiles').select('user_level, admin_level, premium_expires_at').eq('id', user.id).single()
  const { data: test } = await contentAdminClient.from('practice_tests').select('id, test_name, test_type, subject_order, required_level').eq('id', testId).single()
  if (!test) return { error: 'TEST_NOT_FOUND' }

  let userLevel = profile?.user_level || 1
  const adminLevel = profile?.admin_level || 0
  if (userLevel >= 2 && profile?.premium_expires_at && new Date(profile.premium_expires_at) < new Date()) userLevel = 1
  const reqLevel = test.required_level || 1

  if (userLevel < reqLevel && adminLevel < 7) {
    return { error: `You do not have access to this test. Upgrade to unlock this test!` }
  }

  return { test, isAdminOrMod: adminLevel >= 7 }
}

export async function startTestAction(testId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'LOGIN_REQUIRED' }
  const { data: profile } = await supabaseAdmin.from('profiles').select('premium_expires_at, user_level, admin_level').eq('id', user.id).single()
  const { data: test } = await contentAdminClient.from('practice_tests').select('*').eq('id', testId).single()
  if (!test) return { error: 'TEST_NOT_FOUND' }

  let userLevel = profile?.user_level || 1
  const adminLevel = profile?.admin_level || 0
  if (userLevel >= 2 && profile?.premium_expires_at && new Date(profile.premium_expires_at) < new Date()) userLevel = 1
  const reqLevel = test.required_level || 1

  if (userLevel < reqLevel && adminLevel < 7) {
    return { error: 'PREMIUM_REQUIRED' }
  }

  // Determine first subject
  const subjects = test.test_type === 'BOTH' ? (test.subject_order || ['READING_WRITING', 'MATH']) :
    test.test_type === 'READING_WRITING' ? ['READING_WRITING'] : ['MATH']
  const firstSubject = subjects[0]
  const prefix = firstSubject === 'READING_WRITING' ? 'rw' : 'math'
  const baseModuleId = test[`${prefix}_base_module_id`]

  if (!baseModuleId) return { error: 'TEST_CONFIG_INVALID' }

  const { moduleData, questions } = await fetchModuleQuestions(baseModuleId)
  if (!moduleData) return { error: 'MODULE_NOT_FOUND' }

  let category = 'free'
  if (profile?.admin_level >= 7 || userLevel === 6) category = 'master'
  else if (userLevel === 4) category = 'flash'
  else if (userLevel === 2) category = 'practice'

  try {
    await contentAdminClient.rpc('increment_content_analytics', {
      p_table: 'practice_tests',
      p_id: test.id,
      p_metric: `${category}_started`,
      p_delta: 1
    })
  } catch (rpcErr) {
    console.error('Failed to increment practice_tests start telemetry on server:', rpcErr)
  }

  return {
    testInfo: { id: test.id, test_name: test.test_name, test_type: test.test_type, subject_order: subjects, required_level: test.required_level },
    subject: firstSubject,
    phaseType: 'base',
    moduleData,
    questions,
    isAdminOrMod: adminLevel >= 7
  }
}

export async function submitModuleAndRouteAction({ testId, subject, phase, answers, moduleId, forceMode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'LOGIN_REQUIRED' }
  const { data: profile } = await supabaseAdmin.from('profiles').select('user_level, admin_level, premium_expires_at').eq('id', user.id).single()
  const { data: test } = await contentAdminClient.from('practice_tests').select('*').eq('id', testId).single()
  if (!test) return { error: 'TEST_NOT_FOUND' }

  let userLevel = profile?.user_level || 1
  const adminLevel = profile?.admin_level || 0
  if (userLevel >= 2 && profile?.premium_expires_at && new Date(profile.premium_expires_at) < new Date()) userLevel = 1
  const reqLevel = test.required_level || 1

  if (userLevel < reqLevel && adminLevel < 7) {
    return { error: 'PREMIUM_REQUIRED' }
  }

  // Grade the submitted module server-side
  const { moduleData: submittedModule, questions } = await fetchModuleQuestions(moduleId)
  if (!submittedModule) return { error: 'MODULE_NOT_FOUND' }
  const grade = gradeAnswers(questions, answers || {})

  // Asynchronously record item difficulty attempts for O(1) rating engine in one atomic batch
  if (questions && questions.length > 0) {
    const attempts = []
    for (const q of questions) {
      const sa = (answers || {})[q.qid]
      if (sa === undefined || sa === null || String(sa).trim() === '') continue

      let isCorrect = false
      const qType = (q.question_type || 'MCQ').toUpperCase()
      if (qType === 'SPR') {
        isCorrect = checkMultipleSprs(sa, q.correct_answer)
      } else {
        isCorrect = sa === q.correct_answer
      }
      attempts.push({
        qid: q.qid,
        isCorrect,
        subjectTag: q.subject_tag || subject
      })
    }
    if (attempts.length > 0) {
      recordBatchAttemptsO1Action({ attempts }).catch(err => console.error('Error recording batch O(1) item difficulty telemetry:', err))
    }
  }

  const prefix = subject === 'READING_WRITING' ? 'rw' : 'math'
  const subjects = test.test_type === 'BOTH' ? (test.subject_order || ['READING_WRITING', 'MATH']) :
    test.test_type === 'READING_WRITING' ? ['READING_WRITING'] : ['MATH']

  if (phase === 'base') {
    // Determine adaptive path
    const threshold = test[`${prefix}_threshold`] || 0
    let path = grade.correct >= threshold ? 'harder' : 'easier'
    if ((forceMode === 'harder' || forceMode === 'easier') && adminLevel >= 7) {
      path = forceMode
    }
    const adaptiveModuleId = test[`${prefix}_${path}_module_id`]

    if (!adaptiveModuleId) return { error: 'TEST_CONFIG_INVALID' }
    const { moduleData, questions: nextQs } = await fetchModuleQuestions(adaptiveModuleId)

    return {
      grade: { ...grade, path },
      nextPhase: 'ADAPTIVE',
      moduleData,
      questions: nextQs
    }
  }

  if (phase === 'adaptive') {
    // Check if there's another subject
    const currentIdx = subjects.indexOf(subject)
    if (currentIdx < subjects.length - 1) {
      const nextSubject = subjects[currentIdx + 1]
      const nextPrefix = nextSubject === 'READING_WRITING' ? 'rw' : 'math'
      const nextBaseId = test[`${nextPrefix}_base_module_id`]

      if (!nextBaseId) return { error: 'TEST_CONFIG_INVALID' }
      const { moduleData, questions: nextQs } = await fetchModuleQuestions(nextBaseId)

      return {
        grade,
        nextPhase: 'BREAK',
        nextSubject,
        moduleData,
        questions: nextQs
      }
    }

    // No more subjects — test complete
    return { grade, nextPhase: 'COMPLETE' }
  }

  return { error: 'INVALID_PHASE' }
}

export async function submitTestResultsAction(payload) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { message: 'Not authenticated' } }

  const submission = { student_id: user.id, test_id: payload.testId, ...payload }
  delete submission.testId // remove the camelCase one

  const { data: insertedData, error } = await supabaseAdmin.from('test_submissions').insert([submission]).select('id').single()
  if (error) {
    console.error('Failed to insert test submission:', error)
    return { error }
  }

  // Automatically update the user's current/latest SAT score on their profile
  const profileUpdates = {}
  if (typeof payload.rw_score_estimate === 'number' && !isNaN(payload.rw_score_estimate)) {
    profileUpdates.latest_sat_rw = payload.rw_score_estimate
  }
  if (typeof payload.math_score_estimate === 'number' && !isNaN(payload.math_score_estimate)) {
    profileUpdates.latest_sat_math = payload.math_score_estimate
  }

  if (Object.keys(profileUpdates).length > 0) {
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdates)
      .eq('id', user.id)
    if (profileErr) {
      console.error('Failed to update profile latest SAT scores upon test completion:', profileErr)
    }
  }

  const { data: profile } = await supabaseAdmin.from('profiles').select('user_level, admin_level').eq('id', user.id).single()
  let category = 'free'
  if (profile?.admin_level >= 7 || profile?.user_level === 6) category = 'master'
  else if (profile?.user_level === 4) category = 'flash'
  else if (profile?.user_level === 2) category = 'practice'

  try {
    await contentAdminClient.rpc('increment_content_analytics', {
      p_table: 'practice_tests',
      p_id: payload.testId,
      p_metric: `${category}_submitted`,
      p_delta: 1
    })
  } catch (rpcErr) {
    console.error('Failed to increment practice_tests submit telemetry on server:', rpcErr)
  }

  return { success: true, submissionId: insertedData?.id }
}

export async function getQuestionByIdAction(qid) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data, error } = await contentAdminClient
      .from('questions')
      .select('*')
      .eq('qid', qid)
      .single()

    if (error) {
      console.error("Error fetching question:", error)
      return { error: 'Failed to fetch question' }
    }

    return { data }
  } catch (err) {
    console.error("Unexpected error in getQuestionByIdAction:", err)
    return { error: 'Internal error' }
  }
}
