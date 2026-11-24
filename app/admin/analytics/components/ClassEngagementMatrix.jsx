'use client'

import React, { useState } from 'react'

const CHART_COLORS = [
  '#10B981', // Emerald 500
  '#06B6D4', // Cyan 500
  '#3B82F6', // Blue 500
  '#8B5CF6', // Purple 500
  '#F59E0B', // Amber 500
  '#EC4899', // Pink 500
  '#14B8A6', // Teal 500
  '#6366F1', // Indigo 500
  '#F97316', // Orange 500
  '#84CC16'  // Lime 500
]

const formatDuration = (secs) => {
  if (!secs || secs <= 0) return '0m'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function ClassEngagementMatrix({ classList = [] }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  if (!classList || classList.length === 0) {
    return (
      <div className="bg-[#0A0E17]/95 border border-gray-800/80 rounded-2xl p-10 text-center shadow-xl backdrop-blur-md">
        <div className="w-12 h-12 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto mb-3 text-gray-500 text-xl font-bold">
          ▶
        </div>
        <p className="text-gray-400 font-sans font-semibold text-sm">No class package watch heartbeats recorded within this time window yet.</p>
        <p className="text-xs font-mono text-gray-600 mt-1">Watch heartbeats will automatically appear here once students or masters open class packages.</p>
      </div>
    )
  }

  // Calculate total volume across top 10 for the Pie/Donut chart
  const totalVolumeSecs = classList.reduce((acc, c) => acc + (c.totalSecs || (c.hours * 3600) || (c.views > 0 ? 60 : 0)), 0) || 1

  // Prepare Donut Chart segments (r = 65, circumference = 2 * Math.PI * 65 ≈ 408.4)
  const RADIUS = 65
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  let currentOffset = 0

  const chartSegments = classList.map((c, idx) => {
    const itemSecs = c.totalSecs || (c.hours * 3600) || (c.views > 0 ? 60 : 0)
    const share = Math.round((itemSecs / totalVolumeSecs) * 1000) / 10 // e.g. 45.2%
    const sliceLength = (itemSecs / totalVolumeSecs) * CIRCUMFERENCE
    const offset = currentOffset
    currentOffset += sliceLength

    return {
      ...c,
      idx,
      itemSecs,
      share,
      sliceLength,
      offset,
      color: CHART_COLORS[idx % CHART_COLORS.length]
    }
  })

  return (
    <div className="bg-[#0A0E17]/95 border border-emerald-500/40 rounded-2xl p-6 lg:p-8 shadow-[0_0_40px_rgba(16,185,129,0.12)] relative overflow-hidden backdrop-blur-md">
      {/* Background Decorative Cyber Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-gray-800/80 mb-6 gap-4 relative z-10">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-black text-lg flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            ▶
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black tracking-wide text-white uppercase font-sans flex items-center gap-2.5">
              Class Packages Watched Leaderboard
            </h2>
            <p className="text-xs sm:text-sm font-sans text-gray-400 mt-0.5">
              Top 10 packages watch time share distribution paired with clean horizontal Clicks and Duration telemetry splits.
            </p>
          </div>
        </div>
        <div className="self-start sm:self-center shrink-0">
          <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.15)] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            TOP 10 PACKAGES
          </span>
        </div>
      </div>

      {/* Combined Overview Panel: Donut Chart + Distribution Legend */}
      <div className="bg-gray-950/80 border border-gray-800/90 rounded-2xl p-6 mb-8 relative z-10 shadow-inner">
        <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-gray-850">
          <span className="text-xs font-mono font-bold tracking-wider text-gray-300 uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            Combined Watch Time Share Distribution (Top 10 Overview)
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
                      key={seg.classId}
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
                      <title>{`${seg.classTitle} (${seg.share}%)`}</title>
                    </circle>
                  )
                })}
              </svg>

              {/* Center Donut Hole Info */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none">
                <span className="text-xs font-mono text-gray-500 uppercase tracking-widest font-bold">Top 10 Total</span>
                <span className="text-lg sm:text-xl font-black font-mono text-emerald-400 mt-0.5">
                  {formatDuration(totalVolumeSecs)}
                </span>
                <span className="text-[10px] font-mono text-gray-400 mt-0.5">Watch Volume</span>
              </div>
            </div>
          </div>

          {/* Interactive Legend & Share Breakdown */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 sm:max-h-80 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-800">
            {chartSegments.map(seg => {
              const isHovered = hoveredIdx === seg.idx
              return (
                <div
                  key={seg.classId}
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
                    <span className="text-gray-200 font-sans font-medium truncate min-w-0" title={seg.classTitle}>
                      {seg.classTitle}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-emerald-400 font-mono">{seg.share}%</span>
                    <span className="text-gray-500 text-[10px] hidden xl:inline">({formatDuration(seg.itemSecs)})</span>
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
          Detailed Package Telemetry &amp; Full-Width Horizontal Tier Splits
        </span>
        <span className="text-[11px] font-mono text-gray-500 hidden sm:inline">
          Ordered by highest watch volume
        </span>
      </div>

      {/* Leaderboard Cards with Full-Width Horizontal Stacked Telemetry Rows */}
      <div className="space-y-4 relative z-10">
        {classList.map((c, idx) => {
          const itemSecs = c.totalSecs || (c.hours * 3600) || 0
          const hasActivity = c.views > 0 || itemSecs > 0
          const colorHex = CHART_COLORS[idx % CHART_COLORS.length]

          const freeClickPct = c.freeClickPct !== undefined ? c.freeClickPct : (c.freePct || 0)
          const practiceClickPct = c.practiceClickPct !== undefined ? c.practiceClickPct : (c.practicePct || 0)
          const flashClickPct = c.flashClickPct !== undefined ? c.flashClickPct : (c.flashPct || 0)
          const masterClickPct = c.masterClickPct !== undefined ? c.masterClickPct : (c.masterPct || 0)

          const freeTimePct = c.freeTimePct !== undefined ? c.freeTimePct : (c.freePct || 0)
          const practiceTimePct = c.practiceTimePct !== undefined ? c.practiceTimePct : (c.practicePct || 0)
          const flashTimePct = c.flashTimePct !== undefined ? c.flashTimePct : (c.flashPct || 0)
          const masterTimePct = c.masterTimePct !== undefined ? c.masterTimePct : (c.masterPct || 0)

          // Robust dynamic tier duration calculation (ensures active watch time is correctly apportioned even if server string was cached)
          const getTierTimeStr = (tierPct, serverFormattedStr, tierSeconds) => {
            if (tierSeconds && tierSeconds > 0) return formatDuration(tierSeconds)
            if (serverFormattedStr && serverFormattedStr !== '0m' && serverFormattedStr !== '0h 0m') return serverFormattedStr
            if (itemSecs > 0 && tierPct > 0) {
              const approxSecs = Math.round(itemSecs * (tierPct / 100))
              return formatDuration(approxSecs)
            }
            return '0m'
          }

          const freeTimeStr = getTierTimeStr(freeTimePct, c.freeFormattedTime, c.freeSeconds)
          const practiceTimeStr = getTierTimeStr(practiceTimePct, c.practiceFormattedTime, c.practiceSeconds)
          const flashTimeStr = getTierTimeStr(flashTimePct, c.flashFormattedTime, c.flashSeconds)
          const masterTimeStr = getTierTimeStr(masterTimePct, c.masterFormattedTime, c.masterSeconds)

          return (
            <div
              key={c.classId}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ borderColor: hoveredIdx === idx ? colorHex : undefined }}
              className={`p-5 rounded-2xl border transition-all duration-300 font-sans ${
                hasActivity
                  ? 'bg-[#0f172a]/90 border-gray-800 hover:border-emerald-500/40 shadow-lg'
                  : 'bg-[#0c1322]/50 border-gray-850/80 hover:border-gray-750 opacity-80'
              }`}
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
                    <h3 className="text-base font-bold text-white font-sans tracking-tight truncate" title={c.classTitle}>
                      {c.classTitle}
                    </h3>
                  </div>
                </div>

                {/* Main Metric Badges */}
                <div className="flex flex-wrap items-center gap-2 self-start md:self-center shrink-0 font-mono text-xs font-bold">
                  <div className="px-3 py-1 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 flex items-center gap-2 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>{c.views} {c.views === 1 ? 'VISIT' : 'VISITS'}</span>
                  </div>
                  <div
                    className={`px-3.5 py-1 rounded-xl border flex items-center gap-2 shadow-sm transition-colors ${
                      hasActivity
                        ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                        : 'bg-gray-900 border-gray-800 text-gray-500'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${hasActivity ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                    <span>{c.formattedTime || formatDuration(itemSecs)} WATCHED</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Full-Width Horizontal Visits / Clicks Distribution */}
              <div className="mt-4 pt-4 border-t border-gray-800/60 font-mono">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs mb-2">
                  <span className="text-gray-300 font-bold tracking-wider flex items-center gap-1.5 uppercase font-sans">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" /> Visits / Clicks Tier Split
                  </span>
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-400">
                    <span>Free: <strong className="text-cyan-300">{freeClickPct}%</strong> <span className="text-gray-600">({c.freeClicks || 0})</span></span>
                    <span>Practice: <strong className="text-blue-300">{practiceClickPct}%</strong> <span className="text-gray-600">({c.practiceClicks || 0})</span></span>
                    <span>Flash: <strong className="text-amber-300">{flashClickPct}%</strong> <span className="text-gray-600">({c.flashClicks || 0})</span></span>
                    <span>Master: <strong className="text-purple-300">{masterClickPct}%</strong> <span className="text-gray-600">({c.masterClicks || 0})</span></span>
                  </div>
                </div>

                {/* Full-Width Clicks Segmented Bar */}
                <div className="w-full h-2 rounded-full bg-gray-950 border border-gray-850 flex overflow-hidden shadow-inner">
                  {c.views > 0 ? (
                    <>
                      {freeClickPct > 0 && <div style={{ width: `${freeClickPct}%` }} className="bg-cyan-400 h-full transition-all duration-300" title={`Free Clicks: ${freeClickPct}%`} />}
                      {practiceClickPct > 0 && <div style={{ width: `${practiceClickPct}%` }} className="bg-blue-400 h-full transition-all duration-300" title={`Practice Clicks: ${practiceClickPct}%`} />}
                      {flashClickPct > 0 && <div style={{ width: `${flashClickPct}%` }} className="bg-amber-400 h-full transition-all duration-300" title={`Flash Clicks: ${flashClickPct}%`} />}
                      {masterClickPct > 0 && <div style={{ width: `${masterClickPct}%` }} className="bg-purple-400 h-full transition-all duration-300" title={`Master Clicks: ${masterClickPct}%`} />}
                    </>
                  ) : (
                    <div className="w-full h-full bg-gray-800/40" />
                  )}
                </div>
              </div>

              {/* Row 3: Full-Width Horizontal Watch Duration Distribution */}
              <div className="mt-3.5 pt-3.5 border-t border-gray-800/40 font-mono">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs mb-2">
                  <span className="text-gray-300 font-bold tracking-wider flex items-center gap-1.5 uppercase font-sans">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> Watch Duration Tier Split
                  </span>
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-400">
                    <span>Free: <strong className="text-cyan-300">{freeTimePct}%</strong> <span className="text-gray-600">({freeTimeStr})</span></span>
                    <span>Practice: <strong className="text-blue-300">{practiceTimePct}%</strong> <span className="text-gray-600">({practiceTimeStr})</span></span>
                    <span>Flash: <strong className="text-amber-300">{flashTimePct}%</strong> <span className="text-gray-600">({flashTimeStr})</span></span>
                    <span>Master: <strong className="text-purple-300">{masterTimePct}%</strong> <span className="text-gray-600">({masterTimeStr})</span></span>
                  </div>
                </div>

                {/* Full-Width Watch Duration Segmented Bar */}
                <div className="w-full h-2 rounded-full bg-gray-950 border border-gray-850 flex overflow-hidden shadow-inner">
                  {itemSecs > 0 ? (
                    <>
                      {freeTimePct > 0 && <div style={{ width: `${freeTimePct}%` }} className="bg-cyan-400 h-full transition-all duration-300" title={`Free Time: ${freeTimePct}% (${freeTimeStr})`} />}
                      {practiceTimePct > 0 && <div style={{ width: `${practiceTimePct}%` }} className="bg-blue-400 h-full transition-all duration-300" title={`Practice Time: ${practiceTimePct}% (${practiceTimeStr})`} />}
                      {flashTimePct > 0 && <div style={{ width: `${flashTimePct}%` }} className="bg-amber-400 h-full transition-all duration-300" title={`Flash Time: ${flashTimePct}% (${flashTimeStr})`} />}
                      {masterTimePct > 0 && <div style={{ width: `${masterTimePct}%` }} className="bg-purple-400 h-full transition-all duration-300" title={`Master Time: ${masterTimePct}% (${masterTimeStr})`} />}
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
