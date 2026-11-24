import { cookies } from 'next/headers'

export async function getEffectiveUserLevel(profile) {
  let userLevel = profile?.user_level ?? 1

  // If user is expired, fallback to 1
  if (userLevel >= 2 && profile?.premium_expires_at && new Date(profile.premium_expires_at) < new Date()) {
    userLevel = 1
  }

  // If admin (level >= 7), check if they have selected an override cookie
  if ((profile?.admin_level || 0) >= 7) {
    try {
      const cookieStore = await cookies()
      const overrideCookie = cookieStore.get('admin_view_as_level')
      if (overrideCookie && overrideCookie.value !== undefined && overrideCookie.value !== 'real') {
        const parsed = parseInt(overrideCookie.value, 10)
        if (!isNaN(parsed)) {
          return { userLevel: parsed, isOverride: true, realLevel: profile?.user_level ?? 1 }
        }
      }
    } catch (e) {
      // ignore errors if called from client or invalid cookie context
    }
  }

  return { userLevel, isOverride: false, realLevel: userLevel }
}
