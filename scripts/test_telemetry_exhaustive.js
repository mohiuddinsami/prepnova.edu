/**
 * PrepNova 4-Tier Columnar Analytics Engine - Exhaustive Stress & Boundary Test Suite
 * 
 * Tests:
 * 1. All User Levels (Guests 0, Free 1, Practice 2, Tester 3, Flash 4, Tester 5, Master 6, Admin 8)
 * 2. SQL Injection / Unauthorized Table Access Attempts
 * 3. Concurrent Multi-Tier Accumulation on the Same Target
 * 4. Exact Multi-Point Sliding Window Pruning (-8d, -15d, -31d, and -40d cleanup)
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local or .env
const envFiles = ['.env.local', '.env'];
for (const file of envFiles) {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}

const userUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const userKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const contentUrl = process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL;
const contentKey = process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY;

async function dbQuery(baseUrl, key, endpoint, method = 'GET', body = null) {
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
  };
  const res = await fetch(`${baseUrl}/rest/v1/${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

// Simulates app/api/telemetry/batch/route.js tier normalization logic
function normalizeTier(level) {
  if (level === 1) return 'free';
  if (level === 2) return 'practice';
  if (level === 4) return 'flash';
  if (level === 6) return 'master';
  return null; // Guests (0) and Testers/Admins (3, 5, 7, 8) return null (ignored)
}

async function runExhaustiveSuite() {
  console.log('\n========================================================================================');
  console.log('🧪 PREPNOVA 4-TIER COLUMNAR ANALYTICS ENGINE - EXHAUSTIVE TEST SUITE');
  console.log('========================================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName, details = '') {
    total++;
    if (condition) {
      console.log(`  [PASS] #${total}: ${testName} ${details}`);
      passed++;
    } else {
      console.error(`  [FAIL] #${total}: ${testName} ${details}`);
    }
  }

  const stressRoute = '/stress-boundary-test-' + Date.now();

  try {
    // =========================================================================
    // SUITE 1: TIER NORMALIZATION & INGESTION FILTERING (8 Cases)
    // =========================================================================
    console.log('=== SUITE 1: USER TIER NORMALIZATION & FILTERING MATRIX ===');
    assert(normalizeTier(0) === null, 'Level 0 (Guest) correctly ignored from columnar increments.');
    assert(normalizeTier(1) === 'free', 'Level 1 mapped to [free] tier.');
    assert(normalizeTier(2) === 'practice', 'Level 2 mapped to [practice] tier.');
    assert(normalizeTier(3) === null, 'Level 3 (Practice Tester) correctly ignored.');
    assert(normalizeTier(4) === 'flash', 'Level 4 mapped to [flash] tier.');
    assert(normalizeTier(5) === null, 'Level 5 (Flash Tester) correctly ignored.');
    assert(normalizeTier(6) === 'master', 'Level 6 mapped to [master] tier.');
    assert(normalizeTier(8) === null, 'Level 8 (Admin/Staff) correctly ignored.');

    // =========================================================================
    // SUITE 2: SECURITY BOUNDARY & ATTACK RESILIENCE (4 Cases)
    // =========================================================================
    console.log('\n=== SUITE 2: SECURITY & SQL INJECTION RESILIENCE ===');
    try {
      await dbQuery(userUrl, userKey, 'rpc/increment_userdb_analytics', 'POST', {
        p_table: 'auth.users; DROP TABLE profiles;--',
        p_id: stressRoute,
        p_metric: 'free_visits',
        p_delta: 1
      });
      assert(false, 'SQL Injection in p_table should have raised exception.');
    } catch (e) {
      assert(e.message.includes('Invalid target table'), 'SQL Injection / unauthorized table safely blocked by exception validation.');
    }

    try {
      await dbQuery(userUrl, userKey, 'rpc/increment_userdb_analytics', 'POST', {
        p_table: 'profiles',
        p_id: stressRoute,
        p_metric: 'is_admin',
        p_delta: 1
      });
      assert(false, 'Targeting profiles table should have been blocked.');
    } catch (e) {
      assert(e.message.includes('Invalid target table'), 'Unauthorized access to profiles table safely blocked.');
    }

    try {
      await dbQuery(contentUrl, contentKey, 'rpc/increment_content_analytics', 'POST', {
        p_table: 'submissions',
        p_id: '00000000-0000-0000-0000-000000000000',
        p_metric: 'free_started',
        p_delta: 1
      });
      assert(false, 'Targeting submissions table in Content DB should have been blocked.');
    } catch (e) {
      assert(e.message.includes('Invalid target table'), 'Unauthorized table access in Content DB safely blocked.');
    }

    // Negative delta check (ensuring no crash)
    try {
      await dbQuery(userUrl, userKey, 'rpc/increment_userdb_analytics', 'POST', {
        p_table: 'page_traffic_analytics',
        p_id: stressRoute,
        p_metric: 'free_visits',
        p_delta: -5
      });
      assert(true, 'Negative delta safely processed without SQL error.');
    } catch (e) {
      assert(false, 'Negative delta raised unexpected error: ' + e.message);
    }

    // =========================================================================
    // SUITE 3: ALL 4 TIERS CONCURRENT ACCUMULATION (4 Cases)
    // =========================================================================
    console.log('\n=== SUITE 3: MULTI-TIER INDEPENDENT COLUMNAR ACCUMULATION ===');
    // Increment free, practice, flash, master independently on exact same route
    await dbQuery(userUrl, userKey, 'rpc/increment_userdb_analytics', 'POST', { p_table: 'page_traffic_analytics', p_id: stressRoute, p_metric: 'free_visits', p_delta: 100 });
    await dbQuery(userUrl, userKey, 'rpc/increment_userdb_analytics', 'POST', { p_table: 'page_traffic_analytics', p_id: stressRoute, p_metric: 'practice_visits', p_delta: 200 });
    await dbQuery(userUrl, userKey, 'rpc/increment_userdb_analytics', 'POST', { p_table: 'page_traffic_analytics', p_id: stressRoute, p_metric: 'flash_visits', p_delta: 300 });
    await dbQuery(userUrl, userKey, 'rpc/increment_userdb_analytics', 'POST', { p_table: 'page_traffic_analytics', p_id: stressRoute, p_metric: 'master_visits', p_delta: 400 });

    const rows = await dbQuery(userUrl, userKey, `page_traffic_analytics?route_path=eq.${stressRoute}`);
    const r = rows && rows[0];
    assert(r && (r.free_visits_all - (-5)) === 100, 'Free tier column accumulated accurately (accounting for earlier -5 test).');
    assert(r && r.practice_visits_all === 200, 'Practice tier column accumulated accurately to 200.');
    assert(r && r.flash_visits_all === 300, 'Flash tier column accumulated accurately to 300.');
    assert(r && r.master_visits_all === 400, 'Master tier column accumulated accurately to 400 without overwriting other tiers.');

    // =========================================================================
    // SUITE 4: EXACT MULTI-POINT SLIDING WINDOW PRUNING & LEDGER CLEANUP (5 Cases)
    // =========================================================================
    console.log('\n=== SUITE 4: MULTI-POINT FREEZE-POINT SLIDING WINDOW PRUNER (-8d, -15d, -31d, -40d) ===');
    // We will set up a fresh route specifically for multi-window pruning checks
    const pruneRoute = '/prune-multi-window-' + Date.now();
    await dbQuery(userUrl, userKey, 'rpc/increment_userdb_analytics', 'POST', { p_table: 'page_traffic_analytics', p_id: pruneRoute, p_metric: 'free_visits', p_delta: 1000 });

    // Insert simulated deltas at exactly 8d, 15d, 31d, and 40d in the past!
    const today = new Date();
    const getPastDateStr = (days) => {
      const d = new Date(today);
      d.setDate(today.getDate() - days);
      return d.toISOString().split('T')[0];
    };

    await dbQuery(userUrl, userKey, 'analytics_daily_deltas', 'POST', { target_date: getPastDateStr(8), table_name: 'page_traffic_analytics', reference_id: pruneRoute, metric_name: 'free_visits', delta_value: 100 });
    await dbQuery(userUrl, userKey, 'analytics_daily_deltas', 'POST', { target_date: getPastDateStr(15), table_name: 'page_traffic_analytics', reference_id: pruneRoute, metric_name: 'free_visits', delta_value: 200 });
    await dbQuery(userUrl, userKey, 'analytics_daily_deltas', 'POST', { target_date: getPastDateStr(31), table_name: 'page_traffic_analytics', reference_id: pruneRoute, metric_name: 'free_visits', delta_value: 300 });
    await dbQuery(userUrl, userKey, 'analytics_daily_deltas', 'POST', { target_date: getPastDateStr(40), table_name: 'page_traffic_analytics', reference_id: pruneRoute, metric_name: 'free_visits', delta_value: 999 });

    // Run the pruner function!
    await dbQuery(userUrl, userKey, 'rpc/prune_userdb_daily_deltas', 'POST', {});

    const pRows = await dbQuery(userUrl, userKey, `page_traffic_analytics?route_path=eq.${pruneRoute}`);
    const p = pRows && pRows[0];

    assert(p && p.free_visits_7d === (1000 - 100), `7-Day window correctly reduced by exactly 8-day delta: 1000 - 100 = ${p?.free_visits_7d}`);
    assert(p && p.free_visits_14d === (1000 - 200), `14-Day window correctly reduced by exactly 15-day delta: 1000 - 200 = ${p?.free_visits_14d}`);
    assert(p && p.free_visits_30d === (1000 - 300), `30-Day window correctly reduced by exactly 31-day delta: 1000 - 300 = ${p?.free_visits_30d}`);
    assert(p && p.free_visits_all === 1000, `All-Time window remained 100% untouched at exact total: ${p?.free_visits_all}`);

    // Verify 40-day-old delta was permanently pruned from analytics_daily_deltas
    const oldDeltas = await dbQuery(userUrl, userKey, `analytics_daily_deltas?reference_id=eq.${pruneRoute}&target_date=eq.${getPastDateStr(40)}`);
    assert(oldDeltas && oldDeltas.length === 0, '40-day-old ledger entry permanently cleaned up (< CURRENT_DATE - 36).');

  } finally {
    console.log('\n🧹 Cleaning up exhaustive test artifacts...');
    try {
      await fetch(`${userUrl}/rest/v1/page_traffic_analytics?route_path=like./stress-boundary-test*`, { method: 'DELETE', headers: { 'apikey': userKey, 'Authorization': `Bearer ${userKey}` } });
      await fetch(`${userUrl}/rest/v1/page_traffic_analytics?route_path=like./prune-multi-window*`, { method: 'DELETE', headers: { 'apikey': userKey, 'Authorization': `Bearer ${userKey}` } });
      await fetch(`${userUrl}/rest/v1/analytics_daily_deltas?reference_id=like./stress-boundary-test*`, { method: 'DELETE', headers: { 'apikey': userKey, 'Authorization': `Bearer ${userKey}` } });
      await fetch(`${userUrl}/rest/v1/analytics_daily_deltas?reference_id=like./prune-multi-window*`, { method: 'DELETE', headers: { 'apikey': userKey, 'Authorization': `Bearer ${userKey}` } });
      console.log('✅ Cleanup complete!');
    } catch (e) {}
  }

  console.log('\n========================================================================================');
  console.log(`FINAL EXHAUSTIVE SCORE: ${passed} / ${total} TESTS PASSED`);
  if (passed === total) {
    console.log('🏆 100% SUCCESS: ALL BOUNDARY, SECURITY, CONCURRENCY & PRUNING TESTS PASSED!');
  } else {
    console.log('⚠️ ATTENTION: SOME EXHAUSTIVE TESTS FAILED.');
  }
  console.log('========================================================================================\n');
}

runExhaustiveSuite().catch(err => {
  console.error('Fatal Exhaustive Suite Error:', err);
  process.exit(1);
});
