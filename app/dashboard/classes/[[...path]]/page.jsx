import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import ClassesExplorerClient from '@/app/dashboard/classes/ClassesExplorerClient'
import { verifyFeatureAccessAction } from '@/app/actions/adminUserActions'
import FeatureMaintenanceGuard from '@/app/dashboard/FeatureMaintenanceGuard'
import { getEffectiveUserLevel } from '@/utils/getUserLevel'

export const revalidate = 0

const contentAdminClient = createAdminClient(
  process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL,
  process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const userAdminClient = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async function ClassesExplorerPage({ params }) {
  const access = await verifyFeatureAccessAction('classes')
  if (!access.authorized) {
    return <FeatureMaintenanceGuard access={access} />
  }

  const { path } = await params
  
  const decodedPath = (path || []).map(seg => {
    try { return decodeURIComponent(seg) } catch (e) { return seg }
  })
  const currentPathArray = ['root', 'classes', ...decodedPath]
  const currentDirectory = '/' + currentPathArray.join('/')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  let userLevel = 1
  let adminLevel = 0
  let isOverride = false
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('premium_expires_at, user_level, admin_level').eq('id', user.id).single()
    const eff = await getEffectiveUserLevel(profile)
    userLevel = eff.userLevel
    isOverride = eff.isOverride || false
    adminLevel = profile?.admin_level || 0
  }

  // Fetch directory items from Content DB
  const { data: items } = await contentAdminClient
    .from('files')
    .select('*')
    .eq('parent_directory', currentDirectory)
    .order('type', { ascending: true })
    .order('name', { ascending: true })

  // Extract reference IDs for classes
  const classIds = (items || []).filter(i => i.type === 'class').map(i => i.reference_id).filter(Boolean)

  let classesData = []
  if (classIds.length > 0) {
    const { data } = await userAdminClient.from('classes').select('*').in('id', classIds)
    classesData = data || []
  }

  const parentDirectoryArray = [...currentPathArray]
  parentDirectoryArray.pop()
  const parentUrl = parentDirectoryArray.length >= 2 
    ? `/dashboard/classes/${parentDirectoryArray.slice(2).join('/')}` 
    : '/dashboard'

  return (
    <FeatureMaintenanceGuard access={access}>
      <ClassesExplorerClient 
        items={items || []} 
        classesData={classesData} 
        currentDirectory={currentDirectory} 
        userLevel={userLevel} 
        adminLevel={adminLevel} 
        isOverride={isOverride}
        parentUrl={parentUrl} 
      />
    </FeatureMaintenanceGuard>
  )
}
