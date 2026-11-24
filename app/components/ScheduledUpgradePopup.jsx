'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, Crown, CheckCircle2, ArrowRight } from 'lucide-react'
import { checkPendingUpgradeAction, claimScheduledUpgradeAction } from '@/app/actions/userUpgradeActions'

export default function ScheduledUpgradePopup() {
  const [mounted, setMounted] = useState(false)
  const [pending, setPending] = useState(null)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setMounted(true)
    const checkUpgrade = async () => {
      const res = await checkPendingUpgradeAction()
      if (res && res.pending) {
        setPending(res.pending)
      }
    }
    checkUpgrade()
  }, [])

  if (!mounted || !pending) return null

  const handleClaim = async () => {
    setClaiming(true)
    setError(null)
    const res = await claimScheduledUpgradeAction(pending.id)
    if (res.error) {
      setError(res.error)
      setClaiming(false)
    } else {
      setClaimed(true)
      setTimeout(() => {
        setPending(null)
        window.location.reload()
      }, 1500)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      {/* Glow effects */}
      <div className="absolute w-96 h-96 bg-gradient-to-tr from-purple-600/30 to-[#D0F288]/30 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-lg bg-[#0a0f0a] border-2 border-purple-500/50 rounded-3xl p-8 sm:p-10 shadow-[0_0_60px_rgba(168,85,247,0.3)] text-center overflow-hidden">
        {/* Top Celebration Badge */}
        <div className="mx-auto w-20 h-20 bg-gradient-to-tr from-purple-600 to-[#D0F288] rounded-full p-0.5 shadow-xl mb-6 flex items-center justify-center">
          <div className="w-full h-full bg-[#0a0f0a] rounded-full flex items-center justify-center">
            <Crown className="w-10 h-10 text-[#D0F288] animate-bounce" />
          </div>
        </div>

        {claimed ? (
          <div className="py-8 space-y-4">
            <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">Upgrade Claimed!</h2>
            <p className="text-gray-300">Welcome to your new plan! Refreshing your dashboard...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="inline-block px-4 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-black uppercase tracking-widest shadow-inner">
                🎉 Exclusive Gift Unlocked
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Hey {pending.name}!
              </h2>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3 text-left">
              <div className="flex items-center justify-between text-sm text-gray-400">
                <span>Current Plan:</span>
                <span className="font-semibold text-gray-300">{pending.currentPlanName}</span>
              </div>
              <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                <span className="text-sm font-bold text-purple-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#D0F288]" /> New Plan Status:
                </span>
                <span className="font-black text-lg text-[#D0F288]">{pending.targetPlanName}</span>
              </div>
            </div>

            <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
              You have been officially upgraded to <strong className="text-white">{pending.targetPlanName}</strong> valid until <strong className="text-[#D0F288]">{new Date(pending.expiresAt).toLocaleDateString()}</strong>! Click below to claim your reward and unlock unlimited access immediately.
            </p>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full py-4 px-8 rounded-2xl font-black text-lg bg-gradient-to-r from-[#D0F288] to-[#bce668] text-[#050805] hover:brightness-110 shadow-[0_0_25px_rgba(208,242,136,0.4)] transition-all transform active:scale-95 flex items-center justify-center gap-2"
            >
              {claiming ? (
                <span>Claiming Upgrade...</span>
              ) : (
                <>
                  <span>Claim It</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
