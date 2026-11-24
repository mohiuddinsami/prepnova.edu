import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import PracticeConfigClient from './PracticeConfigClient'
import { getPracticeConfigAction } from '@/app/actions/practiceActions'

export const revalidate = 0

export default async function PracticeConfigPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return <div className="p-8 text-center text-red-600 font-bold">Unauthorized</div>
  }

  const { data: profile } = await supabase.from('profiles').select('admin_level').eq('id', user.id).single()
  const adminLevel = profile?.admin_level || 0
  if (adminLevel < 7) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center bg-gray-50 flex-1">
        <div className="w-20 h-20 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-red-600 text-3xl font-black mb-6 shadow-sm">🔒</div>
        <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Practice Engine Configuration</h2>
        <p className="text-gray-600 max-w-md mb-6">This restricted command center is strictly accessible to Admins (Level 7+).</p>
      </div>
    )
  }

  // Fetch unique sources from Content DB
  // For safety, we can just do a grouped query, or fetch a max amount and map on client.
  const contentAdminClient = createAdminClient(
    process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL || '',
    process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
  )

  const { data: questions } = await contentAdminClient.from('questions').select('question_source')
  const allSources = questions ? Array.from(new Set(questions.map(q => q.question_source).filter(Boolean))) : []

  const { config } = await getPracticeConfigAction()

  return <PracticeConfigClient allSources={allSources} initialConfig={config || {}} />
}
