'use client'

import React, { useState, useEffect } from 'react'
import { fetchBugReportsAction, updateBugStatusAction } from '@/app/actions/bugActions'

export function BugTriageBoard() {
  const [bugs, setBugs] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('open')
  const [selectedBug, setSelectedBug] = useState(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  const loadBugs = async () => {
    setLoading(true)
    const res = await fetchBugReportsAction({ status: statusFilter === 'all' ? null : statusFilter })
    if (res.success && res.data) {
      setBugs(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadBugs()
  }, [statusFilter])

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedBug) return
    setIsUpdating(true)
    const res = await updateBugStatusAction(selectedBug.id, newStatus, adminNotes)
    setIsUpdating(false)
    if (res.success) {
      setSelectedBug(null)
      loadBugs()
    } else {
      alert(`Error updating status: ${res.error}`)
    }
  }

  return (
    <div className="bg-[#0A0E17]/95 border border-pink-500/50 rounded-2xl p-6 shadow-[0_0_30px_rgba(255,0,85,0.12)] relative overflow-hidden backdrop-blur-md font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-800 mb-5">
        <div>
          <h2 className="text-lg font-black tracking-wider text-white uppercase font-sans flex items-center gap-2">
            <span className="text-pink-400 animate-pulse">🔥</span> Bug & Friction Triage Command Center
          </h2>
          <p className="text-xs text-gray-400">
            Inspect automated diagnostic context (QID, URL, Console Logs) and resolve student feedback
          </p>
        </div>

        {/* Status Filters */}
        <div className="flex items-center bg-[#111827] p-1 rounded-xl border border-gray-800 text-xs">
          {['open', 'investigating', 'resolved', 'all'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg transition-all font-bold uppercase ${
                statusFilter === st
                  ? 'bg-pink-500/20 text-pink-300 border border-pink-400 shadow-[0_0_10px_rgba(255,0,85,0.25)]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Bugs List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Scanning Level 9 diagnostic frequency...</div>
      ) : bugs.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-900/40 rounded-xl border border-gray-800/80">
          No bug reports matching status [{statusFilter.toUpperCase()}]. Platform running cleanly!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bugs.map((b) => {
            let priorityBg = 'bg-gray-800 text-gray-300 border-gray-700'
            if (b.priority === 'critical' || b.priority === 'high') priorityBg = 'bg-pink-900/60 text-pink-300 border-pink-500/50'

            return (
              <div
                key={b.id}
                onClick={() => { setSelectedBug(b); setAdminNotes(b.admin_notes || '') }}
                className="p-4 rounded-xl bg-gray-900/70 border border-gray-800 hover:border-pink-500/60 cursor-pointer transition-all flex flex-col justify-between hover:scale-[1.02] shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${priorityBg}`}>
                      {b.priority} PRIORITY
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {new Date(b.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-gray-100 font-sans tracking-wide truncate mb-1">
                    {b.category}
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-3 font-sans mb-3">
                    {b.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px] text-gray-500">
                  <span className="truncate max-w-[140px]">Reporter: {b.reporter_email?.split('@')[0]}</span>
                  {b.target_question_id && (
                    <span className="text-cyan-400 font-bold">QID: {b.target_question_id}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Cyberpunk Inspection Modal */}
      {selectedBug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-[#0A0E17] border border-pink-500/60 rounded-2xl shadow-[0_0_40px_rgba(255,0,85,0.3)] p-6 text-gray-100 font-sans max-h-[90vh] overflow-y-auto">
            {/* Top Glow */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-pink-400 to-transparent animate-pulse" />

            <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4 font-mono">
              <div>
                <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest">
                  DIAGNOSTIC INSPECTION MODAL
                </span>
                <h3 className="text-base font-bold text-white uppercase mt-0.5">
                  {selectedBug.category} — [{selectedBug.status.toUpperCase()}]
                </h3>
              </div>
              <button
                onClick={() => setSelectedBug(null)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Reporter & Tier */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-gray-900/80 rounded-xl border border-gray-800 font-mono text-xs mb-4">
              <div>
                <span className="text-gray-500 block text-[10px]">REPORTER</span>
                <span className="font-bold text-gray-200 truncate block">{selectedBug.reporter_email}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">USER TIER</span>
                <span className="font-bold text-purple-400 uppercase">{selectedBug.user_tier || 'FREE'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">TIMESTAMP</span>
                <span className="text-gray-300">{new Date(selectedBug.created_at).toLocaleString()}</span>
              </div>
            </div>

            {/* 2000 Char Description Box */}
            <div className="mb-4">
              <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase mb-1">
                STUDENT / ADMIN DESCRIPTION (UP TO 2000 CHARS)
              </label>
              <div className="p-3 bg-gray-950 rounded-xl border border-gray-800 text-sm text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">
                {selectedBug.description}
              </div>
            </div>

            {/* Automated Diagnostic Context */}
            <div className="space-y-2 mb-5 font-mono text-xs">
              <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                ⚡ AUTOMATED TECHNICAL CONTEXT ATTACHED
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-gray-950/90 rounded-xl border border-cyan-500/20">
                <div>Route Path: <strong className="text-gray-200">{selectedBug.route_path}</strong></div>
                {selectedBug.target_question_id && (
                  <div>Target QID: <strong className="text-emerald-400">{selectedBug.target_question_id}</strong></div>
                )}
                {selectedBug.target_module_id && (
                  <div>Module ID: <strong className="text-gray-300">{selectedBug.target_module_id}</strong></div>
                )}
                <div>Browser/OS: <strong className="text-gray-300">{selectedBug.user_agent?.slice(0, 45)}...</strong></div>
                {selectedBug.device_info?.screenResolution && (
                  <div>Resolution: <strong className="text-gray-300">{selectedBug.device_info.screenResolution}</strong></div>
                )}
              </div>
            </div>

            {/* Captured Client Console Errors */}
            {selectedBug.client_errors && selectedBug.client_errors.length > 0 && (
              <div className="mb-5 font-mono">
                <div className="text-[10px] font-bold text-pink-400 uppercase tracking-wider mb-1">
                  ⚠️ CAPTURED CLIENT JAVASCRIPT CONSOLE LOGS ({selectedBug.client_errors.length})
                </div>
                <div className="p-3 bg-black rounded-xl border border-pink-500/30 max-h-36 overflow-y-auto space-y-1 text-[11px] text-pink-300">
                  {selectedBug.client_errors.map((err, idx) => (
                    <div key={idx} className="border-b border-gray-900 pb-1">
                      <div><strong className="text-white">[{err.source}]</strong>: {err.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Notes Box */}
            <div className="mb-5 font-mono">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                ADMIN TRIAGE NOTES / RESOLUTION ACTION
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add internal investigation notes or note why this issue occurred..."
                rows={2}
                className="w-full p-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-gray-200 focus:outline-none focus:border-cyan-400 font-sans"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-800 font-mono text-xs">
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdateStatus('investigating')}
                  disabled={isUpdating}
                  className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 rounded-xl font-bold uppercase transition-all"
                >
                  Set Investigating
                </button>
                <button
                  onClick={() => handleUpdateStatus('resolved')}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 rounded-xl font-black uppercase shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all"
                >
                  Mark Resolved
                </button>
              </div>
              <button
                onClick={() => handleUpdateStatus('dismissed')}
                disabled={isUpdating}
                className="px-3 py-2 bg-gray-900 hover:bg-gray-800 text-gray-400 rounded-xl uppercase transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
