'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export function MetricTicker({ ticker = {} }) {
  const [showActiveModal, setShowActiveModal] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!showActiveModal) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowActiveModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showActiveModal])

  const {
    onlineCount = 0,
    activeSessionsList = [],
    classHoursWatched = 0,
    testStarts = 0,
    completionRate = 0,
    pendingBugs = 0,
    criticalBugs = 0
  } = ticker

  const cards = [
    {
      title: 'ONLINE ACTIVE SESSIONS',
      value: `${onlineCount}`,
      subtitle: 'Click to view live user list →',
      borderColor: 'border-cyan-500/60 hover:border-cyan-400',
      textColor: 'text-cyan-400',
      glowColor: 'shadow-[0_0_20px_rgba(0,240,255,0.2)] hover:shadow-[0_0_30px_rgba(0,240,255,0.4)]',
      clickable: true,
      icon: (
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400"></span>
        </span>
      )
    },
    {
      title: 'CLASS TIME WATCHED',
      value: `${ticker.classTimeWatchedFormatted || `${classHoursWatched} hrs`}`,
      subtitle: 'Accumulated package engagement',
      borderColor: 'border-emerald-500/50',
      textColor: 'text-emerald-400',
      glowColor: 'shadow-[0_0_20px_rgba(16,185,129,0.2)]',
      icon: <span className="text-emerald-400 font-bold text-lg">▶</span>
    },
    {
      title: 'TEST STARTS LOGGED',
      value: `${testStarts.toLocaleString()}`,
      subtitle: 'Top of practice funnel',
      borderColor: 'border-blue-500/50',
      textColor: 'text-blue-400',
      glowColor: 'shadow-[0_0_20px_rgba(59,130,246,0.2)]',
      icon: <span className="text-blue-400 font-bold text-lg">🚀</span>
    },
    {
      title: 'OVERALL COMPLETION RATE',
      value: `${completionRate}%`,
      subtitle: 'Start vs Submit conversion',
      borderColor: completionRate < 40 ? 'border-amber-500/50' : 'border-purple-500/50',
      textColor: completionRate < 40 ? 'text-amber-400' : 'text-purple-400',
      glowColor: completionRate < 40 ? 'shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'shadow-[0_0_20px_rgba(168,85,247,0.2)]',
      icon: <span className="text-purple-400 font-bold text-lg">🎯</span>
    },
    {
      title: 'CRITICAL / OPEN BUGS',
      value: `${criticalBugs} / ${pendingBugs}`,
      subtitle: `${criticalBugs} require urgent triage`,
      borderColor: criticalBugs > 0 ? 'border-pink-500/60' : 'border-gray-800',
      textColor: criticalBugs > 0 ? 'text-pink-400 animate-pulse' : 'text-gray-400',
      glowColor: criticalBugs > 0 ? 'shadow-[0_0_25px_rgba(255,0,85,0.35)]' : 'shadow-none',
      icon: <span className="text-pink-400 font-bold text-lg">🔥</span>
    }
  ]

  const modalContent = showActiveModal ? (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-mono">
      <div className="bg-[#0b1324] border border-cyan-500/80 rounded-2xl p-6 max-w-5xl w-full max-h-[85vh] flex flex-col shadow-[0_0_60px_rgba(0,240,255,0.35)] relative overflow-hidden">
        {/* Background cyber grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00f0ff05_1px,transparent_1px),linear-gradient(to_bottom,#00f0ff05_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cyan-500/30 mb-4 z-10">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-400"></span>
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-wider text-cyan-300 uppercase">
                LIVE TELEMETRY PULSE: ONLINE USERS ({activeSessionsList.length || onlineCount} ACTIVE)
              </h2>
              <p className="text-[11px] text-gray-400">
                Real-time radar of student accounts &amp; guest sessions currently active on PrepNova
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowActiveModal(false)}
            className="px-3 py-1 bg-gray-900 hover:bg-red-950/80 border border-gray-700 hover:border-red-500/50 rounded-lg text-gray-400 hover:text-red-300 transition-colors text-xs font-bold shrink-0"
          >
            [ESC / CLOSE]
          </button>
        </div>

        {/* Modal Content Table */}
        <div className="flex-1 overflow-y-auto z-10 space-y-2 pr-1 scrollbar-thin scrollbar-thumb-cyan-500/20">
          {activeSessionsList.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs border border-dashed border-gray-800 rounded-xl bg-black/40">
              No detailed telemetry profile rows returned yet. (Click the SYNC button at top right of the dashboard to pull the latest active sessions!)
            </div>
          ) : (
            <div className="overflow-x-auto border border-cyan-500/20 rounded-xl bg-black/60 shadow-inner">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-cyan-500/30 bg-cyan-950/40 text-cyan-400 uppercase font-bold text-[10px] tracking-wider">
                    <th className="py-3 px-4">Active User / Name</th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4">Current Plan / Tier</th>
                    <th className="py-3 px-4">Device &amp; Browser</th>
                    <th className="py-3 px-4 text-right">Last Pulse</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-900">
                  {activeSessionsList.map((sess, idx) => {
                    let tierBadge = 'bg-gray-800 text-gray-300 border-gray-700'
                    if (sess.tier?.includes('OWNER') || sess.tier?.includes('ADMIN')) tierBadge = 'bg-purple-950/90 text-purple-300 border-purple-500/50 shadow-[0_0_10px_#a855f7]'
                    else if (sess.tier?.includes('MASTER')) tierBadge = 'bg-cyan-950/90 text-cyan-300 border-cyan-500/50 shadow-[0_0_10px_#00f0ff]'
                    else if (sess.tier?.includes('FLASH')) tierBadge = 'bg-blue-950/90 text-blue-300 border-blue-500/50'
                    else if (sess.tier?.includes('PRACTICE')) tierBadge = 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'

                    const timeFormatted = sess.lastSeen ? new Date(sess.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'NOW'

                    return (
                      <tr key={sess.sessionToken || idx} className="hover:bg-cyan-950/20 transition-colors">
                        <td className="py-3 px-4 font-bold text-gray-200 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0 shadow-[0_0_6px_#10B981]" />
                          <span className="truncate max-w-[180px]" title={sess.name}>{sess.name}</span>
                        </td>
                        <td className="py-3 px-4 text-gray-400 font-mono truncate max-w-[220px]" title={sess.email}>
                          {sess.email}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${tierBadge}`}>
                            {sess.tier}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-[11px] truncate max-w-[180px]">
                          {sess.device}
                        </td>
                        <td className="py-3 px-4 text-right text-cyan-400 font-mono font-bold">
                          [{timeFormatted}]
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-cyan-500/20 mt-4 flex items-center justify-between text-[11px] text-gray-500 z-10">
          <span>Press ESC key or Click Close button. Radar auto-refreshes every 10s.</span>
          <span className="text-cyan-400/80 font-bold uppercase">PREPNOVA TELEMETRY COMMAND ROOM</span>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((c, i) => (
          <div
            key={i}
            onClick={() => c.clickable && setShowActiveModal(true)}
            className={`bg-[#111827]/90 border ${c.borderColor} rounded-2xl p-5 ${c.glowColor} transition-all hover:scale-[1.02] relative overflow-hidden flex flex-col justify-between ${c.clickable ? 'cursor-pointer' : ''}`}
          >
            {/* Subtle Cyber Scanline Background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none" />

            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-mono font-bold tracking-wider text-gray-400 uppercase">
                {c.title}
              </span>
              {c.icon}
            </div>

            <div>
              <div className={`text-2xl lg:text-3xl font-black font-mono tracking-tight ${c.textColor}`}>
                {c.value}
              </div>
              <div className="text-[10px] font-mono text-gray-500 mt-1 flex items-center gap-1">
                {c.subtitle}
              </div>
            </div>
          </div>
        ))}
      </div>

      {mounted && typeof document !== 'undefined' && modalContent ? createPortal(modalContent, document.body) : null}
    </>
  )
}
