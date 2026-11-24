'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Flag } from 'lucide-react'
import ReportBugModal from '@/components/ReportBugModal'

export default function FloatingBugReportButton() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-full shadow-[0_4px_20px_rgba(239,68,68,0.4)] border border-red-400/40 backdrop-blur-md transition-all hover:scale-105 active:scale-95 group text-xs tracking-wide"
        title="Report an issue on this page"
      >
        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-12 transition-transform">
          <Flag className="w-3 h-3 text-white fill-white/20" />
        </div>
        <span>Report Issue</span>
      </button>

      <ReportBugModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialBugType="page"
        contextRoute={pathname || ''}
      />
    </>
  )
}
