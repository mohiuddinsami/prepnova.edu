'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FolderOpen, ChevronRight, Lock, Unlock } from 'lucide-react'
import GuestRegistrationModal from '@/app/components/GuestRegistrationModal'

export default function ModulesExplorerClient({ items = [], moduleMap = {}, currentPathArray = [], parentUrl = '/dashboard', userLevel = 1, adminLevel = 1, isOverride = false }) {
  const router = useRouter()
  const [guestModal, setGuestModal] = useState(false)
  const [lockedModal, setLockedModal] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const folders = items.filter(i => i.type === 'folder')
  const modules = items.filter(i => i.type === 'module')

  const handleModuleClick = (moduleItem, hasAccess) => {
    if (userLevel === 0) {
      setGuestModal(true)
      return
    }
    if (!hasAccess) {
      setLockedModal(true)
      return
    }
    router.push(`/quiz/${moduleItem.id}`)
  }

  return (
    <div className="text-white">
      <Link href={parentUrl.replace(/\/$/, '') || '/dashboard'} className="inline-flex items-center gap-2 text-sm text-[#D0F288] hover:text-[#bce668] hover:underline font-medium mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <h1 className="text-3xl font-bold mb-8 tracking-tight">/{currentPathArray[currentPathArray.length - 1]}</h1>

      {items.length === 0 && (
        <div className="text-white/50 text-center py-12 bg-[#0a0f0a]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl">
          This folder is empty.
        </div>
      )}

      {/* Render Folders */}
      {folders.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-bold text-white/80 mb-4 tracking-tight">Folders</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {folders.map(folder => (
              <Link
                key={folder.id}
                href={`/dashboard/modules/${currentPathArray.concat(folder.name).join('/')}`.replace(/\/+/g, '/')}
                className="group bg-[#0a0f0a]/60 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 p-5 flex items-center gap-4 hover:border-[#D0F288]/50 hover:bg-white/5 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#D0F288]/10 group-hover:border-[#D0F288]/30 transition-all text-white/50 group-hover:text-[#D0F288] shadow-inner">
                  <FolderOpen className="w-6 h-6 drop-shadow-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white truncate group-hover:text-[#D0F288] transition-colors">{folder.name}</h3>
                </div>
                <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-[#D0F288] transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Render Modules */}
      {modules.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-white/80 mb-4 tracking-tight">Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map(file => {
              const module = moduleMap[file.reference_id]
              if (!module) return null
              const reqLevel = module.required_level ?? 1
              const hasAccess = userLevel >= reqLevel || (adminLevel >= 7 && !isOverride)

              return (
                <div
                  key={file.id}
                  onClick={() => handleModuleClick(module, hasAccess)}
                  className={`relative bg-[#0a0f0a]/60 backdrop-blur-xl rounded-3xl shadow-xl border border-white/10 p-6 flex flex-col transition-all cursor-pointer ${!hasAccess ? 'opacity-75 hover:border-white/30' : 'hover:border-[#D0F288]/50 hover:bg-white/5 hover:-translate-y-1'}`}
                >
                  {!hasAccess && (
                    <div className="absolute inset-0 bg-[#050805]/70 backdrop-blur-[3px] rounded-3xl z-10 flex items-center justify-center border border-white/5">
                      <div className="bg-[#D0F288] shadow-[0_0_20px_rgba(208,242,136,0.4)] text-[#050805] px-6 py-2.5 rounded-full font-bold flex items-center gap-2 tracking-wide text-sm">
                        <Lock className="w-4 h-4" /> Level {reqLevel} Required
                      </div>
                    </div>
                  )}

                  <div className="relative z-20 flex justify-between items-start mb-4 gap-2">
                    <h2 className="text-xl font-bold text-white tracking-tight line-clamp-2">{file.name}</h2>
                    {reqLevel <= 1 ? (
                      <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full flex items-center gap-1 shrink-0"><Unlock className="w-3 h-3"/> Level 1</span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full flex items-center gap-1 shrink-0"><Lock className="w-3 h-3"/> Level {reqLevel}</span>
                    )}
                  </div>
                  <p className="relative z-20 text-white/50 text-sm mb-6 font-light">{module.question_ids?.length || 0} Questions • {module.time_limit_minutes} Mins</p>

                  <button
                    type="button"
                    className={`mt-auto block w-full text-center py-3 rounded-xl font-bold transition-all ${hasAccess ? 'bg-[#D0F288] text-[#050805] hover:bg-[#bce668] shadow-[0_0_15px_rgba(208,242,136,0.2)]' : 'bg-white/5 border border-white/10 text-white/50'}`}
                  >
                    {hasAccess ? 'Start Practice' : 'Locked'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
                This module requires a higher User Level than your current plan.
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
    </div>
  )
}
