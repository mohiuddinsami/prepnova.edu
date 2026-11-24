'use client'

import React, { useState } from 'react'
import { History, Sparkles, UserPlus, LogIn } from 'lucide-react'
import Link from 'next/link'
import GuestRegistrationModal from '@/app/components/GuestRegistrationModal'

export default function HistoryGuestClient() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
      <div className="w-20 h-20 bg-[#D0F288]/10 rounded-full border border-[#D0F288]/30 flex items-center justify-center mb-6 shadow-inner text-[#D0F288]">
        <History className="w-10 h-10" />
      </div>
      
      <h1 className="text-3xl font-black text-white tracking-tight mb-4">
        Track Your Performance History
      </h1>
      
      <p className="text-gray-400 max-w-md text-sm leading-relaxed mb-8">
        Sign up for free or log in to automatically save your test scores, analyze section breakdowns, and track progress over time.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs">
        <Link
          href="/signup"
          className="flex-1 py-3.5 rounded-xl font-black text-sm bg-[#D0F288] text-[#050805] hover:brightness-110 shadow-lg shadow-[#D0F288]/20 transition flex items-center justify-center gap-2"
        >
          <UserPlus className="w-4 h-4" /> Sign Up Free
        </Link>

        <Link
          href="/login"
          className="flex-1 py-3.5 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/15 text-white border border-white/10 transition flex items-center justify-center gap-2"
        >
          <LogIn className="w-4 h-4" /> Log In
        </Link>
      </div>
    </div>
  )
}
