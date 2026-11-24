'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Sparkles, UserPlus, LogIn, X } from 'lucide-react'

export default function GuestRegistrationModal({ isOpen, onClose }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#121812] border border-[#D0F288]/30 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-[0_0_50px_rgba(208,242,136,0.15)] relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 rounded-2xl bg-[#D0F288]/10 border border-[#D0F288]/30 flex items-center justify-center text-[#D0F288] mx-auto shadow-inner">
          <Sparkles className="w-8 h-8" />
        </div>

        <div>
          <h3 className="text-2xl font-black text-white leading-tight">
            Register Now for Unlimited Content & Practice
          </h3>
          <p className="text-gray-400 text-sm mt-2 leading-relaxed">
            Create a free account or log in to unlock thousands of SAT practice questions, video modules, and full-length simulated exams.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Link
            href="/signup"
            className="w-full py-3.5 rounded-xl font-black text-sm bg-[#D0F288] text-[#050805] hover:brightness-110 shadow-lg shadow-[#D0F288]/20 transition flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> Sign Up for Free
          </Link>

          <Link
            href="/login"
            className="w-full py-3.5 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/15 text-white border border-white/10 transition flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" /> Log In to Account
          </Link>
        </div>
      </div>
    </div>,
    document.body
  )
}
