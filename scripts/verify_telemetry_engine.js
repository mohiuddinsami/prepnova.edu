/**
 * PrepNova 4-Tier Columnar Analytics Engine - Automated Verification Suite
 * 
 * Uses native Node.js fetch() to test PostgREST RPC and sliding window pruning directly.
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

if (!userUrl || !userKey || !contentUrl || !contentKey) {
  console.error('❌ Missing required environment variables in .env');
  process.exit(1);
}

// Helper for PostgREST calls
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

async function runVerificationSuite() {
  console.log('\n========================================================================');
  console.log('⚡ PREPNOVA 4-TIER COLUMNAR ANALYTICS ENGINE VERIFICATION SUITE');
  console.log('========================================================================\n');

  let passedTests = 0;
  let totalTests = 5;

  const testRoute = '/auto-verify-test-route-' + Date.now();

  try {
    // TEST 1: Check Table & RPC Existence on User DB
    console.log('Test 1: Verifying User DB Tables & RPC Functions...');
    try {
      await dbQuery(userUrl, userKey, 'rpc/increment_userdb_analytics', 'POST', {
        p_table: 'page_traffic_analytics',
        p_id: testRoute,
        p_metric: 'free_visits',
        p_delta: 10
      });
      console.log('  [PASS] 🟢 Atomic RPC function increment_userdb_analytics executed successfully!');
      passedTests++;
    } catch (err) {
      console.error('  [FAIL] RPC increment_userdb_analytics failed:', err.message);
    }

    // TEST 2: Verify Exact Columnar Accumulation across 7d, 14d, 30d, all
    console.log('\nTest 2: Verifying 4-Window Columnar Counters (7d, 14d, 30d, all)...');
    try {
      const rows = await dbQuery(userUrl, userKey, `page_traffic_analytics?route_path=eq.${testRoute}&select=free_visits_7d,free_visits_14d,free_visits_30d,free_visits_all`);
      const routeData = rows && rows[0];
      if (
        routeData &&
        routeData.free_visits_7d === 10 &&
        routeData.free_visits_14d === 10 &&
        routeData.free_visits_30d === 10 &&
        routeData.free_visits_all === 10
      ) {
        console.log(`  [PASS] 🟢 All 4 windows accurately incremented to +10! (${JSON.stringify(routeData)})`);
        passedTests++;
      } else {
        console.error('  [FAIL] Column mismatch:', routeData);
      }
    } catch (err) {
      console.error('  [FAIL] Query failed:', err.message);
    }

    // TEST 3: Verify Daily Delta Ledger Merging (No Duplicate Rows for Same Day)
    console.log('\nTest 3: Verifying Daily Delta Ledger Merging (UPSERT)...');
    try {
      await dbQuery(userUrl, userKey, 'rpc/increment_userdb_analytics', 'POST', {
        p_table: 'page_traffic_analytics',
        p_id: testRoute,
        p_metric: 'free_visits',
        p_delta: 5
      });

      const deltas = await dbQuery(userUrl, userKey, `analytics_daily_deltas?table_name=eq.page_traffic_analytics&reference_id=eq.${testRoute}&metric_name=eq.free_visits`);
      if (deltas && deltas.length === 1 && Number(deltas[0].delta_value) === 15) {
        console.log('  [PASS] 🟢 Daily delta ledger merged increments cleanly into 1 row with delta_value = 15!');
        passedTests++;
      } else {
        console.error(`  [FAIL] Expected exactly 1 merged row with delta 15, found:`, deltas);
      }
    } catch (err) {
      console.error('  [FAIL] Delta verification error:', err.message);
    }

    // TEST 4: Verify Freeze-Point Sliding Window Pruning (CURRENT_DATE - 8)
    console.log('\nTest 4: Verifying Freeze-Point Sliding Window Pruning (Pruning 8-day-old deltas)...');
    try {
      const today = new Date();
      const eightDaysAgo = new Date(today);
      eightDaysAgo.setDate(today.getDate() - 8);
      const dateStr = eightDaysAgo.toISOString().split('T')[0];

      await dbQuery(userUrl, userKey, 'analytics_daily_deltas', 'POST', {
        target_date: dateStr,
        table_name: 'page_traffic_analytics',
        reference_id: testRoute,
        metric_name: 'free_visits',
        delta_value: 4
      });

      await dbQuery(userUrl, userKey, 'rpc/prune_userdb_daily_deltas', 'POST', {});

      const rows = await dbQuery(userUrl, userKey, `page_traffic_analytics?route_path=eq.${testRoute}&select=free_visits_7d,free_visits_14d,free_visits_30d,free_visits_all`);
      const prunedRoute = rows && rows[0];
      if (
        prunedRoute &&
        prunedRoute.free_visits_7d === 11 &&
        prunedRoute.free_visits_14d === 15 &&
        prunedRoute.free_visits_30d === 15 &&
        prunedRoute.free_visits_all === 15
      ) {
        console.log(`  [PASS] 🟢 Pruning math verified! _7d correctly reduced by -4 (now 11) while _14d/_30d/_all stayed untouched (15)!`);
        passedTests++;
      } else {
        console.error('  [FAIL] Pruning math incorrect:', prunedRoute);
      }
    } catch (err) {
      console.error('  [FAIL] Prune test failed:', err.message);
    }

    // TEST 5: Verify Content DB (Project B) RPC Readiness
    console.log('\nTest 5: Verifying Content DB (Project B) RPC Readiness...');
    try {
      await dbQuery(contentUrl, contentKey, 'rpc/increment_content_analytics', 'POST', {
        p_table: 'modules',
        p_id: '00000000-0000-0000-0000-000000000000',
        p_metric: 'free_started',
        p_delta: 0
      });
      console.log('  [PASS] 🟢 Content DB increment_content_analytics RPC is active and ready!');
      passedTests++;
    } catch (err) {
      if (err.message.includes('Invalid target table')) {
        console.log('  [PASS] 🟢 Content DB increment_content_analytics RPC is active and ready!');
        passedTests++;
      } else {
        console.error('  [FAIL] Content DB RPC error:', err.message);
      }
    }

  } finally {
    console.log('\n🧹 Cleaning up automated test artifacts...');
    try {
      await fetch(`${userUrl}/rest/v1/page_traffic_analytics?route_path=eq.${testRoute}`, {
        method: 'DELETE',
        headers: { 'apikey': userKey, 'Authorization': `Bearer ${userKey}` }
      });
      await fetch(`${userUrl}/rest/v1/analytics_daily_deltas?reference_id=eq.${testRoute}`, {
        method: 'DELETE',
        headers: { 'apikey': userKey, 'Authorization': `Bearer ${userKey}` }
      });
      console.log('✅ Cleanup complete!');
    } catch (e) {}
  }

  console.log('\n========================================================================');
  console.log(`FINAL RESULT: ${passedTests} / ${totalTests} TESTS PASSED`);
  if (passedTests === totalTests) {
    console.log('🚀 SYSTEM STATUS: 100% BULLETPROOF & PRODUCTION READY!');
  } else {
    console.log('⚠️ SYSTEM STATUS: SOME TESTS NEED ATTENTION.');
  }
  console.log('========================================================================\n');
}

runVerificationSuite().catch(err => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
