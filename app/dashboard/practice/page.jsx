import React from 'react';
import { verifyFeatureAccessAction } from '@/app/actions/adminUserActions'
import FeatureMaintenanceGuard from '@/app/dashboard/FeatureMaintenanceGuard'
import { createClient } from '@/utils/supabase/server'
import { getEffectiveUserLevel } from '@/utils/getUserLevel'
import PracticeClient from './PracticeClient'

export const revalidate = 0

export default async function PracticeModePage() {
  const access = await verifyFeatureAccessAction('practice')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let userLevel = 1
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('user_level, admin_level, premium_expires_at').eq('id', user.id).single()
    const eff = await getEffectiveUserLevel(profile)
    userLevel = eff.userLevel
  } else {
    userLevel = 0
  }

  return (
    <FeatureMaintenanceGuard access={access}>
      <PracticeClient userLevel={userLevel} />
    </FeatureMaintenanceGuard>
  );
}
