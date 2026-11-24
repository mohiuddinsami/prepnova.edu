'use client'

import React, { useState, useEffect } from 'react'
import { fetchBugReportsAction, updateBugStatusAction, deleteBugReportAction, deleteBulkBugReportsAction } from '@/app/actions/bugActions'
import { Search, Filter, RefreshCw, AlertTriangle, Bug, CheckCircle2, Clock, ShieldAlert, Terminal, Eye, ExternalLink, X, ChevronRight, FileText, Trash2 } from 'lucide-react'

export function BugTriageBoard() {
  const [bugs, setBugs] = useState([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Question-Bank Style Filter Bar state
  const [filter, setFilter] = useState({
    search: '',
    bugType: '',
    category: '',
    status: 'open', // default to open triage
    priority: '',
    sort: 'Newest'
  })

  // Modal / Inspection state
  const [selectedBug, setSelectedBug] = useState(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  // Multi-selection & Deletion state
  const [selectedBugIds, setSelectedBugIds] = useState(new Set())
  const [deleteWarning, setDeleteWarning] = useState(null) // { isOpen: boolean, type: 'single' | 'bulk', ids: string[], title: string }
  const [isDeleting, setIsDeleting] = useState(false)

  const loadBugs = async (forceSync = false) => {
    if (forceSync) setIsRefreshing(true)
    else setLoading(true)

    // Fetch all bugs matching optional backend status filter, or all if status is ''/all
    const statusParam = filter.status === '' || filter.status === 'all' ? null : filter.status
    const res = await fetchBugReportsAction({ status: statusParam })
    if (res.success && res.data) {
      setBugs(res.data)
    }
    if (forceSync) setIsRefreshing(false)
    else setLoading(false)
  }

  useEffect(() => {
    loadBugs()
  }, [filter.status])

  // Get unique categories dynamically from loaded reports for clean filtering
  const uniqueCategories = [...new Set(bugs.map(b => b.category).filter(Boolean))]

  // Apply frontend filtering matching Question-Bank exactly
  const filteredBugs = bugs.filter(b => {
    if (filter.search) {
      const lower = filter.search.toLowerCase()
      const matchesQid = b.target_question_id?.toLowerCase().includes(lower)
      const matchesPath = b.route_path?.toLowerCase().includes(lower) || b.current_url?.toLowerCase().includes(lower)
      const matchesDesc = b.description?.toLowerCase().includes(lower) || b.category?.toLowerCase().includes(lower)
      const matchesEmail = b.reporter_email?.toLowerCase().includes(lower)
      if (!matchesQid && !matchesPath && !matchesDesc && !matchesEmail) return false
    }

    if (filter.bugType && b.bug_type !== filter.bugType) return false
    if (filter.category && b.category !== filter.category) return false
    if (filter.priority && b.priority !== filter.priority) return false

    return true
  }).sort((a, b) => {
    if (filter.sort === 'Oldest') {
      return new Date(a.created_at) - new Date(b.created_at)
    }
    if (filter.sort === 'Priority') {
      const weight = { critical: 4, high: 3, medium: 2, low: 1 }
      const diff = (weight[b.priority] || 0) - (weight[a.priority] || 0)
      if (diff !== 0) return diff
      return new Date(b.created_at) - new Date(a.created_at)
    }
    // Default Newest
    return new Date(b.created_at) - new Date(a.created_at)
  })

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedBug) return
    setIsUpdating(true)
    const res = await updateBugStatusAction(selectedBug.id, newStatus, adminNotes)
    setIsUpdating(false)
    if (res.success) {
      // Update local state smoothly
      setSelectedBug(prev => prev ? { ...prev, status: newStatus, admin_notes: adminNotes } : null)
      loadBugs(true)
    } else {
      alert(`Error updating bug status: ${res.error}`)
    }
  }

  const handleToggleSelect = (e, id) => {
    e.stopPropagation()
    setSelectedBugIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    if (filteredBugs.length > 0 && filteredBugs.every(b => selectedBugIds.has(b.id))) {
      setSelectedBugIds(new Set())
    } else {
      setSelectedBugIds(new Set(filteredBugs.map(b => b.id)))
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteWarning || !deleteWarning.ids || deleteWarning.ids.length === 0) return
    setIsDeleting(true)

    let res
    if (deleteWarning.type === 'single') {
      res = await deleteBugReportAction(deleteWarning.ids[0])
    } else {
      res = await deleteBulkBugReportsAction(deleteWarning.ids)
    }

    setIsDeleting(false)

    if (res.success) {
      const deletedSet = new Set(deleteWarning.ids)
      setSelectedBugIds(prev => {
        const next = new Set(prev)
        deleteWarning.ids.forEach(id => next.delete(id))
        return next
      })
      if (selectedBug && deletedSet.has(selectedBug.id)) {
        setSelectedBug(null)
      }
      setDeleteWarning(null)
      loadBugs(true)
    } else {
      alert(`Deletion failed: ${res.error}`)
    }
  }

  const getPriorityBadgeStyle = (priority) => {
    switch (priority) {
      case 'critical':
        return 'bg-pink-950/80 text-pink-300 border-pink-500 shadow-[0_0_12px_rgba(255,0,85,0.4)] animate-pulse font-black'
      case 'high':
        return 'bg-amber-950/80 text-amber-300 border-amber-500 font-bold'
      case 'medium':
        return 'bg-cyan-950/70 text-cyan-300 border-cyan-600/60 font-medium'
      default:
        return 'bg-gray-800/80 text-gray-400 border-gray-700 font-normal'
    }
  }

  const getTierIcon = (bugType) => {
    switch (bugType) {
      case 'question': return '💡'
      case 'class': return '📺'
      case 'page': return '🎨'
      default: return '⚙️'
    }
  }

  return (
    <div className="bg-[#0A0E17] p-6 md:p-8 flex flex-col min-h-full font-mono">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-800 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-pink-500/20 text-pink-400 border border-pink-500/40 tracking-widest">
              LEVEL 7+ TRIAGE ENGINE
            </span>
            <span className="text-xs text-cyan-400 font-bold">3-TIER FEEDBACK MATRIX</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase font-sans flex items-center gap-3 mt-1.5">
            <Bug className="w-8 h-8 text-pink-400 animate-pulse shrink-0" /> Bug Reports & Triage Command Center
          </h1>
          <p className="text-xs text-gray-400 font-sans mt-1">
            Filter and resolve student-submitted issues with full diagnostic telemetry (QID, Route Path, JS Console Logs).
          </p>
        </div>

        <button
          onClick={() => loadBugs(true)}
          disabled={isRefreshing}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#111827] hover:bg-[#1f2937] text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 text-xs font-bold uppercase transition-all shadow-[0_0_15px_rgba(0,240,255,0.15)] shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Scanning DB...' : 'Sync Live Reports'}
        </button>
      </div>

      {/* QUESTION-BANK STYLE FILTER BAR */}
      <div className="bg-[#111827]/90 border border-gray-800/80 rounded-2xl p-5 mb-8 shadow-inner">
        <div className="flex flex-col gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Target QID, Route Path, Description, Category, or Reporter Email..."
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0A0E17] border border-gray-700 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all font-sans"
            />
          </div>

          {/* Grid of Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Bug Tier */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Bug Tier / Type</label>
              <select
                value={filter.bugType}
                onChange={(e) => setFilter({ ...filter, bugType: e.target.value })}
                className="w-full p-2.5 bg-[#0A0E17] border border-gray-700 rounded-xl text-xs text-gray-200 focus:outline-none focus:border-cyan-500 font-sans font-medium"
              >
                <option value="">All Tiers (4 Types)</option>
                <option value="question">💡 Question Bugs</option>
                <option value="class">📺 Class & Video Bugs</option>
                <option value="page">🎨 Page & UI Bugs</option>
                <option value="other">⚙️ Other & Account</option>
              </select>
            </div>

            {/* 2. Category Dropdown */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Specific Category</label>
              <select
                value={filter.category}
                onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                className="w-full p-2.5 bg-[#0A0E17] border border-gray-700 rounded-xl text-xs text-gray-200 focus:outline-none focus:border-cyan-500 font-sans font-medium"
              >
                <option value="">All Categories ({uniqueCategories.length || '32'})</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* 3. Status Dropdown */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Triage Status</label>
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className="w-full p-2.5 bg-[#0A0E17] border border-gray-700 rounded-xl text-xs text-gray-200 focus:outline-none focus:border-cyan-500 font-sans font-medium"
              >
                <option value="open">Open (Needs Review)</option>
                <option value="investigating">Investigating In Progress</option>
                <option value="resolved">Resolved / Verified</option>
                <option value="dismissed">Dismissed / Invalid</option>
                <option value="">All Statuses (Archive)</option>
              </select>
            </div>

            {/* 4. Priority Dropdown */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Severity Priority</label>
              <select
                value={filter.priority}
                onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
                className="w-full p-2.5 bg-[#0A0E17] border border-gray-700 rounded-xl text-xs text-gray-200 focus:outline-none focus:border-cyan-500 font-sans font-medium"
              >
                <option value="">All Priorities</option>
                <option value="critical">🔴 Critical Priority</option>
                <option value="high">🟠 High Priority</option>
                <option value="medium">🔵 Medium Priority</option>
                <option value="low">⚪ Low Priority</option>
              </select>
            </div>
          </div>

          {/* Sort & Stats Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-800/80 text-xs text-gray-400 mt-1">
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-gray-300">Filtered Reports:</span>
              <span className="px-2.5 py-0.5 rounded-md bg-pink-500/20 text-pink-300 font-bold border border-pink-500/30 text-sm">
                {filteredBugs.length}
              </span>
              <span className="text-gray-600">|</span>
              <span>Total in Category: <b className="text-gray-200">{bugs.length}</b></span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Sort by:</span>
              <select
                value={filter.sort}
                onChange={(e) => setFilter({ ...filter, sort: e.target.value })}
                className="p-1.5 px-3 border border-gray-700 rounded-lg text-xs bg-[#0A0E17] text-gray-200 font-sans font-medium"
              >
                <option value="Newest">Newest First</option>
                <option value="Oldest">Oldest First</option>
                <option value="Priority">Severity (Critical → Low)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Selection & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#111827] border border-gray-800 rounded-2xl mb-6 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={filteredBugs.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold transition border border-gray-700 disabled:opacity-50"
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filteredBugs.length > 0 && filteredBugs.every(b => selectedBugIds.has(b.id)) ? 'bg-pink-500 border-pink-400 text-white shadow-[0_0_8px_rgba(255,0,128,0.5)]' : 'border-gray-500 bg-black/40'}`}>
              {filteredBugs.length > 0 && filteredBugs.every(b => selectedBugIds.has(b.id)) && <CheckCircle2 className="w-3 h-3" />}
            </div>
            <span>
              {filteredBugs.length > 0 && filteredBugs.every(b => selectedBugIds.has(b.id)) ? 'Deselect All Filtered' : 'Select All Filtered'}
            </span>
          </button>
          {selectedBugIds.size > 0 && (
            <span className="text-xs font-bold text-pink-400 animate-pulse bg-pink-500/10 px-3 py-1.5 rounded-xl border border-pink-500/30">
              {selectedBugIds.size} report{selectedBugIds.size !== 1 ? 's' : ''} selected
            </span>
          )}
        </div>

        {selectedBugIds.size > 0 && (
          <button
            type="button"
            onClick={() => setDeleteWarning({
              isOpen: true,
              type: 'bulk',
              ids: Array.from(selectedBugIds),
              title: `Permanently delete ${selectedBugIds.size} selected bug report${selectedBugIds.size !== 1 ? 's' : ''}?`
            })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/50 hover:border-red-400 text-xs font-bold transition shadow-[0_0_15px_rgba(239,68,68,0.25)] animate-bounce"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
            <span>Delete Selected ({selectedBugIds.size})</span>
          </button>
        )}
      </div>

      {/* Reports Grid - Strictly 2 columns max on large screens per user instruction */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-pink-400" />
          <p className="text-sm font-sans tracking-wide">Scanning live telemetry database for bug reports...</p>
        </div>
      ) : filteredBugs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-[#111827]/40 rounded-2xl border border-gray-800/80 text-center p-6">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3 opacity-80" />
          <h3 className="text-lg font-bold text-white font-sans uppercase">No Matching Reports Found</h3>
          <p className="text-xs text-gray-400 font-sans max-w-md mt-1">
            There are no bug reports matching your exact filter combination ({filter.status ? `Status: [${filter.status.toUpperCase()}]` : 'All Statuses'}).
          </p>
          {(filter.search || filter.bugType || filter.category || filter.priority) && (
            <button
              onClick={() => setFilter({ search: '', bugType: '', category: '', status: 'open', priority: '', sort: 'Newest' })}
              className="mt-4 px-4 py-2 bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 rounded-xl text-xs font-bold uppercase tracking-wider border border-pink-500/40 transition-all"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-8">
          {filteredBugs.map((b) => (
            <div
              key={b.id}
              onClick={() => { setSelectedBug(b); setAdminNotes(b.admin_notes || '') }}
              className="p-6 rounded-2xl bg-[#111827]/95 border border-gray-800 hover:border-pink-500/70 cursor-pointer transition-all flex flex-col justify-between hover:shadow-[0_0_25px_rgba(255,0,128,0.2)] group relative overflow-hidden min-h-[260px]"
            >
              {/* Top Accent Bar */}
              <div className={`absolute top-0 left-0 right-0 h-1.5 transition-all group-hover:h-2 ${
                b.priority === 'critical' ? 'bg-pink-500' : b.priority === 'high' ? 'bg-amber-500' : 'bg-cyan-500'
              }`} />

              <div>
                <div className="flex items-center justify-between gap-3 mb-4 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleToggleSelect(e, b.id)}
                      title="Select report for deletion"
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center transition shrink-0 ${
                        selectedBugIds.has(b.id)
                          ? 'bg-pink-500 border-pink-400 text-white shadow-[0_0_10px_rgba(255,0,128,0.6)]'
                          : 'bg-black/60 border-gray-700 text-transparent hover:border-gray-500'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xl">{getTierIcon(b.bug_type)}</span>
                    <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase border tracking-wider ${getPriorityBadgeStyle(b.priority)}`}>
                      {b.priority} PRIORITY
                    </span>
                    <span className="px-2.5 py-0.5 rounded bg-gray-800 text-gray-300 text-[11px] font-mono uppercase tracking-wider border border-gray-700">
                      {b.bug_type}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 font-sans font-medium">
                    {new Date(b.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="text-lg font-black text-white font-sans tracking-tight mb-3 group-hover:text-pink-300 transition-colors">
                  {b.category}
                </div>

                <div className="bg-[#0A0E17]/80 p-4 rounded-xl border border-gray-800 text-sm text-gray-200 font-sans leading-relaxed mb-5 line-clamp-3">
                  {b.description}
                </div>
              </div>

              {/* Stacked 2-Row Footer ensuring zero text collisions or overlapping badges */}
              <div className="pt-4 border-t border-gray-800/80 flex flex-col gap-3 font-sans text-xs">
                {/* Row 1: Target Pill & Inspect Button */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {b.target_question_id ? (
                      <span className="px-3 py-1 rounded-lg bg-pink-950/60 text-pink-300 font-bold border border-pink-500/50 text-xs font-mono">
                        Target QID: {b.target_question_id}
                      </span>
                    ) : b.target_module_id ? (
                      <span className="px-3 py-1 rounded-lg bg-amber-950/60 text-amber-300 font-bold border border-amber-500/50 text-xs font-mono">
                        Class ID: {b.target_module_id}
                      </span>
                    ) : b.route_path ? (
                      <span className="px-3 py-1 rounded-lg bg-gray-900 text-gray-300 border border-gray-700 text-xs font-mono truncate max-w-[280px]" title={b.route_path}>
                        Route: {b.route_path}
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-lg bg-gray-900 text-gray-400 text-xs uppercase tracking-wider font-mono">
                        Status: [{b.status}]
                      </span>
                    )}
                  </div>

                  <span className="px-3 py-1 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 group-hover:border-cyan-400 text-xs font-bold transition-all shrink-0 flex items-center gap-1.5">
                    Inspect Telemetry <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>

                {/* Row 2: Reporter Email & Tier Bar */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-800/40 text-gray-400">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_6px_rgba(0,240,255,0.8)]" />
                    <span className="font-bold text-gray-200 truncate">{b.reporter_email || 'guest@prepnova.edu'}</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono uppercase font-bold shrink-0">
                      {b.user_tier || 'free'} Tier
                    </span>
                  </div>

                  <span className="text-[11px] text-gray-500 font-mono uppercase tracking-wider shrink-0">
                    Status: {b.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DIAGNOSTIC INSPECTION MODAL */}
      {selectedBug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-3xl bg-[#0A0E17] border border-pink-500/60 rounded-3xl shadow-[0_0_50px_rgba(255,0,85,0.3)] p-6 md:p-8 text-gray-100 font-sans max-h-[92vh] overflow-y-auto">
            {/* Top Glow Pulse */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-pink-500 to-transparent animate-pulse" />

            <div className="flex items-start justify-between pb-4 border-b border-gray-800 mb-6 font-mono">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest bg-pink-500/10 px-2.5 py-0.5 rounded-full border border-pink-500/30">
                    DIAGNOSTIC INSPECTION MODAL
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${getPriorityBadgeStyle(selectedBug.priority)}`}>
                    {selectedBug.priority}
                  </span>
                </div>
                <h3 className="text-lg md:text-xl font-black text-white uppercase font-sans tracking-tight">
                  {getTierIcon(selectedBug.bug_type)} {selectedBug.category}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBug(null)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reporter & Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#111827] rounded-2xl border border-gray-800 font-mono text-xs mb-6 shadow-inner">
              <div>
                <span className="text-gray-500 block text-[10px] font-bold">REPORTER EMAIL</span>
                <span className="font-bold text-gray-200 truncate block mt-0.5">{selectedBug.reporter_email || 'guest@prepnova.edu'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] font-bold">ACCOUNT TIER</span>
                <span className="font-bold text-cyan-400 uppercase tracking-wider block mt-0.5">{selectedBug.user_tier || 'free'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] font-bold">BUG TIER TYPE</span>
                <span className="font-bold text-pink-300 uppercase tracking-wider block mt-0.5">{selectedBug.bug_type}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] font-bold">SUBMITTED DATE</span>
                <span className="font-bold text-gray-300 block mt-0.5">{new Date(selectedBug.created_at).toLocaleString()}</span>
              </div>
            </div>

            {/* Target QID / Route Path Callout */}
            {(selectedBug.target_question_id || selectedBug.target_module_id || selectedBug.route_path || selectedBug.current_url) && (
              <div className="p-4 bg-cyan-950/30 border border-cyan-500/40 rounded-2xl mb-6 font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  {selectedBug.target_question_id && (
                    <div>
                      <span className="text-gray-400 text-[10px]">TARGET QUESTION ID:</span>{' '}
                      <b className="text-cyan-300 text-sm tracking-wider">{selectedBug.target_question_id}</b>
                    </div>
                  )}
                  {selectedBug.target_module_id && (
                    <div>
                      <span className="text-gray-400 text-[10px]">TARGET CLASS ID:</span>{' '}
                      <b className="text-amber-300 text-sm tracking-wider">{selectedBug.target_module_id}</b>
                      {selectedBug.device_info?.target_resource_title && (
                        <div className="text-xs text-amber-200/90 font-sans font-medium mt-0.5">
                          📌 {selectedBug.device_info.target_resource_title}
                        </div>
                      )}
                    </div>
                  )}
                  {selectedBug.route_path && (
                    <div className="truncate">
                      <span className="text-gray-400 text-[10px]">ROUTE PATH:</span>{' '}
                      <span className="text-gray-200">{selectedBug.route_path}</span>
                    </div>
                  )}
                  {selectedBug.current_url && !selectedBug.route_path && (
                    <div className="truncate">
                      <span className="text-gray-400 text-[10px]">CURRENT URL:</span>{' '}
                      <span className="text-gray-200 truncate">{selectedBug.current_url}</span>
                    </div>
                  )}
                </div>

                {selectedBug.target_question_id && (
                  <a
                    href={`/admin/question-bank`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-xl text-[11px] font-bold uppercase border border-cyan-500/40 transition-all shrink-0"
                  >
                    Inspect QID in Bank <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}

            {/* Description Area */}
            <div className="mb-6">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 font-mono">
                STUDENT DESCRIPTION & FEEDBACK
              </label>
              <div className="p-5 bg-[#111827] border border-gray-800 rounded-2xl text-sm text-gray-100 leading-relaxed font-sans whitespace-pre-wrap shadow-inner">
                {selectedBug.description}
              </div>
            </div>

            {/* Device & Client Telemetry */}
            {selectedBug.device_info && Object.keys(selectedBug.device_info).length > 0 && (
              <div className="mb-6">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" /> CAPTURED DEVICE & BROWSER DIAGNOSTICS
                </label>
                <div className="p-4 bg-gray-900/90 rounded-2xl border border-gray-800 font-mono text-xs grid grid-cols-2 sm:grid-cols-3 gap-3 text-gray-300">
                  {Object.entries(selectedBug.device_info).map(([key, val]) => (
                    <div key={key} className="overflow-hidden">
                      <span className="text-[10px] text-gray-500 block uppercase">{key.replace(/_/g, ' ')}</span>
                      <span className="font-bold truncate block">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Captured Client JS Console Errors */}
            {selectedBug.client_errors && Array.isArray(selectedBug.client_errors) && selectedBug.client_errors.length > 0 && (
              <div className="mb-6">
                <label className="block text-[10px] font-bold text-pink-400 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 animate-pulse" /> RECENT CLIENT CONSOLE ERRORS CAPTURED AT TIME OF REPORT ({selectedBug.client_errors.length})
                </label>
                <div className="p-4 bg-pink-950/20 rounded-2xl border border-pink-500/40 font-mono text-xs space-y-2 max-h-48 overflow-y-auto text-pink-300">
                  {selectedBug.client_errors.map((err, idx) => (
                    <div key={idx} className="p-2.5 bg-black/60 rounded-xl border border-pink-500/20">
                      <div className="font-bold text-pink-400 break-all">[{err.timestamp || 'ERROR'}] {err.message}</div>
                      {err.stack && <div className="text-[10px] text-gray-400 mt-1 line-clamp-2 break-all">{err.stack}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* RESOLUTION CONTROL BOX */}
            <div className="p-5 bg-[#111827] border border-gray-800 rounded-2xl font-mono shadow-xl">
              <label className="block text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-pink-400" /> ADMIN RESOLUTION WORKFLOW & TRIAGE STATUS
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                {['open', 'investigating', 'resolved', 'dismissed'].map((st) => (
                  <button
                    key={st}
                    disabled={isUpdating}
                    onClick={() => handleUpdateStatus(st)}
                    className={`py-2.5 px-3 rounded-xl font-bold uppercase text-xs transition-all border ${
                      selectedBug.status === st
                        ? st === 'resolved'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                          : st === 'investigating'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                          : st === 'dismissed'
                          ? 'bg-gray-700 text-gray-300 border-gray-500'
                          : 'bg-pink-500/20 text-pink-300 border-pink-400 shadow-[0_0_15px_rgba(255,0,85,0.3)]'
                        : 'bg-[#0A0E17] text-gray-400 border-gray-700 hover:text-white hover:border-gray-500'
                    }`}
                  >
                    {st === 'open' && '🔥 Open'}
                    {st === 'investigating' && '🔍 Investigating'}
                    {st === 'resolved' && '✅ Resolved'}
                    {st === 'dismissed' && '✕ Dismissed'}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-gray-400 uppercase">
                  Admin Investigation Notes (Visible only to Level 7+ Staff)
                </label>
                <textarea
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Enter diagnosis notes, commit SHA fixed, or verification instructions..."
                  className="w-full p-3 bg-[#0A0E17] border border-gray-700 rounded-xl text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 font-sans"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  disabled={isUpdating || isDeleting}
                  onClick={() => setDeleteWarning({
                    isOpen: true,
                    type: 'single',
                    ids: [selectedBug.id],
                    title: `Permanently delete this bug report (${selectedBug.category})?`
                  })}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50 rounded-xl text-xs font-bold uppercase transition shadow-[0_0_12px_rgba(239,68,68,0.15)] disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                  <span>Delete Bug Report</span>
                </button>

                <button
                  disabled={isUpdating}
                  onClick={() => handleUpdateStatus(selectedBug.status)}
                  className="px-6 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-[0_0_15px_rgba(255,0,128,0.3)] disabled:opacity-50"
                >
                  {isUpdating ? 'Saving Changes...' : 'Save Admin Notes & Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CYBERPUNK DESTRUCTIVE ACTION WARNING MODAL */}
      {deleteWarning && deleteWarning.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn font-mono">
          <div className="relative w-full max-w-md bg-[#0f111a] border-2 border-red-500/80 rounded-3xl shadow-[0_0_60px_rgba(239,68,68,0.4)] p-6 md:p-7 text-gray-100 font-sans">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse" />
            
            <div className="flex items-center gap-3.5 mb-4 text-red-400">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 animate-bounce text-red-500" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-red-400 block">
                  CRITICAL DESTRUCTIVE ACTION
                </span>
                <h4 className="text-lg font-black text-white uppercase tracking-tight">Confirm Deletion</h4>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed mb-6 font-mono bg-red-950/20 p-4 rounded-2xl border border-red-500/30">
              <span className="font-bold text-red-300 block mb-1">⚠️ WARNING: IRREVERSIBLE OPERATION</span>
              {deleteWarning.title}
              <br /><br />
              All associated diagnostic telemetry, user environment logs, and admin notes will be permanently erased from the database.
            </p>

            <div className="flex items-center justify-end gap-3 font-mono">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteWarning(null)}
                className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold uppercase transition border border-gray-700"
              >
                Cancel / Abort
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase transition shadow-[0_0_20px_rgba(239,68,68,0.5)] disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
