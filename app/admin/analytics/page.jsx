'use client'

import React, { useState, useEffect } from 'react'
import { fetchAnalyticsDashboardAction } from '@/app/actions/telemetryActions'
import { AnalyticsHeader } from './components/AnalyticsHeader'
import { MetricTicker } from './components/MetricTicker'
import { TestFunnelChart } from './components/TestFunnelChart'
import { ClassEngagementMatrix } from './components/ClassEngagementMatrix'
import { PageTrafficHeatmap } from './components/PageTrafficHeatmap'
import { TerminalFeed } from './components/TerminalFeed'

export default function AnalyticsCommandCenterPage() {
  const [timeRange, setTimeRange] = useState('14d')
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [dashboardData, setDashboardData] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  const loadData = async (forceSync = false) => {
    if (forceSync) setIsRefreshing(true)
    else setLoading(true)
    setErrorMsg(null)

    const res = await fetchAnalyticsDashboardAction(timeRange)
    if (res.error) {
      setErrorMsg(res.error)
    } else if (res.success && res.data) {
      setDashboardData(res.data)
    }

    if (forceSync) setIsRefreshing(false)
    else setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [timeRange])

  return (
    <div className="min-h-screen bg-[#0A0E17] text-gray-100 p-4 md:p-8 space-y-6 selection:bg-cyan-500 selection:text-black">
      {/* Header Bar */}
      <AnalyticsHeader
        timeRange={timeRange}
        onTimeRangeChange={(range) => setTimeRange(range)}
        onRefresh={() => loadData(true)}
        isRefreshing={isRefreshing}
        onlineCount={dashboardData?.ticker?.onlineCount || 0}
      />

      {/* Error State / SQL Notification */}
      {errorMsg && (
        <div className="bg-pink-950/40 border border-pink-500/60 rounded-2xl p-6 text-pink-300 font-mono shadow-[0_0_25px_rgba(255,0,85,0.2)] flex items-start gap-4">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-bold text-base text-white uppercase font-sans">System Notification or Database Warning</h3>
            <p className="text-xs mt-1 leading-relaxed">{errorMsg}</p>
            <p className="text-[11px] text-gray-400 mt-2">
              Tip: If you haven&apos;t run the SQL migration scripts on your databases yet, please run `database/telemetry_migration_content_db.sql` on Content DB and `database/telemetry_migration_user_db.sql` on User DB inside your Supabase SQL Editors to enable full 4-tier columnar telemetry storage!
            </p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-28 bg-[#111827] rounded-2xl border border-gray-800" />
            ))}
          </div>
          <div className="h-80 bg-[#111827] rounded-2xl border border-gray-800" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 bg-[#111827] rounded-2xl border border-gray-800" />
            <div className="h-96 bg-[#111827] rounded-2xl border border-gray-800" />
          </div>
        </div>
      ) : (
        <>
          {/* Top Metric Ticker */}
          <MetricTicker ticker={dashboardData?.ticker || {}} />

          {/* Section 1: Test Start vs Completion Funnel (with Tier Breakdown) */}
          <TestFunnelChart testFunnels={dashboardData?.testFunnels || []} />

          {/* Section 2: Class Engagement & Page Traffic Leaderboards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ClassEngagementMatrix classList={dashboardData?.classList || []} />
            <div className="lg:col-span-1">
              <PageTrafficHeatmap pageList={dashboardData?.pageList || []} />
            </div>
          </div>

          {/* Section 3: Live Terminal Stream */}
          <div className="grid grid-cols-1 gap-6">
            <div className="h-full">
              <TerminalFeed terminalLogs={dashboardData?.terminalLogs || []} />
            </div>
            
            <div className="p-5 rounded-2xl bg-[#111827]/90 border border-pink-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_25px_rgba(255,0,85,0.15)] font-mono">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400 text-2xl shrink-0 animate-pulse">
                  🔥
                </div>
                <div>
                  <h3 className="font-bold text-white text-base font-sans uppercase">Looking for the Bug Triage Board?</h3>
                  <p className="text-xs text-gray-400 font-sans mt-0.5">
                    We upgraded bug management to its own standalone 3-tier Command Center with Question-Bank style filtering!
                  </p>
                </div>
              </div>
              <a
                href="/admin/bug-reports"
                className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-[0_0_15px_rgba(255,0,128,0.3)] shrink-0"
              >
                Launch Bug Triage Center →
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
