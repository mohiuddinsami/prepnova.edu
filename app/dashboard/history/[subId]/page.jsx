import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { CheckCircle, XCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import RichText from '@/components/RichText'

const contentAdminClient = createAdminClient(
  process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL,
  process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function QuestionReviewItem({ q, studentAns, index }) {
  // SPR grading helpers (must match quiz page logic exactly)
  const parseSprValue = (inputStr) => {
    if (!inputStr) return null;
    const cleanStr = String(inputStr).trim();
    if (cleanStr.includes('/')) {
      const [num, den] = cleanStr.split('/');
      return parseFloat(num) / parseFloat(den);
    }
    return parseFloat(cleanStr);
  };

  const gradeSpr = (studentInput, dbAnswerString) => {
    if (String(studentInput).trim() === String(dbAnswerString).trim()) return true;
    const studentValue = parseSprValue(studentInput);
    const correctValue = parseSprValue(dbAnswerString);
    if (isNaN(studentValue) || isNaN(correctValue)) return false;
    if (correctValue >= 0) {
      return Math.abs(studentValue - correctValue) < 0.001;
    } else {
      return Math.abs(studentValue - correctValue) < 0.01;
    }
  };

  const checkMultipleSprs = (studentInput, dbAnswerString) => {
    if (!dbAnswerString) return false;
    const possibleAnswers = String(dbAnswerString).split('||');
    return possibleAnswers.some(ans => gradeSpr(studentInput, ans));
  };

  let isCorrect = false;
  if (!q.question_type || q.question_type.toUpperCase() === 'MCQ') {
    isCorrect = studentAns === q.correct_answer;
  } else {
    isCorrect = studentAns && checkMultipleSprs(studentAns, q.correct_answer);
  }

  return (
    <div className={`p-4 rounded-lg border ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
      <div className="flex gap-3 mb-2">
        <div className="mt-1">
          {isCorrect ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0"/> : <XCircle className="w-5 h-5 text-red-600 flex-shrink-0"/>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 mb-2">
            <span className="font-bold mr-2">Q{index + 1}.</span>
            <RichText content={q.question} />
          </div>
          <div className="mt-4 text-sm grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-3 rounded border border-gray-200">
              <span className="text-gray-500 font-bold block mb-2">Your Answer:</span>
              <div className={isCorrect ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>
                <RichText content={studentAns || 'Not Answered'} />
              </div>
            </div>
            <div className="bg-white p-3 rounded border border-gray-200">
              <span className="text-gray-500 font-bold block mb-2">Correct Answer:</span>
              <div className="text-green-700 font-bold">
                <RichText content={q.correct_answer.includes('||') ? q.correct_answer.split('||').join(' OR ') : q.correct_answer} />
              </div>
            </div>
          </div>
          {(q.correct_answer_explanation) && (
            <div className="mt-4 text-sm text-gray-800 bg-white p-4 rounded border border-gray-200 shadow-inner">
              <span className="font-bold block mb-2 text-gray-900">Explanation:</span>
              <RichText content={q.correct_answer_explanation} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

async function ModuleReview({ subId, user, supabase }) {
  const { data: sub } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', subId)
    .eq('student_id', user.id)
    .single()

  if (!sub) return <div className="text-gray-500">Submission not found.</div>

  const { data: mod } = await contentAdminClient
    .from('modules')
    .select('module_name, question_ids')
    .eq('id', sub.module_id)
    .single()

  const { data: questionsData } = await contentAdminClient
    .from('questions')
    .select('*')
    .in('qid', mod?.question_ids || [])
  
  const questionMap = {}
  if (questionsData) questionsData.forEach(q => questionMap[q.qid] = q)

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-8">
      <div className="bg-gray-50 p-6 border-b flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{mod?.module_name || 'Module'} Review</h1>
          <div className="text-sm text-gray-500 mt-1">{new Date(sub.submitted_at).toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-blue-600">{sub.score_estimate} / 800</div>
          <div className="text-sm font-medium text-gray-600">{sub.correct_count} out of {sub.total_questions} correct</div>
        </div>
      </div>
      
      <div className="p-6 space-y-6">
        <h3 className="font-bold text-lg mb-4 border-b pb-2">Detailed Answer Review</h3>
        {mod?.question_ids?.map((qId, index) => {
          const q = questionMap[qId]
          if (!q) return null
          return <QuestionReviewItem key={qId} q={q} studentAns={sub.student_answers[qId]} index={index} />
        })}
      </div>
    </div>
  )
}

async function TestReview({ subId, user, supabase }) {
  const { data: testSub } = await supabase
    .from('test_submissions')
    .select('*')
    .eq('id', subId)
    .eq('student_id', user.id)
    .single()

  if (!testSub) return <div className="text-gray-500">Test Submission not found.</div>

  const { data: practiceTest } = await contentAdminClient
    .from('practice_tests')
    .select('test_name')
    .eq('id', testSub.test_id)
    .single()

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

  const modMap = {}
  if (modulesData) modulesData.forEach(m => modMap[m.id] = m)

  const allQuestionIds = modulesData?.flatMap(m => m.question_ids || []) || []
  const { data: questionsData } = await contentAdminClient
    .from('questions')
    .select('*')
    .in('qid', allQuestionIds)
    
  const qMap = {}
  if (questionsData) questionsData.forEach(q => qMap[q.qid] = q)

  const sections = [
    { id: testSub.rw_base_module_id, title: 'Section 1: Reading & Writing (Base)' },
    { id: testSub.rw_adaptive_module_id, title: `Section 1: Reading & Writing (${testSub.rw_path === 'easier' ? 'Easier' : 'Harder'})` },
    { id: testSub.math_base_module_id, title: 'Section 2: Math (Base)' },
    { id: testSub.math_adaptive_module_id, title: `Section 2: Math (${testSub.math_path === 'easier' ? 'Easier' : 'Harder'})` }
  ]

  const totalScore = (testSub.rw_score_estimate || 0) + (testSub.math_score_estimate || 0)

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-8">
      <div className="bg-gray-900 p-8 border-b flex flex-col md:flex-row justify-between items-center text-white gap-4">
        <div>
          <h1 className="text-3xl font-bold">{practiceTest?.test_name || 'Practice Test'} Review</h1>
          <div className="text-sm text-gray-400 mt-2 font-medium">{new Date(testSub.submitted_at).toLocaleString()}</div>
        </div>
        <div className="text-right bg-white/10 p-4 rounded-xl border border-white/20 backdrop-blur-sm">
          <div className="text-4xl font-black text-indigo-400">{totalScore} <span className="text-xl text-gray-400 font-medium">/ 1600</span></div>
          <div className="text-sm font-bold text-gray-300 mt-1 uppercase tracking-wider">{testSub.total_correct} out of {testSub.total_questions} correct</div>
        </div>
      </div>
      
      <div className="p-6 space-y-12">
        {sections.map(section => {
          if (!section.id) return null
          const mod = modMap[section.id]
          if (!mod) return null
          
          return (
            <div key={section.id} className="space-y-6">
              <h3 className="font-black text-2xl mb-6 pb-2 border-b-2 border-gray-100 flex items-center text-gray-800">
                {section.title}
              </h3>
              {mod.question_ids?.map((qId, index) => {
                const q = qMap[qId]
                if (!q) return null
                return <QuestionReviewItem key={qId} q={q} studentAns={testSub.student_answers?.[qId]} index={index} />
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default async function SubmissionReviewPage({ params, searchParams }) {
  const { subId } = await params
  const { type } = await searchParams
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div>
      <Link href="/dashboard/history" className="inline-flex items-center text-blue-600 hover:underline mb-6 font-medium">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to History
      </Link>

      {type === 'test' ? (
        <TestReview subId={subId} user={user} supabase={supabase} />
      ) : (
        <ModuleReview subId={subId} user={user} supabase={supabase} />
      )}
    </div>
  )
}