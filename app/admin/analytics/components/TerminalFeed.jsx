'use client'

import React from 'react'

export function TerminalFeed({ terminalLogs = [] }) {
  return (
    <div className="bg-[#0A0E17]/95 border border-gray-800 rounded-2xl p-5 shadow-[0_0_25px_rgba(0,0,0,0.5)] flex flex-col h-full font-mono">
      <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10B981]" />
          <h3 className="text-xs font-bold tracking-wider uppercase text-emerald-400">
            LIVE TELEMETRY STREAM (CONSOLE FEED)
          </h3>
        </div>
        <span className="text-[10px] text-gray-500 font-mono">
          LAST {terminalLogs.length} EVENTS
        </span>
      </div>

      <div className="flex-1 bg-black/90 rounded-xl p-4 overflow-y-auto max-h-80 space-y-2 border border-emerald-500/20 text-xs shadow-inner scrollbar-thin">
        {terminalLogs.length === 0 ? (
          <div className="text-gray-600 text-center py-12">
            &gt; System waiting for incoming telemetry stream...
          </div>
        ) : (
          terminalLogs.map((log, index) => {
            let badgeBg = 'bg-gray-800 text-gray-400'
            if (log.tier === 'MASTER' || log.tier === 'PRO') badgeBg = 'bg-purple-900/60 text-purple-300 border border-purple-500/40'
            else if (log.tier === 'STARTER') badgeBg = 'bg-blue-900/60 text-blue-300 border border-blue-500/40'
            else badgeBg = 'bg-gray-800/80 text-gray-300 border border-gray-700'

            let typeColor = 'text-gray-400'
            if (log.type === 'test_start') typeColor = 'text-blue-400 font-bold'
            else if (log.type === 'test_submit') typeColor = 'text-emerald-400 font-black'
            else if (log.type?.includes('class')) typeColor = 'text-teal-300'
            else if (log.type === 'rage_click') typeColor = 'text-pink-400 font-bold animate-pulse'

            const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'NOW'

            return (
              <div key={log.id || index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-gray-900/80 hover:bg-gray-900/40 px-1 rounded transition-colors">
                <div className="flex items-center gap-2 truncate">
                  <span className="text-gray-500 select-none">[{timeStr}]</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${badgeBg}`}>
                    [{log.tier}]
                  </span>
                  <span className={`${typeColor} uppercase tracking-tight font-semibold`}>
                    {log.name || log.type}
                  </span>
                </div>
                <div className="text-gray-500 text-[11px] truncate max-w-xs text-right">
                  {log.route}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
