'use client'

import React, { useState } from 'react'
import { Bug, X, AlertTriangle, CheckCircle, Loader2, Clock } from 'lucide-react'
import { createBugReportAction } from '@/app/actions/bugActions'

const CATEGORIES_BY_TYPE = {
  question: [
    'Wrong Answer Key',
    'Typo / Grammar',
    'Context / Passage Text Broken',
    'Math Formula Rendering Issue',
    'UI Layout / Box Alignment Misaligned',
    'Other Question Issue'
  ],
  class: [
    'Video Not Playing / Loading Error',
    'Audio Out of Sync / Low Volume',
    'Video Player Controls Not Working',
    'Stream Freezing / Buffering',
    'Material / PDF / Worksheet Not Loading',
    'Slide / Formula Sheet Text Unreadable or Broken',
    'Broken Link or Missing Resource File',
    'Class or Material Title / Description Incorrect',
    'Other Class or Material Issue'
  ],
  page: [
    'Page / Button Not Responding',
    'Slow Loading / Performance Issue',
    'Display / Styling Broken',
    'Feature Not Working as Expected',
    'Other Page / UI Issue'
  ],
  other: [
    'Account / Profile Issue',
    'Practice Test Access Issue',
    'Feature Suggestion / Feedback',
    'Other System Issue'
  ]
}

export default function ReportBugModal({ isOpen, onClose, questionId = null, moduleId = null, testId = null, questionIndex = null, contextRoute = '', initialBugType = null, initialCategory = null, activeResourceTitle = null }) {
  const initialType = initialBugType || (questionId ? 'question' : 'page')
  const [bugType, setBugType] = useState(initialType)
  const [category, setCategory] = useState(initialCategory || CATEGORIES_BY_TYPE[initialType][0])
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  React.useEffect(() => {
    if (isOpen) {
      if (initialBugType) {
        setBugType(initialBugType)
        setCategory(initialCategory || CATEGORIES_BY_TYPE[initialBugType]?.[0] || CATEGORIES_BY_TYPE.page[0])
      } else {
        const defaultType = questionId ? 'question' : 'page'
        setBugType(defaultType)
        setCategory(CATEGORIES_BY_TYPE[defaultType][0])
      }
    }
  }, [isOpen, initialBugType, initialCategory, questionId])

  if (!isOpen) return null

  const handleTypeChange = (newType) => {
    setBugType(newType)
    setCategory((newType === initialBugType && initialCategory) ? initialCategory : (CATEGORIES_BY_TYPE[newType]?.[0] || CATEGORIES_BY_TYPE.page[0]))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    if (!description.trim()) {
      setErrorMsg('Please enter a brief description of what is wrong.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)

    const payload = {
      bugType,
      category,
      description: description.trim(),
      currentUrl: typeof window !== 'undefined' ? window.location.href : '',
      routePath: contextRoute || (typeof window !== 'undefined' ? window.location.pathname : ''),
      targetQuestionId: questionId,
      targetModuleId: moduleId,
      targetTestId: testId,
      questionIndex: questionIndex !== null && questionIndex !== undefined ? Number(questionIndex) : null,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
      deviceInfo: {
        screen_width: typeof window !== 'undefined' ? window.innerWidth : null,
        screen_height: typeof window !== 'undefined' ? window.innerHeight : null
      }
    }

    try {
      const res = await createBugReportAction(payload)
      if (res && res.error) {
        setErrorMsg(res.error)
      } else {
        setSubmitted(true)
      }
    } catch (err) {
      setErrorMsg('An unexpected network error occurred while submitting your report.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetAndClose = () => {
    setSubmitted(false)
    setDescription('')
    const resetType = initialBugType || (questionId ? 'question' : 'page')
    setBugType(resetType)
    setCategory(initialCategory || CATEGORIES_BY_TYPE[resetType]?.[0] || CATEGORIES_BY_TYPE.page[0])
    setErrorMsg(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-sans animate-in fade-in duration-200" onClick={handleResetAndClose}>
      <div 
        className="bg-[#1a1a1a] border border-gray-700 rounded-2xl p-6 sm:p-8 max-w-md w-full text-white shadow-2xl relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <Bug className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-none text-white">Report Issue</h3>
              <p className="text-gray-400 text-xs mt-1">Help us improve by sharing what looks wrong</p>
            </div>
          </div>
          <button 
            onClick={handleResetAndClose}
            className="text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-xl text-white">Report Submitted!</h4>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">
              Thank you for helping us maintain top quality. Our engineering team has received your report and diagnostics.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-sm tracking-wide transition border border-white/10"
              >
                {bugType === 'class' ? 'Return to Class' : bugType === 'question' ? 'Return to Question' : 'Close & Return'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {(bugType === 'question' || testId || questionId || contextRoute?.includes('/quiz/') || contextRoute?.includes('/test/')) && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-medium leading-snug shadow-inner">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                <span>Exam timer is paused while this window is open.</span>
              </div>
            )}
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-start gap-2 leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Issue Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-black/40 border border-gray-800 rounded-xl">
                {[
                  { id: 'question', label: '💡 Question' },
                  { id: 'class', label: '📺 Class/Media' },
                  { id: 'page', label: '🎨 Page & UI' },
                  { id: 'other', label: '⚙️ Other' }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTypeChange(t.id)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition-all truncate ${
                      bugType === t.id
                        ? 'bg-red-600 text-white shadow-md'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Issue Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#121212] border border-gray-700 rounded-xl text-white text-sm focus:border-red-500 focus:outline-none transition font-medium"
              >
                {(CATEGORIES_BY_TYPE[bugType] || CATEGORIES_BY_TYPE.question).map((cat) => (
                  <option key={cat} value={cat} className="bg-[#121212] text-white py-1">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Description & Details
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What exactly looks wrong with this question or option? (e.g., option C typo, math equation clipped, answer key error)"
                rows={4}
                maxLength={2000}
                required
                className="w-full p-3.5 bg-[#121212] border border-gray-700 rounded-xl text-white text-sm focus:border-red-500 focus:outline-none transition resize-none leading-relaxed placeholder:text-gray-600"
              />
              <div className="text-right text-[11px] text-gray-500 mt-1">
                {description.length} / 2000
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-5 py-2.5 bg-transparent hover:bg-white/5 text-gray-400 hover:text-white rounded-xl text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !description.trim()}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:pointer-events-none text-white rounded-xl text-sm font-bold tracking-wide transition shadow-lg flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <span>Submit Report</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
