import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ProfileClient from './ProfileClient'
import { getEffectiveUserLevel } from '@/utils/getUserLevel'

export const revalidate = 0

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile) {
    const eff = await getEffectiveUserLevel(profile)
    profile.user_level = eff.userLevel
  }

  return <ProfileClient profile={profile} email={user.email} />
}
