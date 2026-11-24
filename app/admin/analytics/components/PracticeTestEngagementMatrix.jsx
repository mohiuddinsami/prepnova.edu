'use client'

import React, { useState } from 'react'

const CHART_COLORS = [
  '#8B5CF6', // Purple 500
  '#6366F1', // Indigo 500
  '#F59E0B', // Amber 500
  '#EC4899', // Pink 500
  '#06B6D4', // Cyan 500
  '#10B981', // Emerald 500
  '#3B82F6', // Blue 500
  '#14B8A6', // Teal 500
  '#F97316', // Orange 500
  '#84CC16'  // Lime 500
]

export function PracticeTestEngagementMatrix({ testList = [] }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  if (!testList || testList.length === 0) {
    return (
      <div className="bg-[#0A0E17]/95 border border-gray-800/80 rounded-2xl p-10 text-center shadow-xl backdrop-blur-md">
        <div className="w-12 h-12 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto mb-3 text-gray-500 text-xl font-bold">
          🎓
        </div>
        <p className="text-gray-400 font-sans font-semibold text-sm">No practice tests found in Content DB.</p>
        <p className="text-xs font-mono text-gray-600 mt-1">Please ensure practice tests are created in Project B (Content DB).</p>
      </div>
    )
  }

  // Calculate total starts across all practice tests for the Donut chart
  const topTests = testList.slice(0, 10)
  const totalStartsVolume = topTests.reduce((acc, t) => acc + (t.totalStarts || 0), 0) || 1

  // Prepare Donut Chart segments (r = 65, circumference = 2 * Math.PI * 65 ≈ 408.4)
  const RADIUS = 65
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  let currentOffset = 0

  const chartSegments = topTests.map((t, idx) => {
    const itemStarts = t.totalStarts || 0
    const share = Math.round((itemStarts / totalStartsVolume) * 1000) / 10 // e.g. 45.2%
    const sliceLength = (itemStarts / totalStartsVolume) * CIRCUMFERENCE
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
    <div className="bg-[#0A0E17]/95 border border-violet-500/40 rounded-2xl p-6 lg:p-8 shadow-[0_0_40px_rgba(139,92,246,0.12)] relative overflow-hidden backdrop-blur-md">
      {/* Background Decorative Cyber Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-gray-800/80 mb-6 gap-4 relative z-10">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400 font-black text-lg flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
            🎓
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black tracking-wide text-white uppercase font-sans flex items-center gap-2.5">
              Practice Tests Engagement Leaderboard
            </h2>
            <p className="text-xs sm:text-sm font-sans text-gray-400 mt-0.5">
              Top practice tests start volume distribution paired with completion rates and horizontal tier splits.
            </p>
          </div>
        </div>
        <div className="self-start sm:self-center shrink-0">
          <span className="px-3.5 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400 font-mono text-xs font-bold tracking-wider shadow-[0_0_12px_rgba(139,92,246,0.15)] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            TOP PRACTICE TESTS
          </span>
        </div>
      </div>

      {/* Combined Overview Panel: Donut Chart + Distribution Legend */}
      <div className="bg-gray-950/80 border border-gray-800/90 rounded-2xl p-6 mb-8 relative z-10 shadow-inner">
        <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-gray-850">
          <span className="text-xs font-mono font-bold tracking-wider text-gray-300 uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            Combined Test Starts Share Distribution (Top 10 Overview)
          </span>
          <span className="text-[11px] font-mono text-gray-500">Hover graph segments or items below</span>
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
                <span className="text-lg sm:text-xl font-black font-mono text-violet-400 mt-0.5">
                  {totalStartsVolume} {totalStartsVolume === 1 ? 'Start' : 'Starts'}
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
                    <span className="font-bold text-violet-400 font-mono">{seg.share}%</span>
                    <span className="text-gray-500 text-[10px] hidden xl:inline">({seg.itemStarts} starts)</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Leaderboard Cards Section Header */}
      <div className="flex items-center justify-between mb-4 relative z-10 px-1">
        <span className="text-xs font-mono font-bold tracking-wider text-gray-400 uppercase">
          Detailed Practice Test Telemetry &amp; Full-Width Horizontal Tier Splits
        </span>
        <span className="text-[11px] font-mono text-gray-500 hidden sm:inline">
          Ordered by highest start volume
        </span>
      </div>

      {/* Leaderboard Cards with Full-Width Horizontal Stacked Telemetry Rows */}
      <div className="space-y-4 relative z-10">
        {topTests.map((t, idx) => {
          const totalStarts = t.totalStarts || 0
          const totalSubmits = t.totalSubmits || 0
          const hasActivity = totalStarts > 0 || totalSubmits > 0
          const colorHex = CHART_COLORS[idx % CHART_COLORS.length]

          // Calculate start percentages per tier
          const freeStartsPct = totalStarts > 0 ? Math.round(((t.freeStarts || 0) / totalStarts) * 100) : 0
          const practiceStartsPct = totalStarts > 0 ? Math.round(((t.practiceStarts || 0) / totalStarts) * 100) : 0
          const flashStartsPct = totalStarts > 0 ? Math.round(((t.flashStarts || 0) / totalStarts) * 100) : 0
          const masterStartsPct = totalStarts > 0 ? Math.round(((t.masterStarts || 0) / totalStarts) * 100) : 0

          // Calculate submit/completion volume percentages per tier for horizontal bar
          const freeSubmitsPct = totalSubmits > 0 ? Math.round(((t.freeSubmits || 0) / totalSubmits) * 100) : 0
          const practiceSubmitsPct = totalSubmits > 0 ? Math.round(((t.practiceSubmits || 0) / totalSubmits) * 100) : 0
          const flashSubmitsPct = totalSubmits > 0 ? Math.round(((t.flashSubmits || 0) / totalSubmits) * 100) : 0
          const masterSubmitsPct = totalSubmits > 0 ? Math.round(((t.masterSubmits || 0) / totalSubmits) * 100) : 0

          return (
            <div
              key={t.testId}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ borderColor: hoveredIdx === idx ? colorHex : undefined }}
              className="p-5 rounded-2xl border transition-all duration-300 font-sans bg-[#0f172a]/90 border-gray-800 hover:border-violet-500/40 shadow-lg"
            >
              {/* Row 1: Card Header & Main Metrics */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Rank Pill with Matching Chart Color Accent */}
                  <span
                    style={{ backgroundColor: `${colorHex}15`, borderColor: `${colorHex}40`, color: colorHex }}
                    className="w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center shrink-0 border shadow-sm font-mono"
                  >
                    #{idx + 1}
                  </span>

                  {/* Title */}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-white font-sans tracking-tight truncate" title={t.testName}>
                      {t.testName}
                    </h3>
                  </div>
                </div>

                {/* Main Metric Badges */}
                <div className="flex flex-wrap items-center gap-2 self-start md:self-center shrink-0 font-mono text-xs font-bold">
                  <div className="px-3 py-1 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 flex items-center gap-2 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-violet-400" />
                    <span>{totalStarts} {totalStarts === 1 ? 'START' : 'STARTS'}</span>
                  </div>
                  <div className="px-3 py-1 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 flex items-center gap-2 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>{totalSubmits} {totalSubmits === 1 ? 'SUBMITTED' : 'SUBMITTED'}</span>
                  </div>
                  <div
                    className={`px-3.5 py-1 rounded-xl border flex items-center gap-2 shadow-sm transition-colors ${
                      hasActivity && t.overallRate >= 60
                        ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                        : hasActivity && t.overallRate >= 30
                        ? 'bg-amber-950/80 border-amber-500/50 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                        : 'bg-gray-900 border-gray-800 text-gray-400'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${hasActivity ? 'bg-violet-400 animate-pulse' : 'bg-gray-600'}`} />
                    <span>{t.overallRate || 0}% COMPLETION RATE</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Full-Width Horizontal Starts Tier Distribution */}
              <div className="mt-4 pt-4 border-t border-gray-800/60 font-mono">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs mb-2">
                  <span className="text-gray-300 font-bold tracking-wider flex items-center gap-1.5 uppercase font-sans">
                    <span className="w-2 h-2 rounded-full bg-violet-400" /> Starts Tier Split
                  </span>
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-400">
                    <span>Free: <strong className="text-cyan-300">{freeStartsPct}%</strong> <span className="text-gray-600">({t.freeStarts || 0})</span></span>
                    <span>Practice: <strong className="text-blue-300">{practiceStartsPct}%</strong> <span className="text-gray-600">({t.practiceStarts || 0})</span></span>
                    <span>Flash: <strong className="text-amber-300">{flashStartsPct}%</strong> <span className="text-gray-600">({t.flashStarts || 0})</span></span>
                    <span>Master: <strong className="text-purple-300">{masterStartsPct}%</strong> <span className="text-gray-600">({t.masterStarts || 0})</span></span>
                  </div>
                </div>

                {/* Full-Width Starts Segmented Bar */}
                <div className="w-full h-2 rounded-full bg-gray-950 border border-gray-850 flex overflow-hidden shadow-inner">
                  {totalStarts > 0 ? (
                    <>
                      {freeStartsPct > 0 && <div style={{ width: `${freeStartsPct}%` }} className="bg-cyan-400 h-full transition-all duration-300" title={`Free Starts: ${freeStartsPct}% (${t.freeStarts || 0})`} />}
                      {practiceStartsPct > 0 && <div style={{ width: `${practiceStartsPct}%` }} className="bg-blue-400 h-full transition-all duration-300" title={`Practice Starts: ${practiceStartsPct}% (${t.practiceStarts || 0})`} />}
                      {flashStartsPct > 0 && <div style={{ width: `${flashStartsPct}%` }} className="bg-amber-400 h-full transition-all duration-300" title={`Flash Starts: ${flashStartsPct}% (${t.flashStarts || 0})`} />}
                      {masterStartsPct > 0 && <div style={{ width: `${masterStartsPct}%` }} className="bg-purple-400 h-full transition-all duration-300" title={`Master Starts: ${masterStartsPct}% (${t.masterStarts || 0})`} />}
                    </>
                  ) : (
                    <div className="w-full h-full bg-gray-800/40" />
                  )}
                </div>
              </div>

              {/* Row 3: Full-Width Horizontal Submissions / Completion Tier Split */}
              <div className="mt-3.5 pt-3.5 border-t border-gray-800/40 font-mono">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs mb-2">
                  <span className="text-gray-300 font-bold tracking-wider flex items-center gap-1.5 uppercase font-sans">
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> Completion Rate &amp; Submissions Tier Split
                  </span>
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-400">
                    <span>Free: <strong className="text-cyan-300">{t.freeRate || 0}% rate</strong> <span className="text-gray-600">({t.freeSubmits || 0} submits)</span></span>
                    <span>Practice: <strong className="text-blue-300">{t.practiceRate || 0}% rate</strong> <span className="text-gray-600">({t.practiceSubmits || 0})</span></span>
                    <span>Flash: <strong className="text-amber-300">{t.flashRate || 0}% rate</strong> <span className="text-gray-600">({t.flashSubmits || 0})</span></span>
                    <span>Master: <strong className="text-purple-300">{t.masterRate || 0}% rate</strong> <span className="text-gray-600">({t.masterSubmits || 0})</span></span>
                  </div>
                </div>

                {/* Full-Width Submissions Segmented Bar */}
                <div className="w-full h-2 rounded-full bg-gray-950 border border-gray-850 flex overflow-hidden shadow-inner">
                  {totalSubmits > 0 ? (
                    <>
                      {freeSubmitsPct > 0 && <div style={{ width: `${freeSubmitsPct}%` }} className="bg-cyan-400 h-full transition-all duration-300" title={`Free Submits: ${freeSubmitsPct}% (${t.freeSubmits || 0})`} />}
                      {practiceSubmitsPct > 0 && <div style={{ width: `${practiceSubmitsPct}%` }} className="bg-blue-400 h-full transition-all duration-300" title={`Practice Submits: ${practiceSubmitsPct}% (${t.practiceSubmits || 0})`} />}
                      {flashSubmitsPct > 0 && <div style={{ width: `${flashSubmitsPct}%` }} className="bg-amber-400 h-full transition-all duration-300" title={`Flash Submits: ${flashSubmitsPct}% (${t.flashSubmits || 0})`} />}
                      {masterSubmitsPct > 0 && <div style={{ width: `${masterSubmitsPct}%` }} className="bg-purple-400 h-full transition-all duration-300" title={`Master Submits: ${masterSubmitsPct}% (${t.masterSubmits || 0})`} />}
                    </>
                  ) : (
                    <div className="w-full h-full bg-gray-800/40" />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
