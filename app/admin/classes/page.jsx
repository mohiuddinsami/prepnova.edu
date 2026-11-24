import { createClient } from '@supabase/supabase-js'
import { verifyToolAccessAction } from '@/app/actions/adminUserActions'
import ClassesClient from './ClassesClient'

export const revalidate = 0

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const contentAdminClient = createClient(
  process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL,
  process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async function ClassesAdminPage() {
  const access = await verifyToolAccessAction('classes')
  if (!access.authorized) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center bg-gray-50 flex-1 min-h-[600px]">
        <div className="w-20 h-20 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-red-600 text-3xl font-black mb-6 shadow-sm">🔒</div>
        <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Access Restricted</h2>
        <p className="text-gray-600 max-w-md mb-6">This administrative tool strictly requires <span className="font-bold text-gray-900">Level {access.minReq}</span> clearance as configured in the Owner Control Room. Your current role tier is <span className="font-bold text-red-600">Level {access.level}</span>.</p>
      </div>
    )
  }

  // Fetch classes from User DB
  const { data: classes } = await supabaseAdmin.from('classes').select('*').order('created_at', { ascending: false })

  // Fetch files directory tree from Content DB
  const { data: files } = await contentAdminClient.from('files').select('*')

  return <ClassesClient initialClasses={classes || []} initialFiles={files || []} />
}
