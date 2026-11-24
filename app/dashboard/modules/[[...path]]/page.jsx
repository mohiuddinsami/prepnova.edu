import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Lock, Unlock, ArrowLeft, FolderOpen, ChevronRight, FileText } from 'lucide-react'
import { verifyFeatureAccessAction } from '@/app/actions/adminUserActions'
import FeatureMaintenanceGuard from '@/app/dashboard/FeatureMaintenanceGuard'
import { getEffectiveUserLevel } from '@/utils/getUserLevel'
import ModulesExplorerClient from '@/app/dashboard/modules/ModulesExplorerClient'

const contentAdminClient = createAdminClient(
  process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL,
  process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export const revalidate = 0

export default async function ModulesExplorerPage({ params }) {
  const access = await verifyFeatureAccessAction('modules')
  if (!access.authorized) {
    return <FeatureMaintenanceGuard access={access} />
  }

  const { path } = await params
  
  // Construct current directory path
  const decodedPath = (path || []).map(seg => {
    try { return decodeURIComponent(seg) } catch (e) { return seg }
  })
  const currentPathArray = ['root', 'modules', ...decodedPath]
  const currentDirectory = '/' + currentPathArray.join('/')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('premium_expires_at, user_level, admin_level').eq('id', user.id).single()

  const { userLevel, isOverride } = await getEffectiveUserLevel(profile)
  const adminLevel = profile?.admin_level || 0

  // O(1) Fetch all items in this directory from Content DB
  const { data: rawItems } = await contentAdminClient
    .from('files')
    .select('*')
    .eq('parent_directory', currentDirectory)
    .order('type', { ascending: true })
    .order('name', { ascending: true })

  // Deduplicate items by reference_id (or name if folder) to prevent duplicate UI cards from redundant database pointers
  const seenRefs = new Set()
  const items = (rawItems || []).filter(i => {
    const key = i.reference_id ? `${i.type}_${i.reference_id}` : `${i.type}_${i.name}`
    if (seenRefs.has(key)) return false
    seenRefs.add(key)
    return true
  })

  // Extract reference IDs for modules
  const moduleIds = items.filter(i => i.type === 'module').map(i => i.reference_id).filter(Boolean)

  let modulesData = []
  if (moduleIds.length > 0) {
    const { data } = await contentAdminClient.from('modules').select('*').in('id', moduleIds)
    modulesData = data || []
  }

  // Create lookup map
  const moduleMap = {}
  modulesData.forEach(m => moduleMap[m.id] = m)

  const parentDirectoryArray = [...currentPathArray]
  parentDirectoryArray.pop()
  const parentUrl = parentDirectoryArray.length >= 2 
    ? `/dashboard/modules/${parentDirectoryArray.slice(2).join('/')}` 
    : '/dashboard'

  return (
    <FeatureMaintenanceGuard access={access}>
      <ModulesExplorerClient
        items={items || []}
        moduleMap={moduleMap}
        currentPathArray={currentPathArray}
        parentUrl={parentUrl}
        userLevel={userLevel}
        adminLevel={adminLevel}
        isOverride={isOverride}
      />
    </FeatureMaintenanceGuard>
  )
}
