'use client'

import React from 'react'

export function AnalyticsHeader({ timeRange = '14d', onTimeRangeChange, onRefresh, isRefreshing = false, onlineCount = 0 }) {
  const ranges = [
    { id: '7d', label: '7 DAYS' },
    { id: '14d', label: '14 DAYS' },
    { id: '30d', label: '30 DAYS' },
    { id: 'all', label: 'ALL TIME' }
  ]

  return (
    <div className="bg-[#0A0E17]/90 border border-cyan-500/50 rounded-2xl p-6 shadow-[0_0_30px_rgba(0,240,255,0.15)] relative overflow-hidden backdrop-blur-md">
      {/* Scanline top glow */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Title Section */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 uppercase tracking-widest shadow-[0_0_8px_rgba(0,240,255,0.3)]">
              CLEARANCE LEVEL 9
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              SYSTEM ONLINE ({onlineCount} ACTIVE USERS)
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white font-sans uppercase">
            Cyberpunk <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">Hacker Arena</span>
          </h1>
          <p className="text-xs font-mono text-gray-400 mt-1">
            Real-Time Telemetry, Class Engagement, Tier Funnels & Bug Triage Command Room
          </p>
        </div>

        {/* Right Controls Section */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Toggle Bar */}
          <div className="bg-[#111827] p-1 rounded-xl border border-gray-800 flex items-center shadow-inner font-mono text-xs">
            {ranges.map(r => (
              <button
                key={r.id}
                onClick={() => onTimeRangeChange?.(r.id)}
                className={`px-3 py-1.5 rounded-lg transition-all font-bold tracking-wider ${
                  timeRange === r.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/80 shadow-[0_0_10px_rgba(0,240,255,0.25)]'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Refresh Action */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2.5 bg-gray-900 hover:bg-gray-800 text-cyan-400 border border-cyan-500/40 rounded-xl transition-all shadow-[0_0_12px_rgba(0,240,255,0.15)] hover:shadow-[0_0_18px_rgba(0,240,255,0.3)] disabled:opacity-50 font-mono text-xs flex items-center gap-2"
            title="Force Synchronize Data"
          >
            <svg
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-300' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline font-bold">SYNC</span>
          </button>
        </div>
      </div>
    </div>
  )
}
