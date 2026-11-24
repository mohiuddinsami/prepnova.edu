'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const contentAdminClient = createClient(
  process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL || '',
  process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const formatSecsToTime = (s) => {
  if (!s || s <= 0) return '0m'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/**
 * Fetches comprehensive, columnar-aggregate analytics data for the Cyberpunk Hacker Arena (/admin/analytics).
 * Reads directly from practice_tests (Content DB), classes (User DB), and page_traffic_analytics (User DB).
 * @param {string} timeRange - '7d' | '14d' | '30d' | 'all'
 */
export async function fetchAnalyticsDashboardAction(timeRange = '14d') {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set.' }
  }

  const authClient = await createServerClient()
  const { data: { user: caller } } = await authClient.auth.getUser()
  if (!caller) return { error: 'Unauthorized: No active session' }

  // Verify caller clearance (Level 8+ required for Level 9 Command Center / Analytics)
  const { data: callerProfile } = await supabaseAdmin
    .from('profiles')
    .select('admin_level')
    .eq('id', caller.id)
    .single()

  const adminLevel = callerProfile?.admin_level || 0
  if (adminLevel < 8) {
    return { error: '⚠️ Clearance Level 8+ required to access the Cyberpunk Analytics Command Center.' }
  }

  // Determine column suffix based on selected time window
  const suffix = ['7d', '14d', '30d', 'all'].includes(timeRange) ? `_${timeRange}` : '_14d'

  try {
    const now = new Date()
    // 1. Fetch Online Sessions (last 15 minutes) & Total Sessions
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString()
    const { data: activeSessionsRows } = await supabaseAdmin
      .from('telemetry_sessions')
      .select('session_token, user_id, user_tier, last_seen_at, device_type, browser_name, os_name')
      .gte('last_seen_at', fifteenMinsAgo)
      .order('last_seen_at', { ascending: false })

    const activeCount = activeSessionsRows?.length || 0

    const { count: totalSessionsCountRes } = await supabaseAdmin
      .from('telemetry_sessions')
      .select('session_token', { count: 'exact', head: true })
    const totalSessionsCount = totalSessionsCountRes || 0

    // Fetch profile details for authenticated active sessions
    const activeUserIds = [...new Set((activeSessionsRows || []).map(s => s.user_id).filter(Boolean))]
    const profilesMap = new Map()
    if (activeUserIds.length > 0) {
      const { data: profilesRows } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, user_level, admin_level')
        .in('id', activeUserIds)
      if (profilesRows) {
        profilesRows.forEach(p => profilesMap.set(p.id, p))
      }
    }

    const activeSessionsList = (activeSessionsRows || []).map(sess => {
      const p = profilesMap.get(sess.user_id) || {}
      let tierLabel = sess.user_tier ? sess.user_tier.toUpperCase() : 'FREE'
      if (p.admin_level >= 9) tierLabel = 'LEVEL 9 OWNER'
      else if (p.admin_level >= 7) tierLabel = `ADMIN (LVL ${p.admin_level})`
      else if (p.user_level === 6 || tierLabel === 'MASTER') tierLabel = 'MASTER PLAN'
      else if (p.user_level === 4 || tierLabel === 'FLASH') tierLabel = 'FLASH PLAN'
      else if (p.user_level === 2 || tierLabel === 'PRACTICE') tierLabel = 'PRACTICE PLAN'

      return {
        sessionToken: sess.session_token,
        userId: sess.user_id || null,
        name: p.full_name || (sess.user_id ? `User (${sess.user_id.slice(0, 8)})` : 'Anonymous Student'),
        email: p.email || 'N/A (Guest Session)',
        tier: tierLabel,
        device: `${sess.device_type || 'desktop'} (${sess.browser_name || 'Browser'}, ${sess.os_name || 'OS'})`,
        lastSeen: sess.last_seen_at
      }
    })

    // 2. Fetch Practice Tests strictly from Content DB (Project B)
    const { data: practiceTests, error: ptError } = await contentAdminClient
      .from('practice_tests')
      .select(`id, test_name, free_started${suffix}, free_submitted${suffix}, practice_started${suffix}, practice_submitted${suffix}, flash_started${suffix}, flash_submitted${suffix}, master_started${suffix}, master_submitted${suffix}`)

    let totalTestStarts = 0
    let totalTestSubmits = 0

    const testFunnelList = (practiceTests || []).map(pt => {
      const freeStarts = parseInt(pt[`free_started${suffix}`] || 0, 10)
      const freeSubmits = parseInt(pt[`free_submitted${suffix}`] || 0, 10)
      const practiceStarts = parseInt(pt[`practice_started${suffix}`] || 0, 10)
      const practiceSubmits = parseInt(pt[`practice_submitted${suffix}`] || 0, 10)
      const flashStarts = parseInt(pt[`flash_started${suffix}`] || 0, 10)
      const flashSubmits = parseInt(pt[`flash_submitted${suffix}`] || 0, 10)
      const masterStarts = parseInt(pt[`master_started${suffix}`] || 0, 10)
      const masterSubmits = parseInt(pt[`master_submitted${suffix}`] || 0, 10)

      const totalStarts = freeStarts + practiceStarts + flashStarts + masterStarts
      const totalSubmits = freeSubmits + practiceSubmits + flashSubmits + masterSubmits

      totalTestStarts += totalStarts
      totalTestSubmits += totalSubmits

      const overallRate = totalStarts > 0 ? Math.round((totalSubmits / totalStarts) * 100) : 0
      const freeRate = freeStarts > 0 ? Math.round((freeSubmits / freeStarts) * 100) : 0
      const practiceRate = practiceStarts > 0 ? Math.round((practiceSubmits / practiceStarts) * 100) : 0
      const flashRate = flashStarts > 0 ? Math.round((flashSubmits / flashStarts) * 100) : 0
      const masterRate = masterStarts > 0 ? Math.round((masterSubmits / masterStarts) * 100) : 0

      const displayName = pt.test_name || pt.title || `Practice Test (${pt.id.slice(0, 8)})`

      return {
        testId: pt.id,
        testName: displayName,
        totalStarts,
        totalSubmits,
        overallRate,
        freeStarts,
        freeSubmits,
        freeRate,
        practiceStarts,
        practiceSubmits,
        practiceRate,
        flashStarts,
        flashSubmits,
        flashRate,
        masterStarts,
        masterSubmits,
        masterRate
      }
    }).sort((a, b) => b.totalStarts - a.totalStarts || a.testName.localeCompare(b.testName))

    // 3. Fetch Classes Engagement from User DB (Project A)
    const { data: classesData } = await supabaseAdmin
      .from('classes')
      .select(`id, title, free_clicks${suffix}, free_seconds${suffix}, practice_clicks${suffix}, practice_seconds${suffix}, flash_clicks${suffix}, flash_seconds${suffix}, master_clicks${suffix}, master_seconds${suffix}`)

    let totalClassSeconds = 0

    const classList = (classesData || []).map(cls => {
      const freeClicks = parseInt(cls[`free_clicks${suffix}`] || 0, 10)
      const freeSeconds = parseInt(cls[`free_seconds${suffix}`] || 0, 10)
      const practiceClicks = parseInt(cls[`practice_clicks${suffix}`] || 0, 10)
      const practiceSeconds = parseInt(cls[`practice_seconds${suffix}`] || 0, 10)
      const flashClicks = parseInt(cls[`flash_clicks${suffix}`] || 0, 10)
      const flashSeconds = parseInt(cls[`flash_seconds${suffix}`] || 0, 10)
      const masterClicks = parseInt(cls[`master_clicks${suffix}`] || 0, 10)
      const masterSeconds = parseInt(cls[`master_seconds${suffix}`] || 0, 10)

      const totalClicks = freeClicks + practiceClicks + flashClicks + masterClicks
      const totalSecs = freeSeconds + practiceSeconds + flashSeconds + masterSeconds
      totalClassSeconds += totalSecs

      const hrs = Math.floor(totalSecs / 3600)
      const mins = Math.floor((totalSecs % 3600) / 60)
      const formattedTime = `${hrs}h ${mins}m`

      const hasActivity = totalClicks > 0 || totalSecs > 0
      const totalEvents = totalClicks || 1
      const freeClickPct = totalClicks > 0 ? Math.round((freeClicks / totalEvents) * 100) : 0
      const practiceClickPct = totalClicks > 0 ? Math.round((practiceClicks / totalEvents) * 100) : 0
      const flashClickPct = totalClicks > 0 ? Math.round((flashClicks / totalEvents) * 100) : 0
      const masterClickPct = totalClicks > 0 ? Math.max(0, 100 - (freeClickPct + practiceClickPct + flashClickPct)) : 0

      const totalTimeEvents = totalSecs || 1
      const freeTimePct = totalSecs > 0 ? Math.round((freeSeconds / totalTimeEvents) * 100) : 0
      const practiceTimePct = totalSecs > 0 ? Math.round((practiceSeconds / totalTimeEvents) * 100) : 0
      const flashTimePct = totalSecs > 0 ? Math.round((flashSeconds / totalTimeEvents) * 100) : 0
      const masterTimePct = totalSecs > 0 ? Math.max(0, 100 - (freeTimePct + practiceTimePct + flashTimePct)) : 0

      return {
        classId: cls.id,
        classTitle: cls.title || `Class Package (${cls.id?.slice?.(0, 8) || cls.id})`,
        views: totalClicks,
        totalSecs,
        hours: parseFloat((totalSecs / 3600).toFixed(1)),
        formattedTime,
        freeClicks,
        practiceClicks,
        flashClicks,
        masterClicks,
        freeSeconds,
        practiceSeconds,
        flashSeconds,
        masterSeconds,
        freePct: freeClickPct, // Backward compat
        practicePct: practiceClickPct,
        flashPct: flashClickPct,
        masterPct: masterClickPct,
        freeClickPct,
        practiceClickPct,
        flashClickPct,
        masterClickPct,
        freeTimePct,
        practiceTimePct,
        flashTimePct,
        masterTimePct,
        freeFormattedTime: formatSecsToTime(freeSeconds),
        practiceFormattedTime: formatSecsToTime(practiceSeconds),
        flashFormattedTime: formatSecsToTime(flashSeconds),
        masterFormattedTime: formatSecsToTime(masterSeconds)
      }
    }).sort((a, b) => b.totalSecs - a.totalSecs).slice(0, 10)

    // 4. Fetch General Page Traffic Analytics from User DB (Project A)
    const { data: pagesData } = await supabaseAdmin
      .from('page_traffic_analytics')
      .select(`route_path, free_visits${suffix}, free_seconds${suffix}, practice_visits${suffix}, practice_seconds${suffix}, flash_visits${suffix}, flash_seconds${suffix}, master_visits${suffix}, master_seconds${suffix}`)

    const pageList = (pagesData || []).map(p => {
      const freeVisits = parseInt(p[`free_visits${suffix}`] || 0, 10)
      const freeSeconds = parseInt(p[`free_seconds${suffix}`] || 0, 10)
      const practiceVisits = parseInt(p[`practice_visits${suffix}`] || 0, 10)
      const practiceSeconds = parseInt(p[`practice_seconds${suffix}`] || 0, 10)
      const flashVisits = parseInt(p[`flash_visits${suffix}`] || 0, 10)
      const flashSeconds = parseInt(p[`flash_seconds${suffix}`] || 0, 10)
      const masterVisits = parseInt(p[`master_visits${suffix}`] || 0, 10)
      const masterSeconds = parseInt(p[`master_seconds${suffix}`] || 0, 10)

      const totalVisits = freeVisits + practiceVisits + flashVisits + masterVisits
      const totalSecs = freeSeconds + practiceSeconds + flashSeconds + masterSeconds

      const totalEvents = totalVisits || 1
      const freePct = Math.round((freeVisits / totalEvents) * 100)
      const practicePct = Math.round((practiceVisits / totalEvents) * 100)
      const flashPct = Math.round((flashVisits / totalEvents) * 100)
      const masterPct = 100 - (freePct + practicePct + flashPct)

      const totalTimeEvents = totalSecs || 1
      const freeTimePct = totalSecs > 0 ? Math.round((freeSeconds / totalTimeEvents) * 100) : 0
      const practiceTimePct = totalSecs > 0 ? Math.round((practiceSeconds / totalTimeEvents) * 100) : 0
      const flashTimePct = totalSecs > 0 ? Math.round((flashSeconds / totalTimeEvents) * 100) : 0
      const masterTimePct = totalSecs > 0 ? (100 - (freeTimePct + practiceTimePct + flashTimePct)) : 0

      return {
        route: p.route_path,
        views: totalVisits,
        totalSecs,
        hours: parseFloat((totalSecs / 3600).toFixed(1)),
        freeVisits,
        practiceVisits,
        flashVisits,
        masterVisits,
        freeSeconds,
        practiceSeconds,
        flashSeconds,
        masterSeconds,
        freePct,
        practicePct,
        flashPct,
        masterPct,
        freeTimePct,
        practiceTimePct,
        flashTimePct,
        masterTimePct,
        formattedTime: formatSecsToTime(totalSecs),
        freeFormattedTime: formatSecsToTime(freeSeconds),
        practiceFormattedTime: formatSecsToTime(practiceSeconds),
        flashFormattedTime: formatSecsToTime(flashSeconds),
        masterFormattedTime: formatSecsToTime(masterSeconds)
      }
    }).sort((a, b) => b.views - a.views).slice(0, 15)

    // 5. Recent Live Terminal Logs from active session cache / recent events fallback
    let terminalLogs = []
    const { data: rawEvents } = await supabaseAdmin
      .from('telemetry_events')
      .select('id, event_type, event_name, route_path, user_tier, created_at')
      .order('created_at', { ascending: false })
      .limit(30)

    if (rawEvents && rawEvents.length > 0) {
      terminalLogs = rawEvents.map(e => ({
        id: e.id,
        timestamp: e.created_at,
        type: e.event_type,
        name: e.event_name,
        route: e.route_path,
        tier: e.user_tier?.toUpperCase() || 'FREE'
      }))
    }

    return {
      success: true,
      data: {
        ticker: {
          onlineCount: activeCount || 0,
          activeSessionsList: activeSessionsList || [],
          totalSessions: totalSessionsCount || 0,
          classHoursWatched: parseFloat((totalClassSeconds / 3600).toFixed(1)),
          classTimeWatchedFormatted: `${Math.floor(totalClassSeconds / 3600)}h ${Math.floor((totalClassSeconds % 3600) / 60)}m`,
          testStarts: totalTestStarts,
          testSubmits: totalTestSubmits,
          completionRate: totalTestStarts > 0 ? Math.round((totalTestSubmits / totalTestStarts) * 100) : 0,
          pendingBugs: 0, // Held per user instructions
          criticalBugs: 0
        },
        testFunnels: testFunnelList,
        classList,
        pageList,
        terminalLogs
      }
    }
  } catch (err) {
    console.error('fetchAnalyticsDashboardAction error:', err)
    return { error: `Server Error: ${err.message}` }
  }
}

// In-memory or database state for active cron configuration (defaults to 0 0 * * * -> 6 AM BST)
let activeCronSchedule = {
  cronExpr: '0 0 * * *',
  hourUtc: 0,
  minuteUtc: 0,
  bstHour: 6,
  bstMinute: 0,
  label: '6:00 AM Bangladesh Time (Midnight UTC)'
}

export async function getUniversalUpdateScheduleAction() {
  return { success: true, schedule: activeCronSchedule }
}

export async function updateUniversalUpdateScheduleAction({ hourUtc = 0, minuteUtc = 0 }) {
  try {
    const h = parseInt(hourUtc, 10) || 0
    const m = parseInt(minuteUtc, 10) || 0
    const cronExpr = `${m} ${h} * * *`
    
    const bstH = (h + 6) % 24
    const bstTimeFormatted = `${bstH === 0 ? 12 : bstH > 12 ? bstH - 12 : bstH}:${m.toString().padStart(2, '0')} ${bstH >= 12 ? 'PM' : 'AM'}`
    const utcTimeFormatted = `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`

    activeCronSchedule = {
      cronExpr,
      hourUtc: h,
      minuteUtc: m,
      bstHour: bstH,
      bstMinute: m,
      label: `${bstTimeFormatted} Bangladesh Time (${utcTimeFormatted} UTC)`
    }

    // Update via pg_cron rpc on both databases
    const resUser = await supabaseAdmin.rpc('set_universal_cron', { p_cron_expr: cronExpr, p_job: 'universal-daily-telemetry-prune-userdb', p_cmd: 'SELECT public.prune_userdb_daily_deltas();' })
    const resContent = await contentAdminClient.rpc('set_universal_cron', { p_cron_expr: cronExpr, p_job: 'universal-daily-telemetry-prune-contentdb', p_cmd: 'SELECT public.prune_content_daily_deltas();' })

    if (resUser.error || resContent.error) {
      const errMsg = resUser.error?.message || resContent.error?.message || 'Unknown database RPC error'
      console.error('set_universal_cron database error:', resUser.error || resContent.error)
      return { error: `Database cron update failed: ${errMsg}. Make sure you ran the set_universal_cron SQL helper in your Supabase SQL Editor!` }
    }

    return { success: true, schedule: activeCronSchedule }
  } catch (err) {
    console.error('updateUniversalUpdateScheduleAction error:', err)
    return { error: `Failed to update schedule: ${err.message}` }
  }
}
