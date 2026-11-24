import { createClient } from '@/utils/supabase/server'
import { getToolPermissionsAction, getLightweightUsers, getSiteFeatureTogglesAction } from '@/app/actions/adminUserActions'
import OwnerControlClient from './OwnerControlClient'

export const revalidate = 0

export default async function OwnerControlPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return <div className="p-8 text-center text-red-600 font-bold">Unauthorized</div>
  }

  const { data: profile } = await supabase.from('profiles').select('admin_level').eq('id', user.id).single()
  const adminLevel = profile?.admin_level || 0
  if (adminLevel < 9) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center bg-gray-50 flex-1">
        <div className="w-20 h-20 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-red-600 text-3xl font-black mb-6 shadow-sm">🔒</div>
        <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Owner Control Room</h2>
        <p className="text-gray-600 max-w-md mb-6">This restricted command center is strictly accessible to the platform Owner (Level 9). Your current role tier is Level {adminLevel}.</p>
      </div>
    )
  }

  const { data: permissions } = await getToolPermissionsAction()
  const { data: users } = await getLightweightUsers()
  const { data: toggles } = await getSiteFeatureTogglesAction()

  return <OwnerControlClient initialPermissions={permissions || []} initialUsers={users || []} initialToggles={toggles || []} />
}
