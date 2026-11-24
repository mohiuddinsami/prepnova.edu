import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import ReviewEngine from './ReviewEngine'

const contentAdminClient = createAdminClient(
  process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL,
  process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async function SubmissionReviewPage({ params }) {
  const { subId } = await params
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div className="p-10">Unauthorized</div>

  // 1. Fetch test submission
  const { data: testSub } = await supabase
    .from('test_submissions')
    .select('*')
    .eq('id', subId)
    .eq('student_id', user.id)
    .single()

  if (!testSub) return <div className="p-10 text-gray-500 text-center font-bold text-xl">Submission not found.</div>

  // 2. Fetch Practice Test Info
  const { data: practiceTest } = await contentAdminClient
    .from('practice_tests')
    .select('test_name')
    .eq('id', testSub.test_id)
    .single()

  // 3. Fetch Modules
  const moduleIds = [
    testSub.rw_base_module_id,
    testSub.rw_adaptive_module_id,
    testSub.math_base_module_id,
    testSub.math_adaptive_module_id
  ].filter(Boolean)

  const { data: modulesData } = await contentAdminClient
    .from('modules')
    .select('id, module_name, question_ids')
    .in('id', moduleIds)

  // Preserve ordering according to how they were taken
  const orderedModules = []
  const safeModulesData = modulesData || []
  if (testSub.rw_base_module_id) orderedModules.push(safeModulesData.find(m => m.id === testSub.rw_base_module_id))
  if (testSub.rw_adaptive_module_id) orderedModules.push(safeModulesData.find(m => m.id === testSub.rw_adaptive_module_id))
  if (testSub.math_base_module_id) orderedModules.push(safeModulesData.find(m => m.id === testSub.math_base_module_id))
  if (testSub.math_adaptive_module_id) orderedModules.push(safeModulesData.find(m => m.id === testSub.math_adaptive_module_id))

  const allQuestionIds = orderedModules.flatMap(m => m ? (m.question_ids || []) : [])
  
  // 4. Fetch Question Metadata (lightweight payload)
  const { data: questionsData } = await contentAdminClient
    .from('questions')
    .select('qid, question_type, correct_answer')
    .in('qid', allQuestionIds)
    
  const qMap = {}
  if (questionsData) questionsData.forEach(q => qMap[q.qid] = q)

  // Construct final ordered question meta array
  const orderedQuestionMeta = []
  orderedModules.forEach(m => {
    (m.question_ids || []).forEach(qid => {
      if (qMap[qid]) {
        orderedQuestionMeta.push({ 
          ...qMap[qid], 
          module_id: m.id, 
          module_name: m.module_name 
        })
      }
    })
  })

  return (
    <ReviewEngine 
      testSub={testSub}
      practiceTest={practiceTest}
      questionMeta={orderedQuestionMeta}
      studentAnswers={testSub.student_answers || {}}
    />
  )
}
