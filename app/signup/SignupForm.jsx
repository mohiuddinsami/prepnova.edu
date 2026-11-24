'use client'

import { useState } from 'react'
import { signup } from './actions'
import Link from 'next/link'

export default function SignupForm({ serverError }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [clientError, setClientError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handlePasswordChange = (e) => {
    const val = e.target.value
    setPassword(val)
    if (confirmPassword && val !== confirmPassword) {
      setClientError('Passwords do not match')
    } else {
      setClientError('')
    }
  }

  const handleConfirmChange = (e) => {
    const val = e.target.value
    setConfirmPassword(val)
    if (password && val !== password) {
      setClientError('Passwords do not match')
    } else {
      setClientError('')
    }
  }

  const handleSubmit = (e) => {
    if (password !== confirmPassword) {
      e.preventDefault()
      setClientError('Passwords do not match')
      alert('⚠️ Passwords do not match! Please verify your password inputs.')
      return
    }
    setSubmitting(true)
  }

  const activeError = clientError || serverError

  return (
    <div>
      {/* Floating Visual Toast Pop-up */}
      {activeError && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 bg-red-900/90 border-2 border-red-500 text-white rounded-2xl shadow-[0_10px_40px_rgba(239,68,68,0.5)] backdrop-blur-2xl animate-bounce">
          <span className="text-2xl">⚠️</span>
          <div>
            <h4 className="font-bold text-sm">Validation Error</h4>
            <p className="text-xs text-red-200">{activeError}</p>
          </div>
        </div>
      )}

      {activeError && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm text-center backdrop-blur-sm animate-pulse font-semibold">
          ⚠️ {activeError}
        </div>
      )}

      <form action={signup} onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-white/80" htmlFor="full_name">Full Name</label>
          <input id="full_name" name="full_name" type="text" required placeholder="Ilham hossain" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#D0F288]/50 focus:border-[#D0F288] transition-all" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-white/80" htmlFor="email">Email Address</label>
          <input id="email" name="email" type="email" required placeholder="you@example.com" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#D0F288]/50 focus:border-[#D0F288] transition-all" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-white/80" htmlFor="password">Password</label>
          <input 
            id="password" 
            name="password" 
            type="password" 
            required 
            value={password}
            onChange={handlePasswordChange}
            placeholder="Create a strong password" 
            className={`w-full p-3 bg-white/5 border rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 transition-all ${clientError ? 'border-red-500/50 focus:ring-red-500/50' : 'border-white/10 focus:ring-[#D0F288]/50 focus:border-[#D0F288]'}`} 
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-white/80" htmlFor="confirm_password">Confirm Password</label>
          <input 
            id="confirm_password" 
            name="confirm_password" 
            type="password" 
            required 
            value={confirmPassword}
            onChange={handleConfirmChange}
            placeholder="Re-enter your password" 
            className={`w-full p-3 bg-white/5 border rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 transition-all ${clientError ? 'border-red-500/50 focus:ring-red-500/50' : 'border-white/10 focus:ring-[#D0F288]/50 focus:border-[#D0F288]'}`} 
          />
          
          <div className="mt-2 p-4 bg-yellow-500/10 border border-yellow-500/30 text-yellow-200/90 text-xs rounded-xl text-center leading-relaxed backdrop-blur-sm">
            <strong className="block text-yellow-400 font-semibold mb-1">Important: Do not forget your password!</strong> 
            There is no automatic password recovery available. If you lose your password, you must contact an administrator to reset it.
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-white/80" htmlFor="institution">Institution</label>
          <input id="institution" name="institution" type="text" placeholder="High School Name" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#D0F288]/50 focus:border-[#D0F288] transition-all" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-white/80" htmlFor="whatsapp_number">WhatsApp Number</label>
            <input id="whatsapp_number" name="whatsapp_number" type="text" placeholder="+1 234 567 8900" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#D0F288]/50 focus:border-[#D0F288] transition-all" />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-white/80" htmlFor="academic_year">Academic Class</label>
            <input id="academic_year" name="academic_year" type="text" placeholder="Class 9/ HSC 27" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#D0F288]/50 focus:border-[#D0F288] transition-all" />
          </div>
        </div>

        <div className="flex items-start gap-3 mt-2 mb-2">
          <input 
            type="checkbox" 
            id="tos_agreed" 
            name="tos_agreed" 
            value="true"
            required 
            className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-[#D0F288] focus:ring-[#D0F288] focus:ring-offset-0 transition-all cursor-pointer"
          />
          <label htmlFor="tos_agreed" className="text-sm text-white/70">
            I agree to the <Link href="/terms" target="_blank" className="text-[#D0F288] hover:underline">Terms of Service and Privacy Policy</Link>
          </label>
        </div>
        
        <button 
          type="submit" 
          disabled={submitting || !!clientError}
          className={`w-full py-3 font-bold rounded-xl shadow-[0_0_20px_rgba(208,242,136,0.3)] transition-all ${submitting || clientError ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50 shadow-none' : 'bg-[#D0F288] hover:bg-[#bce668] text-[#050805] hover:shadow-[0_0_30px_rgba(208,242,136,0.5)] active:scale-[0.98]'}`}
        >
          {submitting ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
    </div>
  )
}
