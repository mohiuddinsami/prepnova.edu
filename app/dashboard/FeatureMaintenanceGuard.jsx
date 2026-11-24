import Link from 'next/link'
import { ShieldAlert, ArrowLeft } from 'lucide-react'

export default function FeatureMaintenanceGuard({ access, children }) {
  if (!access) return children

  // If unauthorized (regular user visiting a locked section)
  if (!access.authorized) {
    return (
      <div className="w-full h-full flex-1 flex flex-col items-center justify-center p-6 text-white min-h-[75vh]">
        <div className="max-w-md w-full bg-[#121812]/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
          {/* Glowing background accent */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#D0F288]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-[#D0F288]/10 border border-[#D0F288]/30 flex items-center justify-center text-[#D0F288] mx-auto mb-6 shadow-inner">
            <span className="text-3xl">🚧</span>
          </div>

          <span className="inline-block px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-black uppercase tracking-wider mb-3">
            System Upgrading
          </span>

          <h2 className="text-2xl font-black tracking-tight text-white mb-3">
            {access.featureName || 'Section Under Maintenance'}
          </h2>

          <p className="text-sm text-gray-300 leading-relaxed mb-8">
            {access.message || 'We are currently upgrading this section to bring you a better learning experience. Please check back shortly!'}
          </p>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 w-full px-6 py-3.5 rounded-xl bg-[#D0F288] hover:bg-[#bce070] text-[#050805] font-black text-sm transition transform active:scale-95 shadow-lg"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // If authorized via Admin Bypass when the section is locked for students
  return (
    <div className="flex-1 flex flex-col w-full h-full">
      {access.isAdminBypass && (
        <div className="bg-amber-500 text-black px-4 py-2 font-black text-xs flex items-center justify-between shadow-sm shrink-0 border-b border-amber-600">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>⚠️ MAINTENANCE BYPASS ACTIVE: Regular students are currently locked out of this section. You are accessing it via Admin Level {access.adminLevel}.</span>
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
