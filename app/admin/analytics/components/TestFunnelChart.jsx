'use client'

import React, { useState } from 'react'

const CHART_COLORS = [
  '#00F0FF', // Neon Cyan
  '#8B5CF6', // Purple 500
  '#10B981', // Emerald 500
  '#F59E0B', // Amber 500
  '#EC4899', // Pink 500
  '#3B82F6', // Blue 500
  '#14B8A6', // Teal 500
  '#F97316', // Orange 500
  '#6366F1', // Indigo 500
  '#84CC16'  // Lime 500
]

export function TestFunnelChart({ testFunnels = [] }) {
  const [viewMode, setViewMode] = useState('overall') // 'overall' | 'tier' | 'table'
  const [hoveredIdx, setHoveredIdx] = useState(null)

  if (!testFunnels || testFunnels.length === 0) {
    return (
      <div className="bg-[#0A0E17]/90 border border-gray-800 rounded-2xl p-8 text-center text-gray-500 font-mono">
        No practice test telemetry starts recorded within this time window yet.
      </div>
    )
  }

  // Find max starts for relative bar sizing
  const maxStarts = Math.max(...testFunnels.map(t => t.totalStarts || 1), 1)

  // Calculate total starts across all practice tests for the Pie/Donut chart
  const topTests = testFunnels.slice(0, 10)
  const actualStartsVolume = topTests.reduce((acc, t) => acc + (t.totalStarts || 0), 0)
  const volumeForDivision = actualStartsVolume || 1

  // Prepare Donut Chart segments (r = 65, circumference = 2 * Math.PI * 65 ≈ 408.4)
  const RADIUS = 65
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  let currentOffset = 0

  const chartSegments = topTests.map((t, idx) => {
    const itemStarts = t.totalStarts || 0
    const share = Math.round((itemStarts / volumeForDivision) * 1000) / 10 // e.g. 45.2%
    const sliceLength = (itemStarts / volumeForDivision) * CIRCUMFERENCE
    const offset = currentOffset
    currentOffset += sliceLength

    return {
      ...t,
      idx,
      itemStarts,
      share,
      sliceLength,
      offset,
      color: CHART_COLORS[idx % CHART_COLORS.length]
    }
  })

  return (
    <div className="bg-[#0A0E17]/95 border border-cyan-500/50 rounded-2xl p-6 shadow-[0_0_30px_rgba(0,240,255,0.15)] relative overflow-hidden backdrop-blur-md">
      {/* Top Header & Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-800 mb-6">
        <div>
          <h2 className="text-lg font-black tracking-wider text-white uppercase font-sans flex items-center gap-2">
            <span className="text-cyan-400">📊</span> Test Start vs Completion Funnel
          </h2>
          <p className="text-xs font-mono text-gray-400">
            Comparing top-of-funnel starts vs submission rates, segmented by subscription tier
          </p>
        </div>

        <div className="flex items-center bg-[#111827] p-1 rounded-xl border border-gray-800 font-mono text-xs">
          <button
            onClick={() => setViewMode('overall')}
            className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
              viewMode === 'overall'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            OVERALL FUNNEL
          </button>
          <button
            onClick={() => setViewMode('tier')}
            className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
              viewMode === 'tier'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            TIER BREAKDOWN (FREE vs MASTER)
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
              viewMode === 'table'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            DATA MATRIX
          </button>
        </div>
      </div>

      {/* Combined Overview Panel: Donut/Pie Chart + Distribution Legend */}
      <div className="bg-gray-950/80 border border-gray-800/90 rounded-2xl p-6 mb-8 relative z-10 shadow-inner">
        <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-gray-850">
          <span className="text-xs font-mono font-bold tracking-wider text-gray-300 uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Combined Test Starts Share Distribution (Top 10 Overview)
          </span>
          <span className="text-[11px] font-mono text-gray-500">Hover pie segments or items below</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Donut Chart Container */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center py-2">
            <div className="relative w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform overflow-visible" viewBox="0 0 160 160">
                {/* Background Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r={RADIUS}
                  fill="transparent"
                  stroke="#1e293b"
                  strokeWidth="22"
                />
                {/* Colored Slices */}
                {chartSegments.map(seg => {
                  if (seg.sliceLength <= 0) return null
                  const isHovered = hoveredIdx === seg.idx
                  return (
                    <circle
                      key={seg.testId}
                      cx="80"
                      cy="80"
                      r={RADIUS}
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth={isHovered ? "26" : "22"}
                      strokeDasharray={`${seg.sliceLength} ${CIRCUMFERENCE - seg.sliceLength}`}
                      strokeDashoffset={-seg.offset}
                      className="transition-all duration-300 cursor-pointer stroke-cap-round"
                      onMouseEnter={() => setHoveredIdx(seg.idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                    >
                      <title>{`${seg.testName} (${seg.share}%)`}</title>
                    </circle>
                  )
                })}
              </svg>

              {/* Center Donut Hole Info */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none">
                <span className="text-xs font-mono text-gray-500 uppercase tracking-widest font-bold">Top 10 Total</span>
                <span className="text-lg sm:text-xl font-black font-mono text-cyan-400 mt-0.5">
                  {actualStartsVolume} {actualStartsVolume === 1 ? 'Start' : 'Starts'}
                </span>
                <span className="text-[10px] font-mono text-gray-400 mt-0.5">Start Volume</span>
              </div>
            </div>
          </div>

          {/* Interactive Legend & Share Breakdown */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 sm:max-h-80 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-800">
            {chartSegments.map(seg => {
              const isHovered = hoveredIdx === seg.idx
              return (
                <div
                  key={seg.testId}
                  onMouseEnter={() => setHoveredIdx(seg.idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`p-2.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 font-mono text-xs ${
                    isHovered
                      ? 'bg-gray-900 border-gray-600 scale-[1.02] shadow-lg'
                      : 'bg-gray-900/40 border-gray-800/80 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      style={{ backgroundColor: seg.color }}
                      className="w-3 h-3 rounded-md shrink-0 shadow-sm"
                    />
                    <span className="font-bold text-gray-400 shrink-0">#{seg.idx + 1}</span>
                    <span className="text-gray-200 font-sans font-medium truncate min-w-0" title={seg.testName}>
                      {seg.testName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-cyan-400 font-mono">{seg.share}%</span>
                    <span className="text-gray-500 text-[10px] hidden xl:inline">({seg.itemStarts} starts)</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* OVERALL FUNNEL VIEW */}
      {viewMode === 'overall' && (
        <div className="space-y-6">
          {testFunnels.map((t, i) => {
            const startWidthPct = Math.min(100, Math.max(8, Math.round((t.totalStarts / maxStarts) * 100)))
            const submitWidthPct = Math.min(100, Math.max(4, Math.round((t.totalSubmits / maxStarts) * 100)))

            return (
              <div key={t.testId} className="p-4 rounded-xl bg-gray-900/60 border border-gray-800/80 hover:border-cyan-500/40 transition-all font-mono">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-400">
                      #{i + 1}
                    </span>
                    <span className="text-sm font-bold text-gray-100 font-sans tracking-wide">
                      {t.testName}
                    </span>
                    <span className="text-[10px] text-gray-500 bg-gray-950 px-2 py-0.5 rounded border border-gray-800">
                      ID: {t.testId.slice(0, 8)}...
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div>Started: <span className="text-cyan-400 font-bold">{t.totalStarts}</span></div>
                    <div>Completed: <span className="text-emerald-400 font-bold">{t.totalSubmits}</span></div>
                    <div className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-black">
                      {t.overallRate}% RATE
                    </div>
                  </div>
                </div>

                {/* Dual Cyberpunk Bars */}
                <div className="space-y-1.5 relative">
                  {/* Top Bar: Starts */}
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-[10px] text-gray-400 uppercase font-semibold">Starts</span>
                    <div className="flex-1 h-4 bg-gray-950 rounded-lg overflow-hidden border border-gray-800/80">
                      <div
                        style={{ width: `${startWidthPct}%` }}
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_0_12px_rgba(0,240,255,0.35)] transition-all duration-500 rounded-lg flex items-center justify-end pr-2 text-[10px] font-black text-black"
                      >
                        {t.totalStarts}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Bar: Submits */}
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-[10px] text-emerald-400 uppercase font-semibold">Submits</span>
                    <div className="flex-1 h-4 bg-gray-950 rounded-lg overflow-hidden border border-gray-800/80">
                      <div
                        style={{ width: `${submitWidthPct}%` }}
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.35)] transition-all duration-500 rounded-lg flex items-center justify-end pr-2 text-[10px] font-black text-black"
                      >
                        {t.totalSubmits} ({t.overallRate}%)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* TIER BREAKDOWN VIEW (4-TIER BREAKDOWN) */}
      {viewMode === 'tier' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs font-mono text-purple-300 mb-4 flex items-center justify-between">
            <span>⚡ Showing exact completion behavior across all 4 student membership tiers</span>
            <span className="font-bold uppercase tracking-wider">4-Tier Insight Engine</span>
          </div>

          {testFunnels.map((t) => (
            <div key={t.testId} className="p-4 rounded-xl bg-gray-900/60 border border-gray-800/80 hover:border-purple-500/40 transition-all font-mono">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <span className="text-sm font-bold text-gray-100 font-sans tracking-wide">
                  {t.testName}
                </span>
                <span className="text-xs text-gray-400">Total Starts: <strong className="text-white">{t.totalStarts}</strong></span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Free Tier Card */}
                <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 relative overflow-hidden">
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="font-bold text-gray-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-gray-400" />
                      FREE
                    </span>
                    <span className="text-cyan-400 font-bold">{t.freeStarts} Starts</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="text-gray-500">Submits: {t.freeSubmits}</span>
                    <span className="font-black text-emerald-400">{t.freeRate}% Rate</span>
                  </div>
                  <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                    <div style={{ width: `${t.freeRate}%` }} className="h-full bg-cyan-400 transition-all duration-500" />
                  </div>
                </div>

                {/* Practice Tier Card */}
                <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30 relative overflow-hidden">
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="font-bold text-blue-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      PRACTICE
                    </span>
                    <span className="text-blue-400 font-bold">{t.practiceStarts} Starts</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="text-gray-400">Submits: {t.practiceSubmits}</span>
                    <span className="font-black text-emerald-400">{t.practiceRate}% Rate</span>
                  </div>
                  <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden border border-blue-500/40">
                    <div style={{ width: `${t.practiceRate}%` }} className="h-full bg-blue-400 transition-all duration-500" />
                  </div>
                </div>

                {/* Flash Tier Card */}
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 relative overflow-hidden">
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      FLASH
                    </span>
                    <span className="text-amber-400 font-bold">{t.flashStarts} Starts</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="text-gray-400">Submits: {t.flashSubmits}</span>
                    <span className="font-black text-emerald-400">{t.flashRate}% Rate</span>
                  </div>
                  <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden border border-amber-500/40">
                    <div style={{ width: `${t.flashRate}%` }} className="h-full bg-amber-400 transition-all duration-500" />
                  </div>
                </div>

                {/* Master Tier Card */}
                <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 relative overflow-hidden">
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="font-bold text-purple-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                      MASTER
                    </span>
                    <span className="text-purple-400 font-bold">{t.masterStarts} Starts</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="text-gray-400">Submits: {t.masterSubmits}</span>
                    <span className="font-black text-emerald-400">{t.masterRate}% Rate</span>
                  </div>
                  <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden border border-purple-500/40">
                    <div style={{ width: `${t.masterRate}%` }} className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 transition-all duration-500" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DATA MATRIX (TABLE VIEW) */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 bg-gray-900/60 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Test Name / ID</th>
                <th className="py-3 px-4 text-right">Starts</th>
                <th className="py-3 px-4 text-right">Submits</th>
                <th className="py-3 px-4 text-right">Overall Rate</th>
                <th className="py-3 px-4 text-right">Free (St/Su/%)</th>
                <th className="py-3 px-4 text-right">Practice (St/Su/%)</th>
                <th className="py-3 px-4 text-right">Flash (St/Su/%)</th>
                <th className="py-3 px-4 text-right">Master (St/Su/%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {testFunnels.map((t) => (
                <tr key={t.testId} className="hover:bg-gray-900/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-gray-200 font-sans">{t.testName}</td>
                  <td className="py-3 px-4 text-right text-cyan-400 font-bold">{t.totalStarts}</td>
                  <td className="py-3 px-4 text-right text-emerald-400 font-bold">{t.totalSubmits}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 font-black text-cyan-300">
                      {t.overallRate}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-300">{t.freeStarts} / {t.freeSubmits} (<strong className="text-cyan-400">{t.freeRate}%</strong>)</td>
                  <td className="py-3 px-4 text-right text-gray-300">{t.practiceStarts} / {t.practiceSubmits} (<strong className="text-blue-400">{t.practiceRate}%</strong>)</td>
                  <td className="py-3 px-4 text-right text-gray-300">{t.flashStarts} / {t.flashSubmits} (<strong className="text-amber-400">{t.flashRate}%</strong>)</td>
                  <td className="py-3 px-4 text-right text-gray-300">{t.masterStarts} / {t.masterSubmits} (<strong className="text-purple-400">{t.masterRate}%</strong>)</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
