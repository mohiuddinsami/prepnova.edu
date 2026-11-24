import { createContentAdminClient as createClient } from '@/utils/supabase/server'
import { verifyToolAccessAction } from '@/app/actions/adminUserActions'
import { ModuleBuilderRoute } from '../RouteWrappers'

export const revalidate = 0

export default async function ModuleBuilderPage() {
  const access = await verifyToolAccessAction('module-builder')
  if (!access.authorized) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center bg-gray-50 flex-1 min-h-[600px]">
        <div className="w-20 h-20 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-red-600 text-3xl font-black mb-6 shadow-sm">🔒</div>
        <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Access Restricted</h2>
        <p className="text-gray-600 max-w-md mb-6">This administrative tool strictly requires <span className="font-bold text-gray-900">Level {access.minReq}</span> clearance as configured in the Owner Control Room. Your current role tier is <span className="font-bold text-red-600">Level {access.level}</span>.</p>
      </div>
    )
  }

  const supabase = await createClient()
  
  let allQuestions = [];
  let hasMore = true;
  let page = 0;
  const pageSize = 1000;
  
  while (hasMore) {
    const { data } = await supabase
      .from('questions')
      .select('qid, subject_tag, topic_tag, difficulty, question_type, assigned_modules, question, question_source, created_at, image_url')
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);
      
    if (data && data.length > 0) {
      allQuestions = allQuestions.concat(data);
      page++;
      if (data.length < pageSize) hasMore = false;
    } else {
      hasMore = false;
    }
  }

  const { data: modules } = await supabase.from('modules').select('*').order('created_at', { ascending: false })

  return <ModuleBuilderRoute initialQuestions={allQuestions} initialModules={modules || []} />
}
