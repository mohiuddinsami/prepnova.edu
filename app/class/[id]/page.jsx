import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { notFound, redirect } from 'next/navigation'
import ClassStreamerClient from './ClassStreamerClient'
import { getEffectiveUserLevel } from '@/utils/getUserLevel'
import AdminViewLevelSwitcher from '@/app/components/AdminViewLevelSwitcher'

export const revalidate = 0

const userAdminClient = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async function StandaloneClassPage({ params }) {
  const { id } = await params
  if (!id) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, user_level, admin_level, premium_expires_at').eq('id', user.id).single()
  const { userLevel, isOverride } = await getEffectiveUserLevel(profile)
  const adminLevel = profile?.admin_level || 0

  // Fetch package from User DB
  const { data: pkg, error } = await userAdminClient
    .from('classes')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !pkg) {
    notFound()
  }

  // Check locking (if override active, simulate student locking)
  const reqLevel = pkg.required_level ?? 1
  if (userLevel < reqLevel && (adminLevel < 7 || isOverride)) {
    redirect('/dashboard/classes?locked=' + pkg.id)
  }

  const userName = profile?.full_name || user.user_metadata?.full_name || 'Sayed Md. Mohiuddin Sami'

  return (
    <>
      <AdminViewLevelSwitcher adminLevel={adminLevel} currentOverride={isOverride ? userLevel : 'real'} />
      <ClassStreamerClient activePackage={pkg} userLevel={userLevel} adminLevel={adminLevel} userName={userName} />
    </>
  )
}
