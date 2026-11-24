'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Folder, Video, Play, Lock, Unlock, Clock, Sparkles, X, FileText, ExternalLink, ChevronRight, Download } from 'lucide-react'
import GuestRegistrationModal from '@/app/components/GuestRegistrationModal'

const parseDurationToSeconds = (durStr) => {
  if (!durStr) return 0;
  let sec = 0;
  const hMatch = durStr.match(/(\d+)\s*h/i);
  const mMatch = durStr.match(/(\d+)\s*m/i);
  const sMatch = durStr.match(/(\d+)\s*s/i);
  if (hMatch) sec += parseInt(hMatch[1], 10) * 3600;
  if (mMatch) sec += parseInt(mMatch[1], 10) * 60;
  if (sMatch) sec += parseInt(sMatch[1], 10);
  return sec;
};

const formatSecondsToDuration = (totalSeconds) => {
  if (!totalSeconds || totalSeconds <= 0) return '0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes < 10 ? '0' : ''}${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m${seconds > 0 ? ' ' + seconds + 's' : ''}`;
  }
  return `${seconds}s`;
};

const getPackageDuration = (pkg) => {
  if (pkg.recordings && pkg.recordings.length > 0) {
    let totalSec = 0;
    pkg.recordings.forEach(r => {
      totalSec += parseDurationToSeconds(r.duration);
    });
    if (totalSec > 0) return formatSecondsToDuration(totalSec);
  }
  return pkg.duration || '1h 00m';
};

export default function ClassesExplorerClient({ items = [], classesData = [], currentDirectory = '/root/classes', userLevel = 1, adminLevel = 1, isOverride = false, parentUrl }) {
  const router = useRouter()
  const [lockedModal, setLockedModal] = useState(false)
  const [guestModal, setGuestModal] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Separate folders and class items
  const folders = items.filter(i => i.type === 'folder')
  const classPointers = items.filter(i => i.type === 'class')

  // Map class reference ID to actual class data
  const classMap = {}
  classesData.forEach(c => { classMap[c.id] = c })

  // List of packages to render in this directory
  const packagesToRender = classPointers.map(p => classMap[p.reference_id]).filter(Boolean)

  // Include any unassigned classes if we are at root
  if (currentDirectory === '/root/classes') {
    const renderedIds = new Set(packagesToRender.map(p => p.id))
    classesData.forEach(c => {
      if (!renderedIds.has(c.id)) packagesToRender.push(c)
    })
  }

  const handlePackageClick = (pkg) => {
    if (userLevel === 0) {
      setGuestModal(true)
      return
    }
    const reqLevel = pkg.required_level ?? 1;
    if (userLevel < reqLevel && (adminLevel < 7 || isOverride)) {
      setLockedModal(true)
    } else {
      router.push(`/class/${pkg.id}`)
    }
  }

  const breadcrumbs = currentDirectory.split('/').filter(Boolean)

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
            {breadcrumbs.slice(1).map((part, idx) => (
              <React.Fragment key={idx}>
                <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span className={idx === breadcrumbs.length - 2 ? 'text-[#D0F288]' : ''}>{part}</span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Folders Grid */}
        {folders.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Folders</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {folders.map(f => {
                const folderPath = `/dashboard/classes/${breadcrumbs.slice(2).concat(f.name).join('/')}`
                return (
                  <Link key={f.id} href={folderPath.replace(/\/+/g, '/')} className="group bg-[#121812] rounded-2xl shadow-xl border border-white/10 p-5 flex items-center gap-4 hover:border-[#D0F288]/50 hover:bg-white/5 transition-all">
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#D0F288]/10 group-hover:border-[#D0F288]/30 transition-all text-[#D0F288] shadow-inner shrink-0">
                      <Folder className="w-6 h-6 fill-[#D0F288]/20 group-hover:scale-110 transition duration-300" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white truncate group-hover:text-[#D0F288] transition-colors text-base">{f.name}</h3>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-[#D0F288] transition-colors shrink-0" />
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Classes Grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Classes ({packagesToRender.length})</h3>
          
          {packagesToRender.length === 0 && folders.length === 0 ? (
            <div className="text-center py-20 bg-[#121812]/50 border border-white/10 rounded-3xl text-gray-400">
              <Video className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-lg font-bold text-white">This directory is empty</p>
              <p className="text-sm text-gray-500 mt-1">Check back soon or explore other folders.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {packagesToRender.map(pkg => {
                const recCount = pkg.recordings?.length || (pkg.video_id ? 1 : 0)
                const resCount = pkg.resources?.length || 0
                const reqLevel = pkg.required_level ?? 1
                const isLocked = userLevel < reqLevel && (adminLevel < 7 || isOverride)

                return (
                  <div
                    key={pkg.id}
                    onClick={() => handlePackageClick(pkg)}
                    className="group bg-[#121812] rounded-3xl overflow-hidden border border-white/10 hover:border-[#D0F288]/50 transition-all duration-300 flex flex-col cursor-pointer shadow-xl hover:-translate-y-1.5 relative"
                  >
                    {/* Thumbnail Container */}
                    <div className="relative aspect-video w-full bg-black overflow-hidden">
                      {pkg.thumbnail_url ? (
                        <img src={pkg.thumbnail_url} alt={pkg.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black text-gray-700">
                          <Video className="w-12 h-12" />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-[#121812] via-transparent to-black/30" />

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                        <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-black/60 backdrop-blur-md text-[#D0F288] border border-white/10">
                          {pkg.subject}
                        </span>

                        {reqLevel <= 1 ? (
                          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 backdrop-blur-md">
                            <Unlock className="w-3 h-3" /> Level 1
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 backdrop-blur-md">
                            <Lock className="w-3 h-3" /> Level {reqLevel}
                          </span>
                        )}
                      </div>

                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-300 ${
                          isLocked 
                            ? 'bg-amber-500/80 text-black shadow-[0_0_30px_rgba(245,158,11,0.5)]' 
                            : 'bg-[#D0F288] text-[#050805] shadow-[0_0_30px_rgba(208,242,136,0.5)] group-hover:scale-110'
                        }`}>
                          {isLocked ? <Lock className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
                        </div>
                      </div>

                      <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/80 backdrop-blur-md text-[11px] font-bold text-gray-300 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#D0F288]" /> {getPackageDuration(pkg)}
                      </div>
                    </div>

                    {/* Content Details */}
                    <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <h4 className="text-lg font-black text-white group-hover:text-[#D0F288] transition-colors line-clamp-2 leading-snug">
                          {pkg.title}
                        </h4>
                      </div>

                      {/* Footer Info */}
                      <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs font-bold text-gray-400">
                        <span className="flex items-center gap-1.5 text-white">
                          <Video className="w-4 h-4 text-[#D0F288]" /> {recCount} {recCount === 1 ? 'Part' : 'Parts'}
                        </span>
                        {resCount > 0 && (
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <FileText className="w-4 h-4" /> {resCount} {resCount === 1 ? 'Resource' : 'Resources'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* Locked Premium Modal via Portal */}
      {mounted && lockedModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#121812] border border-amber-500/30 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-[0_0_50px_rgba(245,158,11,0.2)]">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white">Access Level Required</h3>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                This class package requires a higher User Level than your current tier.
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

      {/* Guest Registration Modal */}
      <GuestRegistrationModal isOpen={guestModal} onClose={() => setGuestModal(false)} />

    </main>
  )
}
