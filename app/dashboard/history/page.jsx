import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getEffectiveUserLevel } from '@/utils/getUserLevel'
import HistoryGuestClient from '@/app/dashboard/history/HistoryGuestClient'

const contentAdminClient = createAdminClient(
  process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL,
  process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export const revalidate = 0

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <HistoryGuestClient />
  }

  const { data: profile } = await supabase.from('profiles').select('user_level, admin_level, premium_expires_at').eq('id', user.id).single()
  const eff = await getEffectiveUserLevel(profile)
  if (eff.userLevel === 0) {
    return <HistoryGuestClient />
  }

  // Fetch standalone module submissions from User DB
  const { data: moduleSubmissions } = await supabase
    .from('submissions')
    .select('id, module_id, submitted_at, score_estimate, correct_count, total_questions')
    .eq('student_id', user.id)

  // Fetch full practice test submissions from User DB
  const { data: testSubmissions } = await supabase
    .from('test_submissions')
    .select('id, test_id, submitted_at, rw_score_estimate, math_score_estimate, total_correct, total_questions')
    .eq('student_id', user.id)

  // Extract IDs to query titles from Content DB
  const modIds = [...new Set((moduleSubmissions || []).map(s => s.module_id).filter(Boolean))]
  const testIds = [...new Set((testSubmissions || []).map(t => t.test_id).filter(Boolean))]

  const modMap = {}
  if (modIds.length > 0) {
    const { data: mods } = await contentAdminClient.from('modules').select('id, module_name').in('id', modIds)
    if (mods) mods.forEach(m => modMap[m.id] = m.module_name)
  }

  const testMap = {}
  if (testIds.length > 0) {
    const { data: tests } = await contentAdminClient.from('practice_tests').select('id, test_name').in('id', testIds)
    if (tests) tests.forEach(t => testMap[t.id] = t.test_name)
  }

  const allSubmissions = [
    ...(moduleSubmissions || []).map(s => ({
      id: s.id,
      type: 'module',
      name: modMap[s.module_id] || 'Practice Module',
      submitted_at: s.submitted_at,
      score: s.score_estimate || 0,
      correct: s.correct_count || 0,
      total: s.total_questions || 0,
      maxScore: 800
    })),
    ...(testSubmissions || []).map(t => ({
      id: t.id,
      type: 'test',
      name: testMap[t.test_id] || 'Full Practice Test',
      submitted_at: t.submitted_at,
      score: (t.rw_score_estimate || 0) + (t.math_score_estimate || 0),
      correct: t.total_correct || 0,
      total: t.total_questions || 0,
      maxScore: 1600
    }))
  ].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())

  if (allSubmissions.length === 0) {
    return <div className="text-white/50 text-center py-12 bg-[#0a0f0a]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl">No past submissions found. Complete a module or test to see your history.</div>
  }

  return (
    <div className="text-white">
      <h1 className="text-3xl font-bold mb-8 tracking-tight">Submission History</h1>
      
      <div className="space-y-4">
        {allSubmissions.map(sub => (
          <Link href={sub.type === 'test' ? `/test-review/${sub.id}` : `/dashboard/history/${sub.id}?type=${sub.type}`} key={sub.id} className="group block bg-[#0a0f0a]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl hover:border-[#D0F288]/50 hover:bg-white/5 transition-all p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight group-hover:text-[#D0F288] transition-colors">{sub.name}</h2>
              <div className={`text-xs font-bold mt-2 uppercase tracking-wider px-3 py-1 rounded-full inline-block border ${sub.type === 'test' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'}`}>
                {sub.type === 'test' ? 'Full Practice Test' : 'Standalone Module'}
              </div>
              <div className="text-sm text-white/40 mt-3 font-light">{new Date(sub.submitted_at).toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-6 self-end md:self-auto">
              <div className="text-right">
                <div className="text-2xl font-black text-[#D0F288]">{sub.score} <span className="text-white/30 text-lg">/ {sub.maxScore}</span></div>
                <div className="text-sm font-medium text-white/50">{sub.correct} out of {sub.total} correct</div>
              </div>
              <ChevronRight className="w-6 h-6 text-white/20 group-hover:text-[#D0F288] transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}