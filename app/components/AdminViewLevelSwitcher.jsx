'use client'

import { useState, useTransition } from 'react'
import { setAdminViewLevelAction } from '@/app/actions/adminViewActions'
import { Eye, ShieldAlert, RefreshCw } from 'lucide-react'

const LEVELS = [
  { value: 'real', label: '🛡️ Real Admin (Default)', color: 'border-purple-500/50 text-purple-300' },
  { value: '6', label: '⚡ Level 6 (Master Plan)', color: 'border-emerald-500/50 text-emerald-300' },
  { value: '4', label: '⚡ Level 4 (Flash Plan)', color: 'border-blue-500/50 text-blue-300' },
  { value: '2', label: '⚡ Level 2 (Practice Plan)', color: 'border-amber-500/50 text-amber-300' },
  { value: '1', label: '🛡️ Level 1 (Free Plan)', color: 'border-gray-400/50 text-gray-300' },
  { value: '0', label: '🔒 Level 0 (Guest / Unauth)', color: 'border-red-500/50 text-red-400' },
]

export default function AdminViewLevelSwitcher({ adminLevel, currentOverride }) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)

  if (!adminLevel || adminLevel < 7) return null

  const activeOption = LEVELS.find(l => l.value === String(currentOverride ?? 'real')) || LEVELS[0]

  const handleSelect = (val) => {
    setIsOpen(false)
    startTransition(async () => {
      await setAdminViewLevelAction(val === 'real' ? null : val)
    })
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end">
      <div className="flex items-center gap-2 bg-[#0f150f]/95 border border-[#D0F288]/40 shadow-[0_0_25px_rgba(208,242,136,0.25)] rounded-2xl p-1.5 backdrop-blur-xl">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#D0F288]/10 text-[#D0F288] text-xs font-black tracking-wide">
          <Eye className="w-3.5 h-3.5" />
          <span>ADMIN VIEW</span>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isPending}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition hover:bg-white/10 ${activeOption.color} ${isPending ? 'opacity-50' : ''}`}
        >
          {isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
          <span>{activeOption.label}</span>
          <span className="text-[10px] opacity-60">▼</span>
        </button>
      </div>

      {isOpen && (
        <div className="mt-2 w-64 bg-[#0f150f] border border-white/15 rounded-2xl p-2 shadow-2xl flex flex-col gap-1 backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-wider border-b border-white/10 mb-1">
            Simulate User Access Level
          </div>
          {LEVELS.map(lvl => {
            const isSelected = activeOption.value === lvl.value
            return (
              <button
                key={lvl.value}
                onClick={() => handleSelect(lvl.value)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${isSelected ? 'bg-[#D0F288] text-[#050805] shadow' : 'text-white/80 hover:bg-white/10'}`}
              >
                <span>{lvl.label}</span>
                {isSelected && <span className="text-xs">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
