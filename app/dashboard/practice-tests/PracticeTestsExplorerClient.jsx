'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Folder, ChevronRight, Lock, Unlock, FileText, FileCheck, Settings, Play, Clock, Sparkles } from 'lucide-react'
import GuestRegistrationModal from '@/app/components/GuestRegistrationModal'

function TestCard({ file, test, hasAccess, handleTestClick, router }) {
  if (!hasAccess) {
    return (
      <div
        className="group bg-[#121812] rounded-3xl p-5 border border-white/10 hover:border-amber-500/40 transition-all duration-300 flex flex-col justify-between shadow-xl hover:-translate-y-1 relative"
      >
        {/* Top Row: FileCheck Icon + Title Side-by-Side, Locked Pill on Right */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-3.5 min-w-0 flex-1 pr-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/10 group-hover:border-amber-500/30 transition-all shrink-0 mt-0.5">
              <FileCheck className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <h3 className="text-sm xl:text-base font-extrabold text-white group-hover:text-amber-400 transition-colors leading-snug break-words">
              {file.name}
            </h3>
          </div>

          <div className="shrink-0 pt-0.5">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Lock className="w-3 h-3" /> Locked
            </span>
          </div>
        </div>

        {/* Golden Lock Upgrade Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            router.push('/upgrade')
          }}
          className="w-full py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-amber-500 to-amber-400 text-black hover:brightness-105 shadow-[0_4px_15px_rgba(245,158,11,0.2)] active:scale-[0.98]"
        >
          <Lock className="w-4 h-4 fill-black/20" /> UPGRADE TO UNLOCK
        </button>
      </div>
    )
  }

  return (
    <div
      className="group bg-[#121812] rounded-3xl p-5 border border-white/10 hover:border-[#D0F288]/40 transition-all duration-300 flex flex-col justify-between shadow-xl hover:-translate-y-1 relative"
    >
      {/* Top Row: Icon + Title Side-by-Side on Left, Pill on Right */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3.5 min-w-0 flex-1 pr-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#D0F288] group-hover:bg-[#D0F288]/10 group-hover:border-[#D0F288]/30 transition-all shrink-0 mt-0.5">
            <FileCheck className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <h3 className="text-sm xl:text-base font-extrabold text-white group-hover:text-[#D0F288] transition-colors leading-snug break-words">
            {file.name}
          </h3>
        </div>

        <div className="shrink-0 pt-0.5">
          <span className="inline-flex items-center px-3 py-1 rounded-xl text-[11px] font-bold bg-white/5 text-gray-300 border border-white/10">
            Adaptive
          </span>
        </div>
      </div>

      {/* Bottom Crisp Action Button - ONLY Clickable Area */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          handleTestClick(test, hasAccess)
        }}
        className="w-full py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer bg-[#D0F288] text-[#0a1205] hover:bg-[#bde576] shadow-[0_4px_15px_rgba(208,242,136,0.15)] active:scale-[0.98]"
      >
        START TEST
      </button>
    </div>
  )
}

export default function PracticeTestsExplorerClient({ items = [], testMap = {}, currentPathArray = [], parentUrl = '/dashboard', userLevel = 1, adminLevel = 1, isOverride = false }) {
  const router = useRouter()
  const [guestModal, setGuestModal] = useState(false)
  const [lockedModal, setLockedModal] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const folders = items.filter(i => i.type === 'folder')
  const tests = items.filter(i => i.type === 'test')

  const handleTestClick = (testItem, hasAccess) => {
    if (userLevel === 0) {
      setGuestModal(true)
      return
    }
    if (!hasAccess) {
      setLockedModal(true)
      return
    }
    router.push(`/test/${testItem.id}`)
  }

  const cleanedPath = (currentPathArray || []).filter(p => p && p !== 'root' && p !== 'practice-tests')
  const breadcrumbs = ['practice-tests', ...cleanedPath]

  return (
    <main className="flex-1 min-h-screen text-white p-6 md:p-12 relative overflow-x-hidden">
      
      {/* Ambient background glows */}
      <div className="fixed top-20 left-1/4 w-96 h-96 bg-[#D0F288]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* Navigation / Back Button */}
        <div className="flex items-center justify-between">
          <Link href={parentUrl.replace(/\/$/, '') || '/dashboard'} className="inline-flex items-center gap-2 text-sm text-[#D0F288] hover:text-[#bce668] hover:underline font-bold transition">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>

          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 overflow-x-auto">
            <span>Dashboard</span>
            {breadcrumbs.map((part, idx) => (
              <React.Fragment key={idx}>
                <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span className={idx === breadcrumbs.length - 1 ? 'text-[#D0F288]' : ''}>{part}</span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Folders Grid */}
        {folders.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Folders</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {folders.map(folder => {
                const folderPath = `/dashboard/practice-tests/${cleanedPath.concat(folder.name).join('/')}`
                return (
                  <Link
                    key={folder.id}
                    href={folderPath.replace(/\/+/g, '/')}
                    className="group bg-[#121812] rounded-2xl shadow-xl border border-white/10 p-5 flex items-center gap-4 hover:border-[#D0F288]/50 hover:bg-white/5 transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#D0F288]/10 group-hover:border-[#D0F288]/30 transition-all text-[#D0F288] shadow-inner shrink-0">
                      <Folder className="w-6 h-6 fill-[#D0F288]/20 group-hover:scale-110 transition duration-300" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white truncate group-hover:text-[#D0F288] transition-colors text-base">{folder.name}</h3>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-[#D0F288] transition-colors shrink-0" />
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Practice Tests Grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Practice Tests ({tests.length})</h3>

          {tests.length === 0 && folders.length === 0 ? (
            <div className="text-center py-20 bg-[#121812]/50 border border-white/10 rounded-3xl text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-lg font-bold text-white">This directory is empty</p>
              <p className="text-sm text-gray-500 mt-1">Check back soon or explore other folders.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tests.map(file => {
                const test = testMap[file.reference_id]
                if (!test) return null
                const reqLevel = test.required_level ?? 1
                const hasAccess = userLevel >= reqLevel || (adminLevel >= 7 && !isOverride)

                return (
                  <TestCard
                    key={file.id}
                    file={file}
                    test={test}
                    hasAccess={hasAccess}
                    handleTestClick={handleTestClick}
                    router={router}
                  />
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* Guest Registration Modal */}
      <GuestRegistrationModal isOpen={guestModal} onClose={() => setGuestModal(false)} />

      {/* Locked Upgrade Modal */}
      {mounted && lockedModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#121812] border border-amber-500/30 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-[0_0_50px_rgba(245,158,11,0.2)]">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white">Access Level Required</h3>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                This practice test requires a higher User Level than your current plan.
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <Link
                href="/upgrade"
                className="w-full py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-400 text-black hover:brightness-110 shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
              >
                Upgrade to Premium
              </Link>
              <button
                onClick={() => setLockedModal(false)}
                className="w-full py-3 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 text-gray-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </main>
  )
}
