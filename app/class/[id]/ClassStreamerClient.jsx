'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Play, Video, FileText, Sparkles, Clock, Lock, Unlock, Flag } from 'lucide-react'
import { useTelemetry } from '@/app/components/telemetry/TelemetryProvider'
import ReportBugModal from '@/components/ReportBugModal'

export default function ClassStreamerClient({ activePackage, userLevel = 1, adminLevel = 1, userName }) {
  const playerRef = useRef(null)
  const { logClassWatch, logEvent } = useTelemetry()
  const [showReportModal, setShowReportModal] = useState(false)

  const currentRecordings = activePackage?.recordings?.length > 0
    ? activePackage.recordings
    : (activePackage?.video_id ? [{ id: '1', title: 'Main Lecture Recording', video_id: activePackage.video_id, duration: activePackage.duration }] : [])

  const [activeContent, setActiveContent] = useState({
    type: 'recording',
    index: 0,
    data: currentRecordings[0] || {}
  })

  const loggedClassRef = useRef(null)
  const activeContentRef = useRef(activeContent)
  useEffect(() => { activeContentRef.current = activeContent }, [activeContent])

  // Log exact +1 view increment whenever the class package mounts (deduplicated per package ID per page lifecycle)
  useEffect(() => {
    if (activePackage?.id && loggedClassRef.current !== activePackage.id) {
      loggedClassRef.current = activePackage.id
      logEvent({
        eventType: 'page_view',
        eventName: `Loaded Class: ${activePackage.title || activePackage.id}`,
        targetClassId: activePackage.id,
        routePath: window.location?.pathname || `/class/${activePackage.id}`
      })
    }
  }, [activePackage?.id, logEvent])

  // Periodic 10-second heartbeat whenever viewing or sitting with the class package open
  useEffect(() => {
    if (!activePackage?.id) return
    const interval = setInterval(() => {
      const cur = activeContentRef.current
      logClassWatch(
        activePackage.id,
        10,
        `${activePackage.title} (${cur.type === 'recording' ? `Part ${cur.index + 1}` : cur.data?.title || 'Package Open'})`
      )
    }, 10000)
    return () => clearInterval(interval)
  }, [activePackage?.id, logClassWatch])

  // Global Keyboard Shortcuts (Fullscreen)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        if (!document.fullscreenElement) {
          playerRef.current?.requestFullscreen?.()
        } else {
          document.exitFullscreen?.()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!activePackage) return null

  const embedUrl = activeContent.type === 'recording'
    ? `/api/recordings/embed/${activePackage.id}?vid=${activeContent.data?.video_id || ''}`
    : activeContent.data?.url

  return (
    <div className="relative h-screen w-screen bg-[#050805] text-white flex overflow-hidden font-sans selection:bg-[#D0F288] selection:text-black">
      {/* Tilted Grid & Radial Lighting Background matching Main Dashboard */}
      <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none">
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-[#D0F288] opacity-[0.05] rounded-full blur-[120px] mix-blend-screen translate-x-[-30%] translate-y-[-30%]"></div>
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[#D0F288] opacity-[0.03] rounded-full blur-[100px] mix-blend-screen translate-x-[20%] translate-y-[20%]"></div>
        <div 
          className="absolute inset-[-50%] z-0" 
          style={{ 
            backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`, 
            backgroundSize: '50px 50px', 
            transform: 'rotate(-12deg) scale(1.2)' 
          }} 
        />
      </div>
      
      {/* Left Sidebar: Proportional ratio measurement (18% - 22% width) */}
      {/* Left Sidebar matching exact styling of Main Dashboard */}
      <aside className="relative z-30 w-64 min-w-[256px] max-w-[280px] bg-[#121812]/80 backdrop-blur-2xl border-r border-white/10 p-6 flex flex-col h-full shadow-[4px_0_24px_rgba(0,0,0,0.5)] shrink-0">
        
        {/* Header matching exact spacing and typography of Main Dashboard */}
        <div className="mb-8 flex flex-col items-center text-center gap-4 shrink-0">
          <Link href="/dashboard" className="flex flex-col items-center text-center gap-4 group">
            <img src="/logo.png" alt="Prepnova Logo" className="h-10 object-contain drop-shadow-[0_0_10px_rgba(208,242,136,0.2)] group-hover:scale-105 transition" />
            <h2 className="text-xl font-bold text-white tracking-tight group-hover:text-[#D0F288] transition">Student Portal</h2>
          </Link>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar -mx-2 px-2">
          
          {/* Lectures Section */}
          <div className="space-y-2">
            <h4 className="px-3 text-[11px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <Video className="w-3.5 h-3.5 text-[#D0F288]" /> Lectures ({currentRecordings.length})
            </h4>
            <div className="space-y-1.5 pt-1">
              {currentRecordings.map((rec, idx) => {
                const isActive = activeContent.type === 'recording' && activeContent.index === idx
                return (
                  <button
                    key={rec.id || idx}
                    onClick={() => setActiveContent({ type: 'recording', index: idx, data: rec })}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-left transition flex items-center gap-3 group font-bold border ${
                      isActive
                        ? 'bg-[#D0F288] text-[#050805] font-black border-[#D0F288] shadow-[0_0_20px_rgba(208,242,136,0.25)]'
                        : 'bg-white/5 hover:bg-white/10 text-white border-transparent hover:border-white/10'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                      isActive ? 'bg-black text-[#D0F288]' : 'bg-black/50 text-gray-400 group-hover:text-white'
                    }`}>
                      {isActive ? <Play className="w-3 h-3 fill-current ml-0.5" /> : idx + 1}
                    </span>
                    <span className="text-sm font-extrabold tracking-wide truncate">
                      Part {idx + 1}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Class Materials Section */}
          {activePackage.resources?.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              <h4 className="px-3 text-[11px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Class Materials ({activePackage.resources.length})
              </h4>
              <div className="space-y-1.5 pt-1">
                {activePackage.resources.map((res, idx) => {
                  const isActive = activeContent.type === 'resource' && activeContent.index === idx
                  const isFormula = res.type === 'formula' || res.title?.toLowerCase().includes('formula')
                  const typeKey = res.type === 'slide' ? 'slide' : isFormula ? 'formula' : res.type === 'pdf' ? 'pdf' : 'link'
                  
                  let count = 0
                  for (let i = 0; i <= idx; i++) {
                    const r = activePackage.resources[i]
                    const rIsFormula = r.type === 'formula' || r.title?.toLowerCase().includes('formula')
                    const rKey = r.type === 'slide' ? 'slide' : rIsFormula ? 'formula' : r.type === 'pdf' ? 'pdf' : 'link'
                    if (rKey === typeKey) count++
                  }

                  const resIcon = typeKey === 'slide' ? '📊' : typeKey === 'formula' ? '📐' : typeKey === 'pdf' ? '📄' : '🔗'
                  const displayLabel = typeKey === 'slide' ? `Slide ${count}` : typeKey === 'formula' ? `Formula Sheet ${count}` : typeKey === 'pdf' ? `Worksheet ${count}` : `Resource ${count}`

                  return (
                    <button
                      key={res.id || idx}
                      onClick={() => setActiveContent({ type: 'resource', index: idx, data: res })}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-left transition flex items-center gap-3 group font-bold border ${
                        isActive
                          ? 'bg-emerald-500 text-black font-black border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-white border-emerald-500/20 hover:border-emerald-500/40'
                      }`}
                    >
                      <span className="text-base shrink-0">{resIcon}</span>
                      <span className="text-sm font-extrabold tracking-wide truncate">
                        {displayLabel}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

        </div>

        {/* Bottom User Info & Second Back to Classes Button matching Main Dashboard */}
        <div className="mt-auto border-t border-white/10 pt-4 shrink-0">
          <div className="text-sm font-medium text-white truncate">{userName || 'Sayed Md. Mohiuddin Sami'}</div>
          <div className="text-xs text-[#D0F288] mb-4 font-semibold">{({ 7: 'Master Plan (Tester)', 6: 'Master Plan', 5: 'Flash Plan (Tester)', 4: 'Flash Plan', 3: 'Practice Plan (Tester)', 2: 'Practice Plan', 1: 'Free Plan' })[userLevel] || 'Free Plan'}</div>
          
          <Link
            href="/dashboard/classes"
            className="w-full block text-center text-sm font-black text-white bg-white/10 py-3 rounded-xl hover:bg-white/20 hover:text-[#D0F288] transition shadow tracking-wide"
          >
            ← Back
          </Link>
        </div>
      </aside>

      {/* Main Content Viewport: Fluid flex filling remaining ratio */}
      <main className="relative z-10 flex-1 h-full flex flex-col p-4 md:p-6 lg:p-8 overflow-y-auto min-w-0">
        
        {/* Top Header Bar matching wireframe */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4 shrink-0">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-[#D0F288] border border-white/10">
                {activePackage.subject || 'GENERAL'}
              </span>
              {(activePackage.required_level ?? 1) <= 1 ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                  <Unlock className="w-3 h-3" /> Level 1
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Lock className="w-3 h-3" /> Level {activePackage.required_level ?? 1}
                </span>
              )}
            </div>
            <h1 className="text-lg md:text-xl lg:text-2xl font-black text-white leading-tight truncate">
              {activePackage.title}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-sans font-bold text-gray-200 bg-white/10 hover:bg-red-500/20 hover:text-red-400 border border-white/15 hover:border-red-500/40 rounded-xl transition-all shadow-sm active:scale-95 group shrink-0"
            title="Report an issue with this class or video"
          >
            <Flag className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-400 transition-colors" />
            <span className="tracking-wide">Report</span>
          </button>
        </div>

        {/* Main Stage Row: Left aligned video box + Right side controls guidance */}
        <div className="mt-4 flex flex-col lg:flex-row items-start gap-6 w-full">
          {/* Left Aligned Video / Viewer Box */}
          <div
            ref={playerRef}
            className={`w-full lg:flex-1 rounded-3xl overflow-hidden bg-black border border-white/15 shadow-2xl relative flex flex-col shrink-0 ${activeContent.type === 'recording' ? 'aspect-video max-w-5xl' : 'min-h-[75vh]'}`}
          >
            {activeContent.type === 'recording' ? (
              <iframe
                key={activeContent.data?.video_id || 'video'}
                src={embedUrl}
                className="w-full h-full flex-1 border-0"
                allow="autoplay; fullscreen; encrypted-media"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full flex-1 relative flex flex-col bg-[#1e1e1e]">
                <iframe
                  key={activeContent.data?.url || 'doc'}
                  src={embedUrl}
                  className="w-full h-full flex-1 border-0"
                  allow="autoplay; fullscreen"
                  title={activeContent.data?.title}
                />
                {/* Transparent click shield over Google Drive pop-out button */}
                <div
                  className="absolute top-0 right-0 w-24 h-16 bg-transparent z-10 cursor-default"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  title="Protected Resource"
                />
              </div>
            )}
          </div>

          {/* Right Side Guidance Panel */}
          {activeContent.type === 'recording' ? (
            <div className="w-full lg:w-80 shrink-0 p-6 rounded-3xl bg-[#121812] border border-white/10 shadow-xl space-y-5">
              <div className="flex items-center gap-2.5 pb-3.5 border-b border-white/10">
                <span className="w-3 h-3 rounded-full bg-[#D0F288] animate-pulse" />
                <h4 className="text-sm font-black uppercase tracking-widest text-[#D0F288]">
                  Controls Guidance
                </h4>
              </div>

              <div className="space-y-3.5 text-sm font-extrabold text-gray-200">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/50 border border-white/10 shadow-sm">
                  <span className="text-gray-300 font-bold">Play / Pause</span>
                  <kbd className="px-3.5 py-1.5 bg-white/15 text-[#D0F288] rounded-xl border border-white/25 font-mono text-sm font-black shadow-md">Space</kbd>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/50 border border-white/10 shadow-sm">
                  <span className="text-gray-300 font-bold">Seek 10s</span>
                  <kbd className="px-3.5 py-1.5 bg-white/15 text-[#D0F288] rounded-xl border border-white/25 font-mono text-sm font-black shadow-md">◀ / ▶</kbd>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/50 border border-white/10 shadow-sm">
                  <span className="text-gray-300 font-bold">Fullscreen</span>
                  <kbd className="px-3.5 py-1.5 bg-white/15 text-[#D0F288] rounded-xl border border-white/25 font-mono text-sm font-black shadow-md">f</kbd>
                </div>
              </div>

              <div className="pt-2 text-xs text-gray-400 font-medium leading-relaxed">
                Tip: Click inside the player window to focus video controls before using keyboard shortcuts.
              </div>
            </div>
          ) : (
            <div className="w-full lg:w-80 shrink-0 p-6 rounded-3xl bg-[#121812] border border-white/10 shadow-xl space-y-5">
              <div className="flex items-center gap-2.5 pb-3.5 border-b border-white/10">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <h4 className="text-sm font-black uppercase tracking-widest text-emerald-400">
                  Viewer Guidance
                </h4>
              </div>

              <div className="space-y-3.5 text-sm font-extrabold text-gray-200">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/50 border border-white/10 shadow-sm">
                  <span className="text-gray-300 font-bold">Navigate Pages</span>
                  <kbd className="px-3.5 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/30 font-mono text-sm font-black shadow-md">Scroll / Wheel</kbd>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/50 border border-white/10 shadow-sm">
                  <span className="text-gray-300 font-bold">Zoom In / Out</span>
                  <kbd className="px-3.5 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/30 font-mono text-sm font-black shadow-md">+ / -</kbd>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/50 border border-white/10 shadow-sm">
                  <span className="text-gray-300 font-bold">Fullscreen (Enlarge)</span>
                  <kbd className="px-3.5 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/30 font-mono text-sm font-black shadow-md">f / Esc</kbd>
                </div>
              </div>

              <div className="pt-2 text-xs text-gray-400 font-medium leading-relaxed">
                Tip: Press <strong className="text-emerald-300 font-bold">f</strong> to enlarge document to fullscreen (press <strong className="text-emerald-300 font-bold">f</strong> again or <strong className="text-emerald-300 font-bold">Esc</strong> to cancel). Use <strong className="text-emerald-300 font-bold">+ / -</strong> keys or on-screen buttons to zoom.
              </div>
            </div>
          )}
        </div>

        {/* Bottom Status & Details Banner */}
        <div className="mt-6 space-y-6">
          <div className="p-5 rounded-2xl bg-[#121812] border border-white/10 flex flex-wrap items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full animate-pulse shrink-0 ${activeContent.type === 'recording' ? 'bg-[#D0F288]' : 'bg-emerald-400'}`} />
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 block">
                  {activeContent.type === 'recording' ? 'Now Playing Lecture' : 'Viewing Class Material'}
                </span>
                <h3 className="text-base font-black text-white mt-0.5">
                  {activeContent.type === 'recording' ? `Part ${activeContent.index + 1}: ${activeContent.data.title}` : activeContent.data.title}
                </h3>
              </div>
            </div>
          </div>

          {/* About This Lecture */}
          {activePackage.description && (
            <div className="p-6 md:p-8 rounded-3xl bg-[#121812] border border-white/10 space-y-3 shadow-lg">
              <h4 className="text-xs font-black uppercase tracking-widest text-[#D0F288] flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> About This Lecture
              </h4>
              <p className="text-sm md:text-base text-gray-300 leading-relaxed font-medium whitespace-pre-line">
                {activePackage.description}
              </p>
            </div>
          )}
        </div>

        {/* Bug Report Modal */}
        <ReportBugModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          moduleId={activePackage.id}
          contextRoute={typeof window !== 'undefined' ? window.location.pathname : `/class/${activePackage.id}`}
          initialBugType="class"
          initialCategory={activeContent?.type === 'resource' ? 'Material / PDF / Worksheet Not Loading' : 'Video Not Playing / Loading Error'}
          activeResourceTitle={activeContent?.type === 'recording' ? `Lecture Part ${activeContent.index + 1}: ${activeContent.data?.title || 'Video'}` : `Material: ${activeContent?.data?.title || 'Resource'}`}
        />
      </main>

    </div>
  )
}
