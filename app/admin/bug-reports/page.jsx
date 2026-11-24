import React from 'react'
import { verifyToolAccessAction } from '@/app/actions/adminUserActions'
import { BugTriageBoard } from './components/BugTriageBoard'

export const revalidate = 0

export default async function BugReportsPage() {
  const access = await verifyToolAccessAction('bug-reports')
  if (!access.authorized && access.level < 7) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center bg-[#0A0E17] text-gray-100 flex-1 min-h-[600px] font-mono">
        <div className="w-20 h-20 rounded-full bg-pink-950/60 border border-pink-500 flex items-center justify-center text-pink-400 text-3xl font-black mb-6 shadow-[0_0_25px_rgba(255,0,128,0.3)] animate-pulse">🔒</div>
        <h2 className="text-3xl font-black text-white mb-2 tracking-tight font-sans">Clearance Restricted</h2>
        <p className="text-gray-400 max-w-md mb-6 font-sans">This Cyberpunk Bug & Friction Triage room strictly requires <span className="font-bold text-pink-400">Level {access.minReq || 7}</span> clearance as configured in the Owner Control Room. Your current role tier is <span className="font-bold text-red-500">Level {access.level}</span>.</p>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#0A0E17] text-gray-100 flex flex-col flex-1">
      <BugTriageBoard />
    </div>
  )
}
