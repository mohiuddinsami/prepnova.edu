'use client'

import React, { useState } from 'react'
import { Sparkles, Gift, CheckCircle, Loader2 } from 'lucide-react'
import { claimPracticePromoAction } from '@/app/actions/userUpgradeActions'
import { useRouter } from 'next/navigation'

export default function PromoPopup() {
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [success, setSuccess] = useState(false)
  const [show, setShow] = useState(true)
  const router = useRouter()

  const handleClaim = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await claimPracticePromoAction()
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setSuccess(true)
        setTimeout(() => {
          setShow(false)
          router.refresh()
        }, 3000)
      }
    } catch (err) {
      setErrorMsg('Failed to claim promotion.')
    } finally {
      setLoading(false)
    }
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans">
      <div className="bg-[#0a0f0a] border-2 border-emerald-500 rounded-3xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(16,185,129,0.3)] relative overflow-hidden animate-in zoom-in duration-300">
        
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-emerald-500/20 blur-[50px] pointer-events-none rounded-full" />

        <div className="relative z-10 flex flex-col items-center text-center">
          
          {success ? (
            <div className="flex flex-col items-center py-6 animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Promotion Claimed!</h2>
              <p className="text-emerald-400 font-medium">You now have Practice Mode access for the next 28 days.</p>
              <p className="text-white/50 text-sm mt-4">Redirecting...</p>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <Gift className="w-8 h-8 text-emerald-400" />
              </div>
              
              <h2 className="text-2xl md:text-3xl font-black text-white mb-3 tracking-tight leading-tight">
                Surprise Upgrade!
              </h2>
              
              <p className="text-white/70 mb-6 font-medium">
                You have been gifted <span className="text-emerald-400 font-bold">Practice Mode</span> for exactly 4 weeks (28 days). You can now do practice modules and take full mock tests!
              </p>

              {errorMsg && (
                <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm font-medium">
                  {errorMsg}
                </div>
              )}

              <button
                onClick={handleClaim}
                disabled={loading}
                className="w-full py-4 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#050805] font-black text-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] flex items-center justify-center gap-2 hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Accept & Enter Practice Mode
                  </>
                )}
              </button>

              <p className="text-white/40 text-xs mt-4">
                This is a one-time promotional offer.
              </p>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
