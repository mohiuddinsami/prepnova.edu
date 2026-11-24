'use client'

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const TelemetryContext = createContext({
  logEvent: () => {},
  logTestStart: () => {},
  logTestSubmit: () => {},
  logClassWatch: () => {},
  sessionToken: null,
  userTier: 'free'
})

export function useTelemetry() {
  return useContext(TelemetryContext)
}

const normalizeTier = (tierOrLevel) => {
  if (tierOrLevel === 1 || tierOrLevel === 'free' || tierOrLevel === '1') return 'free'
  if (tierOrLevel === 2 || tierOrLevel === 'practice' || tierOrLevel === '2') return 'practice'
  if (tierOrLevel === 4 || tierOrLevel === 'flash' || tierOrLevel === '4') return 'flash'
  if (tierOrLevel === 6 || tierOrLevel === 'master' || tierOrLevel === '6') return 'master'
  return 'other' // Ignores guests (0) and testers (3, 5, 7+)
}

export function TelemetryProvider({ children, initialUserTier = 'free', initialUserId = null }) {
  const pathname = usePathname()
  const eventBufferRef = useRef([])
  const [sessionToken, setSessionToken] = useState(null)
  const [userTier, setUserTier] = useState(() => normalizeTier(initialUserTier))
  const [userId, setUserId] = useState(initialUserId)
  const lastPathnameRef = useRef(pathname)

  // Deduplication ref to prevent double page_view increment (+2) on refresh in React Strict Mode / token initialization
  const loggedRoutesRef = useRef(new Set())

  // Keep latest auth refs so stable callbacks never trigger re-render loops or re-register intervals
  const sessionTokenRef = useRef(sessionToken)
  const userTierRef = useRef(userTier)
  const userIdRef = useRef(userId)

  useEffect(() => { sessionTokenRef.current = sessionToken }, [sessionToken])
  useEffect(() => { userTierRef.current = userTier }, [userTier])
  useEffect(() => { userIdRef.current = userId }, [userId])

  // Initialize session token and auto-detect logged-in user + tier via Supabase auth
  useEffect(() => {
    let token = typeof window !== 'undefined' ? localStorage.getItem('prepnova_session_token') : null
    if (!token && typeof window !== 'undefined') {
      token = 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
      localStorage.setItem('prepnova_session_token', token)
    }
    setSessionToken(token)

    const savedTierRaw = typeof window !== 'undefined' ? localStorage.getItem('prepnova_user_tier') : null
    const normalizedSaved = savedTierRaw ? normalizeTier(savedTierRaw) : normalizeTier(initialUserTier)
    if (normalizedSaved !== userTier) {
      setUserTier(normalizedSaved)
    }

    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('user_level, admin_level').eq('id', user.id).single()
        if (profile) {
          let detectedTier = 'free'
          if (profile.admin_level >= 7) detectedTier = 'master'
          else if (profile.user_level === 6) detectedTier = 'master'
          else if (profile.user_level === 4) detectedTier = 'flash'
          else if (profile.user_level === 2) detectedTier = 'practice'
          setUserTier(detectedTier)
          if (typeof window !== 'undefined') localStorage.setItem('prepnova_user_tier', detectedTier)
        }
      }
    }).catch(() => {})

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUserId(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        setUserId(null)
      }
    })

    return () => authListener?.subscription?.unsubscribe()
  }, [initialUserTier])

  // Stable callback: push event to memory buffer
  const logEvent = useCallback((eventData) => {
    if (!eventData || !eventData.eventType) return
    const currentPath = eventData.routePath || window.location?.pathname || '/'
    eventBufferRef.current.push({
      eventType: eventData.eventType,
      eventName: eventData.eventName || eventData.eventType,
      routePath: currentPath,
      targetClassId: eventData.targetClassId || null,
      targetTestId: eventData.targetTestId || null,
      targetModuleId: eventData.targetModuleId || null,
      targetQuestionId: eventData.targetQuestionId || null,
      durationSeconds: eventData.durationSeconds || 0,
      userTier: eventData.userTier || userTierRef.current || 'free',
      userId: eventData.userId || userIdRef.current || null,
      metadata: eventData.metadata || {}
    })
  }, [])

  const logTestStart = useCallback((testId, testTitle = 'Practice Test') => {
    logEvent({
      eventType: 'test_start',
      eventName: `Started: ${testTitle}`,
      targetTestId: testId,
      routePath: window.location?.pathname || '/'
    })
  }, [logEvent])

  const logTestSubmit = useCallback((testId, scoreEstimate = null) => {
    logEvent({
      eventType: 'test_submit',
      eventName: `Submitted Test ${testId?.slice?.(0, 8) || ''}`,
      targetTestId: testId,
      routePath: window.location?.pathname || '/',
      metadata: scoreEstimate ? { scoreEstimate } : {}
    })
  }, [logEvent])

  const logClassWatch = useCallback((classId, durationSeconds, classTitle = 'Class Video') => {
    logEvent({
      eventType: 'class_package_heartbeat',
      eventName: `Watching: ${classTitle}`,
      targetClassId: classId,
      durationSeconds,
      routePath: window.location?.pathname || `/class/${classId}`
    })
  }, [logEvent])

  // Stable flush callback using current refs without triggering interval teardown loop
  const flushBuffer = useCallback(() => {
    const activeToken = sessionTokenRef.current || (typeof window !== 'undefined' ? localStorage.getItem('prepnova_session_token') : null)
    if (!activeToken) return
    const activeTier = userTierRef.current || (typeof window !== 'undefined' ? localStorage.getItem('prepnova_user_tier') : null) || 'free'
    if (eventBufferRef.current.length === 0) return

    const batch = [...eventBufferRef.current]
    eventBufferRef.current = []

    // Detect basic device context
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const deviceType = /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : /Tablet|iPad/i.test(ua) ? 'tablet' : 'desktop'
    let browserName = 'unknown'
    if (ua.includes('Chrome')) browserName = 'Chrome'
    else if (ua.includes('Safari')) browserName = 'Safari'
    else if (ua.includes('Firefox')) browserName = 'Firefox'

    let osName = 'unknown'
    if (ua.includes('Win')) osName = 'Windows'
    else if (ua.includes('Mac')) osName = 'macOS'
    else if (ua.includes('Linux')) osName = 'Linux'
    else if (ua.includes('Android')) osName = 'Android'
    else if (ua.includes('iPhone') || ua.includes('iPad')) osName = 'iOS'

    const payload = JSON.stringify({
      sessionToken: activeToken,
      userTier: activeTier,
      userId: userIdRef.current,
      deviceType,
      browserName,
      osName,
      events: batch
    })

    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/telemetry/batch', new Blob([payload], { type: 'text/plain' }))
      } else {
        fetch('/api/telemetry/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: payload
        }).catch(() => {})
      }
    } catch (e) {
      // Ignore network aborts on unload
    }
  }, [])

  // Auto-flush timer every 10 seconds and on page unload/visibility change
  useEffect(() => {
    const timer = setInterval(() => {
      flushBuffer()
    }, 10000)

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushBuffer()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', handleVisibility)
      window.addEventListener('beforeunload', flushBuffer)
    }

    return () => {
      clearInterval(timer)
      if (typeof window !== 'undefined') {
        window.removeEventListener('visibilitychange', handleVisibility)
        window.removeEventListener('beforeunload', flushBuffer)
      }
      flushBuffer()
    }
  }, [flushBuffer])

  // Track page transitions and initial load with deduplication so refresh never logs +2
  useEffect(() => {
    if (pathname && !pathname.startsWith('/class/')) {
      // Only log if we haven't already logged this exact pathname during the current page mount/lifecycle
      if (!loggedRoutesRef.current.has(pathname)) {
        loggedRoutesRef.current.add(pathname)
        logEvent({
          eventType: 'page_view',
          eventName: `Visited: ${pathname}`,
          routePath: pathname
        })
        setTimeout(() => flushBuffer(), 50)
      }
    }
  }, [pathname, logEvent, flushBuffer])

  // Periodic heartbeat while active on any portal route
  useEffect(() => {
    const heartbeatTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

      if (pathname && !pathname.startsWith('/class/')) {
        logEvent({
          eventType: 'page_heartbeat',
          eventName: `Active on Page: ${pathname}`,
          durationSeconds: 10,
          routePath: pathname
        })
      }
    }, 10000)

    return () => clearInterval(heartbeatTimer)
  }, [pathname, logEvent])

  return (
    <TelemetryContext.Provider value={{
      logEvent,
      logTestStart,
      logTestSubmit,
      logClassWatch,
      sessionToken,
      userTier
    }}>
      {children}
    </TelemetryContext.Provider>
  )
}
