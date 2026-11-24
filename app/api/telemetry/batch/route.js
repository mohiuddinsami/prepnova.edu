import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

const supabaseContentAdmin = createClient(
  process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Validate category is one of the exact 4 tiers
const getValidCategory = (tier) => {
  if (['free', 'practice', 'flash', 'master'].includes(tier)) return tier
  return null
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey'
    }
  })
}

const normalizeRouteForAnalytics = (rawPath) => {
  if (!rawPath || typeof rawPath !== 'string') return '/'
  const clean = rawPath.split('?')[0].split('#')[0].trim()
  if (clean.startsWith('/test/')) return '/test/[id]'
  if (clean.startsWith('/quiz/')) return '/quiz/[id]'
  if (clean.startsWith('/class/')) return '/class/[id]'
  if (clean.startsWith('/dashboard/history/')) return '/dashboard/history'
  if (clean.startsWith('/dashboard/practice-tests/')) return '/dashboard/practice-tests'
  if (clean.startsWith('/dashboard/modules/')) return '/dashboard/modules'
  if (clean.startsWith('/dashboard/classes/')) return '/dashboard/classes'
  return clean
}

export async function POST(req) {
  try {
    const rawText = await req.text()
    if (!rawText || !rawText.trim()) {
      return NextResponse.json({ success: true, status: 'empty_payload', count: 0 })
    }
    let payload
    try {
      payload = JSON.parse(rawText)
    } catch (parseErr) {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 })
    }
    const { sessionToken, userTier = 'free', userId = null, deviceType = 'desktop', browserName = 'unknown', osName = 'unknown', events = [] } = payload || {}

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Missing sessionToken' }, { status: 400 })
    }

    // 1. Always upsert active session heartbeat in telemetry_sessions (User DB)
    try {
      await supabaseAdmin
        .from('telemetry_sessions')
        .upsert({
          session_token: sessionToken,
          user_id: userId,
          user_tier: userTier,
          device_type: deviceType,
          browser_name: browserName,
          os_name: osName,
          last_seen_at: new Date().toISOString()
        }, { onConflict: 'session_token' })
    } catch (sessionErr) {
      // Non-fatal if session table is not created yet
    }

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ success: true, status: 'session_heartbeat_only', count: 0 })
    }

    const category = getValidCategory(userTier)

    // If category is null (e.g. guest 0 or tester 3/5/7), ignore columnar increments per user requirement
    if (!category) {
      return NextResponse.json({ success: true, status: 'ignored_tester_or_guest', count: events.length })
    }

    // 2. Process columnar aggregate increments
    let processedCount = 0
    for (const e of events) {
      const eventCategory = getValidCategory(e.userTier || category)
      if (!eventCategory) continue

      const duration = parseInt(e.durationSeconds || 0, 10)
      const routePath = e.routePath || '/'

      // Content DB: practice_tests
      if (e.targetTestId) {
        try {
          if (e.eventType === 'test_start') {
            await supabaseContentAdmin.rpc('increment_content_analytics', {
              p_table: 'practice_tests', p_id: e.targetTestId, p_metric: `${eventCategory}_started`, p_delta: 1
            })
            processedCount++
          } else if (e.eventType === 'test_submit') {
            await supabaseContentAdmin.rpc('increment_content_analytics', {
              p_table: 'practice_tests', p_id: e.targetTestId, p_metric: `${eventCategory}_submitted`, p_delta: 1
            })
            processedCount++
          }
        } catch (rpcErr) {}
      }

      // Content DB: modules
      if (e.targetModuleId) {
        try {
          if (e.eventType === 'module_start' || e.eventType === 'module_attempt') {
            await supabaseContentAdmin.rpc('increment_content_analytics', {
              p_table: 'modules', p_id: e.targetModuleId, p_metric: `${eventCategory}_started`, p_delta: 1
            })
            processedCount++
          } else if (e.eventType === 'module_submit') {
            await supabaseContentAdmin.rpc('increment_content_analytics', {
              p_table: 'modules', p_id: e.targetModuleId, p_metric: `${eventCategory}_submitted`, p_delta: 1
            })
            processedCount++
          }
        } catch (rpcErr) {}
      }

      // User DB: classes
      if (e.targetClassId || routePath.startsWith('/class/')) {
        const rawId = e.targetClassId || routePath.replace('/class/', '')
        const classId = rawId.split('?')[0].split('/')[0].trim()
        if (classId) {
          try {
            if (duration > 0) {
              await supabaseAdmin.rpc('increment_userdb_analytics', {
                p_table: 'classes', p_id: classId, p_metric: `${eventCategory}_seconds`, p_delta: duration
              })
            }
            if (e.eventType === 'class_click' || (e.eventType === 'page_view' && routePath.startsWith('/class/'))) {
              await supabaseAdmin.rpc('increment_userdb_analytics', {
                p_table: 'classes', p_id: classId, p_metric: `${eventCategory}_clicks`, p_delta: 1
              })
            }
            processedCount++
          } catch (rpcErr) {}
        }
      } else if (!e.targetTestId && !e.targetModuleId) {
        // User DB: general page_traffic_analytics
        try {
          const cleanRoute = normalizeRouteForAnalytics(routePath)
          if (duration > 0) {
            await supabaseAdmin.rpc('increment_userdb_analytics', {
              p_table: 'page_traffic_analytics', p_id: cleanRoute, p_metric: `${eventCategory}_seconds`, p_delta: duration
            })
          }
          if (e.eventType === 'page_view') {
            await supabaseAdmin.rpc('increment_userdb_analytics', {
              p_table: 'page_traffic_analytics', p_id: cleanRoute, p_metric: `${eventCategory}_visits`, p_delta: 1
            })
          }
          processedCount++
        } catch (rpcErr) {}
      }
    }

    return NextResponse.json({ success: true, processed: processedCount, count: events.length })
  } catch (err) {
    console.error('Batch telemetry endpoint error:', err)
    return NextResponse.json({ success: false, error: `Malformed request payload: ${err?.message || err}`, stack: err?.stack }, { status: 400 })
  }
}
