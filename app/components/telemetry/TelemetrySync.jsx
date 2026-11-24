'use client'

import { useEffect } from 'react'

export function TelemetrySync({ userLevel = 1, userId = null }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('prepnova_user_tier', String(userLevel))
      if (userId) {
        localStorage.setItem('prepnova_user_id', userId)
      }
    }
  }, [userLevel, userId])

  return null
}
