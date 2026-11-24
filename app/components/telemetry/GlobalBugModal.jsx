'use client'

import React, { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { createBugReportAction } from '@/app/actions/bugActions'

export function GlobalBugModal({ questionId = null, moduleId = null, testId = null, questionIndex = null }) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [category, setCategory] = useState('Typo/Content')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState(null)
  const [clientErrors, setClientErrors] = useState([])

  // Ring buffer for tracking up to 10 recent client console/window errors automatically
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleError = (msg, url, lineNo, columnNo, error) => {
      setClientErrors(prev => [
        ...prev.slice(-9),
        {
          message: typeof msg === 'string' ? msg : error?.message || 'Unknown JavaScript Error',
          source: `${url || 'inline'}:${lineNo || 0}`,
          timestamp: new Date().toISOString()
        }
      ])
      return false
    }

    const handleRejection = (event) => {
      setClientErrors(prev => [
        ...prev.slice(-9),
        {
          message: event.reason?.message || typeof event.reason === 'string' ? event.reason : 'Unhandled Promise Rejection',
          source: 'promise_rejection',
          timestamp: new Date().toISOString()
        }
      ])
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    // Keyboard shortcut Ctrl+Shift+B to toggle modal
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'B' || e.key === 'b')) {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!description.trim()) return

    setIsSubmitting(true)
    setSubmitResult(null)

    // Attempt to discover QID/Module ID automatically from DOM data attributes if on practice pages
    let activeQid = questionId
    let activeModId = moduleId
    if (!activeQid && typeof document !== 'undefined') {
      const qEl = document.querySelector('[data-qid], [data-question-id]')
      if (qEl) activeQid = qEl.getAttribute('data-qid') || qEl.getAttribute('data-question-id')
    }

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const deviceInfo = typeof window !== 'undefined' ? {
      screenResolution: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language || 'en',
      platform: navigator.platform || 'unknown'
    } : {}

    const res = await createBugReportAction({
      category,
      description,
      currentUrl: typeof window !== 'undefined' ? window.location.href : pathname,
      routePath: pathname || '/',
      targetQuestionId: activeQid || null,
      targetModuleId: activeModId || null,
      targetTestId: testId || null,
      questionIndex: questionIndex || null,
      clientErrors,
      userAgent: ua,
      deviceInfo
    })

    setIsSubmitting(false)
    if (res.error) {
      setSubmitResult({ success: false, message: res.error })
    } else {
      setSubmitResult({ success: true, message: 'Bug report & diagnostic context transmitted to Level 9 Triage successfully!' })
      setDescription('')
      setTimeout(() => {
        setIsOpen(false)
        setSubmitResult(null)
      }, 2000)
    }
  }

  const categories = [
    { id: 'Typo/Content', label: '📝 Typo or Content Glitch', desc: 'Text formatting, grammar, or reading passage errors' },
    { id: 'Math LaTeX Error', label: '📐 Math LaTeX / Formula Error', desc: 'Broken equations, symbols, or unrendered formulas' },
    { id: 'Wrong Answer Key', label: '❌ Incorrect Answer Key', desc: 'Correct option marked wrong or inaccurate rationale' },
    { id: 'UI/Layout Glitch', label: '🎨 UI / Layout Glitch', desc: 'Misaligned buttons, overlapping text, or mobile bugs' },
    { id: 'System/Crash', label: '💥 System Freeze / Crash', desc: 'Page frozen, timer stuck, or button unresponsive' }
  ]

  return (
    <>
      {/* Sleek Floating Cyber Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        title="Report Bug / Feedback (Ctrl+Shift+B)"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-3.5 py-2.5 bg-[#0A0E17]/90 hover:bg-[#111827] text-cyan-400 border border-cyan-500/50 hover:border-cyan-400 rounded-full shadow-[0_0_15px_rgba(0,240,255,0.2)] transition-all transform hover:scale-105 active:scale-95 group font-mono text-xs backdrop-blur-md"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
        </span>
        <svg className="w-4 h-4 text-cyan-400 group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="font-semibold tracking-wider uppercase">Report Bug</span>
      </button>

      {/* Cyberpunk Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-[#0A0E17] border border-cyan-500/60 rounded-2xl shadow-[0_0_40px_rgba(0,240,255,0.25)] p-6 text-gray-100 font-sans overflow-hidden">
            {/* Top Scanline Glow */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />

            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-black tracking-wider uppercase text-cyan-400 font-mono">Bug & Friction Diagnostics</h3>
                  <p className="text-xs text-gray-400">Context, Route ({pathname}) & Errors Attached Automatically</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800/80 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Category Selector */}
              <div>
                <label className="block text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  1. Select Category
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                        category === cat.id
                          ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.15)]'
                          : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-300'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold font-mono">{cat.label}</div>
                        <div className="text-[10px] text-gray-500">{cat.desc}</div>
                      </div>
                      {category === cat.id && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#00F0FF]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2000 Character Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider">
                    2. Describe Issue / Glitch (Up to 2000 chars)
                  </label>
                  <span className={`text-[11px] font-mono ${description.length > 1800 ? 'text-pink-400' : 'text-gray-500'}`}>
                    {description.length} / 2000
                  </span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  placeholder="Explain exactly what happened, which question number had a typo, or how to reproduce this glitch..."
                  className="w-full p-3 bg-gray-950/90 border border-gray-800 focus:border-cyan-400 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 transition-all font-sans resize-none shadow-inner"
                  required
                />
              </div>

              {/* Diagnostic Context Pill preview */}
              <div className="p-2.5 rounded-xl bg-gray-900/80 border border-gray-800/80 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-gray-400">
                <span className="text-cyan-400 font-semibold">⚡ Attached Context:</span>
                <span>Route: <span className="text-gray-200">{pathname || '/'}</span></span>
                {questionId && <span>QID: <span className="text-emerald-400 font-bold">{questionId}</span></span>}
                {clientErrors.length > 0 && <span className="text-amber-400 font-semibold">⚠️ {clientErrors.length} Console Logs Attached</span>}
              </div>

              {/* Submission Result Notice */}
              {submitResult && (
                <div className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                  submitResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-pink-500/10 border-pink-500/40 text-pink-300'
                }`}>
                  <span>{submitResult.success ? '✅' : '❌'}</span>
                  <span>{submitResult.message}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-xs font-mono text-gray-400 hover:text-gray-200 uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !description.trim()}
                  className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black font-mono text-xs uppercase tracking-wider rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_25px_rgba(0,240,255,0.5)] transition-all transform hover:scale-105 active:scale-95"
                >
                  {isSubmitting ? 'Transmitting...' : 'Transmit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
