'use client'

import { useState } from 'react'
import { updateProfile, updatePassword, resetUserProgress } from './actions'
import Link from 'next/link'
import { User, Lock, School, Phone, GraduationCap, Mail, Save, CheckCircle2, AlertCircle, Camera, Crown, Sparkles, Target, Flame, BookOpen, Calculator, Trash2, RefreshCw, X, ChevronRight, AlertTriangle } from 'lucide-react'

const ENGLISH_DOMAINS = [
  { domain: 'Information and Ideas', topics: [
    { id: 'central_ideas', label: 'Central Ideas and Details' },
    { id: 'command_evidence', label: 'Command of Evidence' },
    { id: 'inferences', label: 'Inferences' },
  ]},
  { domain: 'Craft and Structure', topics: [
    { id: 'cross_text', label: 'Cross-Text Connections' },
    { id: 'text_structure', label: 'Text Structure and Purpose' },
    { id: 'words_in_context', label: 'Words in Context' },
  ]},
  { domain: 'Expression of Ideas', topics: [
    { id: 'rhetorical_synthesis', label: 'Rhetorical Synthesis' },
    { id: 'transitions', label: 'Transitions' },
  ]},
  { domain: 'Standard English Conventions', topics: [
    { id: 'boundaries', label: 'Boundaries' },
    { id: 'form_structure', label: 'Form, Structure, and Sense' },
  ]},
]

const MATH_DOMAINS = [
  { domain: 'Algebra', topics: [
    { id: 'linear_equations', label: 'Linear equations' },
    { id: 'linear_inequalities', label: 'Linear inequalities' },
  ]},
  { domain: 'Advanced Math', topics: [
    { id: 'equiv_exp', label: 'Equivalent expressions' },
    { id: 'nonlinear_func_eq', label: 'Nonlinear functions and equations' },
  ]},
  { domain: 'Problem-Solving and Data Analysis', topics: [
    { id: 'ratios_percentages_rates', label: 'Ratios, percentage, rates, proportional relationships, and units' },
    { id: 'one_two_var_data', label: 'One-variable & Two-variable data: Models and scatterplots, Distributions and measures of center and spread' },
    { id: 'probability', label: 'Probability and conditional probability' },
    { id: 'statistics', label: 'Statistics' },
  ]},
  { domain: 'Geometry and Trigonometry', topics: [
    { id: 'area_volume', label: 'Area and volume' },
    { id: 'lines_angles', label: 'Lines, angles, and triangles' },
    { id: 'right_trig', label: 'Right triangles and trigonometry' },
    { id: 'circles', label: 'Circles' },
  ]},
]

export default function ProfileClient({ profile, email }) {
  // Independent Loading States
  const [loadingBio, setLoadingBio] = useState(false)
  const [loadingScores, setLoadingScores] = useState(false)
  const [loadingFirstMockScores, setLoadingFirstMockScores] = useState(false)
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [loadingPass, setLoadingPass] = useState(false)
  const [loadingReset, setLoadingReset] = useState(false)

  // Independent Status Alerts
  const [bioStatus, setBioStatus] = useState({ type: '', msg: '' })
  const [scoreStatus, setScoreStatus] = useState({ type: '', msg: '' })
  const [firstMockScoreStatus, setFirstMockScoreStatus] = useState({ type: '', msg: '' })
  const [topicStatus, setTopicStatus] = useState({ type: '', msg: '' })
  const [passStatus, setPassStatus] = useState({ type: '', msg: '' })

  const [toast, setToast] = useState('')
  const [activeTopicTab, setActiveTopicTab] = useState('math')

  // Type RESET Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmKeyword, setConfirmKeyword] = useState('')
  const [resetError, setResetError] = useState('')

  // SAT Score State
  const [rwScore, setRwScore] = useState(profile?.latest_sat_rw || '')
  const [mathScore, setMathScore] = useState(profile?.latest_sat_math || '')
  const [scoreError, setScoreError] = useState('')

  // First Mock Score State
  const [firstMockRwScore, setFirstMockRwScore] = useState(profile?.first_mock_sat_rw || '')
  const [firstMockMathScore, setFirstMockMathScore] = useState(profile?.first_mock_sat_math || '')
  const [firstMockScoreError, setFirstMockScoreError] = useState('')
  
  // Weak Topics State
  const [selectedTopics, setSelectedTopics] = useState(profile?.weak_topics || [])

  const totalScore = (parseInt(rwScore, 10) || 0) + (parseInt(mathScore, 10) || 0)
  const totalFirstMockScore = (parseInt(firstMockRwScore, 10) || 0) + (parseInt(firstMockMathScore, 10) || 0)

  const triggerToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  const toggleTopic = (id) => {
    setSelectedTopics(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  const validateScores = () => {
    const rw = parseInt(rwScore, 10)
    const math = parseInt(mathScore, 10)
    
    if (rwScore !== '' && (rw < 200 || rw > 800 || rw % 10 !== 0)) {
      return 'Reading & Writing score must be between 200 and 800 in increments of 10 (e.g. 680, 720).'
    }
    if (mathScore !== '' && (math < 200 || math > 800 || math % 10 !== 0)) {
      return 'Math section score must be between 200 and 800 in increments of 10 (e.g. 750, 780).'
    }
    return ''
  }

  const handleBioSubmit = async (e) => {
    e.preventDefault()
    setLoadingBio(true)
    setBioStatus({ type: '', msg: '' })

    try {
      const formData = new FormData(e.target)
      const res = await updateProfile(formData)

      if (res?.error) {
        setBioStatus({ type: 'error', msg: res.error })
      } else if (res?.success) {
        setBioStatus({ type: 'success', msg: 'Personal details updated!' })
        triggerToast('✨ Personal details saved!')
      }
    } catch (err) {
      setBioStatus({ type: 'error', msg: 'Failed to save details. Timeout.' })
    } finally {
      setLoadingBio(false)
    }
  }

  const handleScoresSubmit = async (e) => {
    e.preventDefault()
    const err = validateScores()
    if (err) {
      setScoreError(err)
      triggerToast('⚠️ Invalid SAT Score Format!')
      return
    }
    setScoreError('')
    setLoadingScores(true)
    setScoreStatus({ type: '', msg: '' })

    try {
      const formData = new FormData(e.target)
      const res = await updateProfile(formData)

      if (res?.error) {
        setScoreStatus({ type: 'error', msg: res.error })
      } else if (res?.success) {
        setScoreStatus({ type: 'success', msg: 'SAT scores updated!' })
        triggerToast('📊 SAT scores saved!')
      }
    } catch (err) {
      setScoreStatus({ type: 'error', msg: 'Failed to save scores. Timeout.' })
    } finally {
      setLoadingScores(false)
    }
  }

  const validateFirstMockScores = () => {
    const rw = parseInt(firstMockRwScore, 10)
    const math = parseInt(firstMockMathScore, 10)
    
    if (firstMockRwScore !== '' && (rw < 200 || rw > 800 || rw % 10 !== 0)) {
      return 'Reading & Writing score must be between 200 and 800 in increments of 10 (e.g. 680, 720).'
    }
    if (firstMockMathScore !== '' && (math < 200 || math > 800 || math % 10 !== 0)) {
      return 'Math section score must be between 200 and 800 in increments of 10 (e.g. 750, 780).'
    }
    return ''
  }

  const handleFirstMockScoresSubmit = async (e) => {
    e.preventDefault()
    const err = validateFirstMockScores()
    if (err) {
      setFirstMockScoreError(err)
      triggerToast('⚠️ Invalid Mock Score Format!')
      return
    }
    setFirstMockScoreError('')
    setLoadingFirstMockScores(true)
    setFirstMockScoreStatus({ type: '', msg: '' })

    try {
      const formData = new FormData(e.target)
      const res = await updateProfile(formData)

      if (res?.error) {
        setFirstMockScoreStatus({ type: 'error', msg: res.error })
      } else if (res?.success) {
        setFirstMockScoreStatus({ type: 'success', msg: 'First mock scores updated!' })
        triggerToast('🎯 First mock scores saved!')
      }
    } catch (err) {
      setFirstMockScoreStatus({ type: 'error', msg: 'Failed to save mock scores. Timeout.' })
    } finally {
      setLoadingFirstMockScores(false)
    }
  }

  const handleTopicsSubmit = async (e) => {
    e.preventDefault()
    setLoadingTopics(true)
    setTopicStatus({ type: '', msg: '' })

    try {
      const formData = new FormData()
      selectedTopics.forEach(t => formData.append('weak_topics', t))
      const res = await updateProfile(formData)

      if (res?.error) {
        setTopicStatus({ type: 'error', msg: res.error })
      } else if (res?.success) {
        setTopicStatus({ type: 'success', msg: 'Weak topics updated!' })
        triggerToast('🔥 Weak topics saved!')
      }
    } catch (err) {
      setTopicStatus({ type: 'error', msg: 'Failed to save topics. Timeout.' })
    } finally {
      setLoadingTopics(false)
    }
  }

  const handlePassSubmit = async (e) => {
    e.preventDefault()
    setLoadingPass(true)
    setPassStatus({ type: '', msg: '' })

    const formData = new FormData(e.target)
    const pass = formData.get('password')
    const confirm = formData.get('confirm_password')

    if (pass !== confirm) {
      setPassStatus({ type: 'error', msg: 'Passwords do not match!' })
      setLoadingPass(false)
      return
    }

    const res = await updatePassword(formData)

    if (res?.error) {
      setPassStatus({ type: 'error', msg: res.error })
    } else if (res?.success) {
      setPassStatus({ type: 'success', msg: res.success })
      triggerToast('🔒 Password changed successfully!')
      e.target.reset()
    }
    setLoadingPass(false)
  }

  // EXECUTE PROGRESS WIPE UPON TYPING 'RESET'
  const handleResetExecuteSubmit = async (e) => {
    e.preventDefault()
    if (confirmKeyword.trim().toUpperCase() !== 'RESET') {
      setResetError("Please type 'RESET' exactly to confirm.")
      return
    }

    setLoadingReset(true)
    setResetError('')
    const res = await resetUserProgress()
    
    if (res?.error) {
      setResetError(res.error)
    } else {
      setShowConfirmModal(false)
      setConfirmKeyword('')
      triggerToast('🔄 Practice history wiped clean!')
    }
    setLoadingReset(false)
  }

  const mathSelectedCount = MATH_DOMAINS.reduce((acc, d) => acc + d.topics.filter(t => selectedTopics.includes(t.id)).length, 0)
  const englishSelectedCount = ENGLISH_DOMAINS.reduce((acc, d) => acc + d.topics.filter(t => selectedTopics.includes(t.id)).length, 0)

  return (
    <div className="max-w-7xl mx-auto space-y-10 py-6 pb-28 px-4 sm:px-6 relative">
      
      {/* Modern Type 'RESET' Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f150f] border border-red-500/40 p-8 rounded-3xl max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.25)] space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => { setShowConfirmModal(false); setResetError(''); setConfirmKeyword(''); }}
              className="absolute top-6 right-6 text-white/40 hover:text-white p-1 rounded-lg bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-6 h-6 text-red-500 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Reset Practice History</h3>
                <p className="text-xs text-white/50">Irreversible account data reset</p>
              </div>
            </div>

            <p className="text-xs text-white/80 leading-relaxed bg-white/5 p-4 rounded-2xl border border-white/5">
              ⚠️ This will permanently erase all completed quizzes, test logs, and historical scores. To confirm, please type <span className="text-red-400 font-mono font-black select-all">RESET</span> below.
            </p>

            {resetError && (
              <div className="p-3.5 rounded-xl text-xs bg-red-500/15 border border-red-500/40 text-red-200 flex items-center gap-2 font-bold animate-pulse">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                {resetError}
              </div>
            )}

            <form onSubmit={handleResetExecuteSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/80">Confirmation Word</label>
                <input 
                  type="text" 
                  autoFocus
                  required 
                  value={confirmKeyword}
                  onChange={(e) => { setConfirmKeyword(e.target.value); setResetError(''); }}
                  placeholder="RESET" 
                  className="w-full text-center text-xl tracking-[0.2em] font-black p-3.5 bg-black/50 border border-white/15 rounded-xl text-red-400 placeholder-white/10 focus:outline-none focus:border-red-500 transition-all font-mono uppercase" 
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => { setShowConfirmModal(false); setResetError(''); setConfirmKeyword(''); }}
                  className="flex-1 py-3.5 px-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loadingReset || confirmKeyword.trim().toUpperCase() !== 'RESET'}
                  className="flex-1 py-3.5 px-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.4)] transition active:scale-95 text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {loadingReset ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {loadingReset ? 'Erasing...' : 'Confirm Wipe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Alert */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-[#D0F288] text-black px-6 py-3.5 rounded-2xl font-black text-sm shadow-[0_0_40px_rgba(208,242,136,0.6)] animate-bounce flex items-center gap-2 border border-black/10">
          <Sparkles className="w-4 h-4 text-black shrink-0" /> {toast}
        </div>
      )}

      {/* TOP: Profile Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#101810] via-[#1a2618] to-[#0d140d] border border-white/10 p-8 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D0F288]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left z-10">
          {/* Avatar Placeholder */}
          <div className="relative group cursor-pointer" onClick={() => triggerToast('📸 Profile photo uploads unavailable for now')}>
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#D0F288] to-emerald-400 p-1 shadow-[0_0_30px_rgba(208,242,136,0.3)]">
              <div className="w-full h-full rounded-full bg-[#0a0f0a] flex items-center justify-center text-4xl font-black text-white">
                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'S'}
              </div>
            </div>
            <div className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-xs">
              <Camera className="w-6 h-6" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-[#D0F288] text-black p-1.5 rounded-full shadow">
              <Camera className="w-3.5 h-3.5" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <h1 className="text-3xl font-black text-white tracking-tight">{profile?.full_name || 'Student Profile'}</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 text-[10px] font-bold tracking-widest uppercase border border-white/10">SAT Prep</span>
            </div>
            <p className="text-white/60 text-xs font-mono">{email}</p>
            <p className="text-xs text-[#D0F288] mt-2 font-semibold flex items-center justify-center sm:justify-start gap-1.5">
              <Flame className="w-3.5 h-3.5" /> Keep practicing to reach your target score
            </p>
          </div>
        </div>

        {/* Current Plan Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl flex flex-col items-center md:items-end text-center md:text-right min-w-[240px] z-10">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
            <Crown className="w-4 h-4" /> Current Plan
          </div>
          <div className="text-xl font-black text-white mb-4">
            {({ 7: '⚡ Master Plan (Tester)', 6: '⚡ Master Plan', 5: '⚡ Flash Plan (Tester)', 4: '⚡ Flash Plan', 3: '⚡ Practice Plan (Tester)', 2: '⚡ Practice Plan', 1: '🛡️ Free Plan' })[profile?.user_level ?? 1] || '🛡️ Free Plan'}
          </div>
          {(profile?.user_level ?? 1) < 6 ? (
            <Link href="/upgrade" className="w-full py-2.5 px-5 bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-black font-extrabold text-xs rounded-xl shadow-[0_0_20px_rgba(251,191,36,0.3)] transition active:scale-95 text-center block">
              Upgrade Plan
            </Link>
          ) : (
            <div className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              ✨ {({ 7: 'Master Plan (Tester)', 6: 'Master Plan', 5: 'Flash Plan (Tester)', 4: 'Flash Plan', 3: 'Practice Plan (Tester)', 2: 'Practice Plan', 1: 'Free Plan' })[profile?.user_level ?? 1] || 'Free Plan'} Active
            </div>
          )}
        </div>
      </div>

      {/* MAIN 2-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* LEFT MAIN AREA (Col-span-2) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* SECTION 1: DECOUPLED FORM 1 - ACADEMIC & PERSONAL DETAILS */}
          <form onSubmit={handleBioSubmit} className="bg-[#0a0f0a]/90 border border-white/10 p-8 rounded-3xl shadow-xl space-y-6" suppressHydrationWarning>
            <h2 className="text-xl font-black text-white flex items-center gap-2 border-b border-white/10 pb-4">
              <GraduationCap className="w-6 h-6 text-[#D0F288]" /> Academic & Personal Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" suppressHydrationWarning>
              <div className="space-y-1.5" suppressHydrationWarning>
                <label className="text-xs font-semibold text-white/80">Full Name</label>
                <input name="full_name" type="text" required defaultValue={profile?.full_name || ''} placeholder="Sayed Md. Mohiuddin Sami" className="w-full p-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#D0F288] transition-all" suppressHydrationWarning />
              </div>

              <div className="space-y-1.5" suppressHydrationWarning>
                <label className="text-xs font-semibold text-white/80">School / College</label>
                <div className="relative" suppressHydrationWarning>
                  <School className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
                  <input name="institution" type="text" defaultValue={profile?.institution || ''} placeholder="Rajuk Uttara Model College" className="w-full pl-10 p-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#D0F288] transition-all" suppressHydrationWarning />
                </div>
              </div>

              <div className="space-y-1.5" suppressHydrationWarning>
                <label className="text-xs font-semibold text-white/80">WhatsApp Contact</label>
                <div className="relative" suppressHydrationWarning>
                  <Phone className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
                  <input name="whatsapp_number" type="text" defaultValue={profile?.whatsapp_number || ''} placeholder="+8801..." className="w-full pl-10 p-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#D0F288] transition-all" suppressHydrationWarning />
                </div>
              </div>

              <div className="space-y-1.5" suppressHydrationWarning>
                <label className="text-xs font-semibold text-white/80">Exam Target / Class</label>
                <input name="academic_year" type="text" defaultValue={profile?.academic_year || ''} placeholder="HSC 26 / Class 12" className="w-full p-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#D0F288] transition-all" suppressHydrationWarning />
              </div>
            </div>

            {bioStatus.msg && (
              <div className={`p-4 rounded-xl text-xs flex items-center gap-2.5 font-bold ${bioStatus.type === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-300' : 'bg-green-500/10 border border-green-500/30 text-green-300'}`}>
                {bioStatus.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                {bioStatus.msg}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loadingBio} 
              className="w-full py-4 bg-[#D0F288] hover:bg-[#bce668] text-[#050805] font-black rounded-2xl shadow-[0_0_30px_rgba(208,242,136,0.3)] transition active:scale-98 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              suppressHydrationWarning
            >
              <Save className="w-4 h-4" /> {loadingBio ? 'Saving Details...' : 'Save Personal Details'}
            </button>
          </form>

          {/* SECTION 2: DECOUPLED FORM 2 - LATEST SAT SCORE */}
          <div className="bg-[#0a0f0a]/90 border border-white/10 p-8 rounded-3xl shadow-xl relative overflow-hidden" suppressHydrationWarning>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-5 mb-6 gap-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2.5">
                  <Target className="w-6 h-6 text-[#D0F288]" /> Latest SAT Score Breakdown
                </h2>
                <p className="text-xs text-white/50 mt-1 flex items-center gap-1.5 font-medium">
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Updated automatically upon completing full-length Practice Tests or Module Quizzes. Manual edits are locked.
                </p>
              </div>
              <div className="text-left sm:text-right bg-white/5 px-5 py-2.5 rounded-2xl border border-white/10 shrink-0">
                <span className="text-[10px] uppercase font-bold tracking-widest text-white/40 block">Calculated Total</span>
                <span className="text-3xl font-black text-[#D0F288]">{totalScore > 0 ? totalScore : '---'}</span>
                <span className="text-xs text-white/40"> / 1600</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6" suppressHydrationWarning>
              {/* Reading & Writing Dial */}
              <div className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5 border border-blue-500/20 p-6 rounded-2xl relative opacity-80" suppressHydrationWarning>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" /> Reading & Writing
                  </span>
                  <span className="text-xs font-mono text-white/40 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-white/40" /> Locked
                  </span>
                </div>
                <input 
                  name="latest_sat_rw" 
                  type="number" 
                  disabled
                  readOnly
                  value={rwScore}
                  placeholder="e.g. 680"
                  className="w-full text-3xl font-black p-4 bg-black/60 border border-blue-500/20 rounded-xl text-white/60 placeholder-white/20 focus:outline-none font-mono cursor-not-allowed" 
                  suppressHydrationWarning
                />
              </div>

              {/* Math Dial */}
              <div className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 p-6 rounded-2xl relative opacity-80" suppressHydrationWarning>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4" /> Math Section
                  </span>
                  <span className="text-xs font-mono text-white/40 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-white/40" /> Locked
                  </span>
                </div>
                <input 
                  name="latest_sat_math" 
                  type="number" 
                  disabled
                  readOnly
                  value={mathScore}
                  placeholder="e.g. 750"
                  className="w-full text-3xl font-black p-4 bg-black/60 border border-emerald-500/20 rounded-xl text-white/60 placeholder-white/20 focus:outline-none font-mono cursor-not-allowed" 
                  suppressHydrationWarning
                />
              </div>
            </div>

            <Link 
              href="/dashboard/practice-tests"
              className="w-full py-3.5 bg-[#D0F288]/15 hover:bg-[#D0F288]/25 border border-[#D0F288]/40 hover:border-[#D0F288]/60 text-[#D0F288] font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 active:scale-98 group"
            >
              <Target className="w-4 h-4 shrink-0" /> 
              <span>Take a Practice Test</span>
              <ChevronRight className="w-4 h-4 text-[#D0F288]/60 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* SECTION 2B: DECOUPLED FORM 2B - FIRST MOCK SCORE */}
          <form onSubmit={handleFirstMockScoresSubmit} className="bg-[#0a0f0a]/90 border border-white/10 p-8 rounded-3xl shadow-xl relative overflow-hidden" suppressHydrationWarning>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-5 mb-6 gap-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2.5">
                  <Target className="w-6 h-6 text-amber-400" /> First Mock Score Breakdown
                </h2>
                <p className="text-xs text-white/50 mt-1">Record your starting baseline scores (200 to 800 per section in multiples of 10).</p>
              </div>
              <div className="text-left sm:text-right bg-white/5 px-5 py-2.5 rounded-2xl border border-white/10 shrink-0">
                <span className="text-[10px] uppercase font-bold tracking-widest text-white/40 block">Calculated Total</span>
                <span className="text-3xl font-black text-amber-400">{totalFirstMockScore > 0 ? totalFirstMockScore : '---'}</span>
                <span className="text-xs text-white/40"> / 1600</span>
              </div>
            </div>

            {firstMockScoreError && (
              <div className="mb-6 p-4 rounded-xl text-xs bg-red-500/15 border border-red-500/40 text-red-200 flex items-center gap-2.5 font-bold animate-pulse">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                {firstMockScoreError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              {/* Reading & Writing Dial */}
              <div className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5 border border-blue-500/20 p-6 rounded-2xl relative">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" /> Reading & Writing
                  </span>
                  <span className="text-xs font-mono text-white/40">200 - 800</span>
                </div>
                <input 
                  name="first_mock_sat_rw" 
                  type="number" 
                  min={200} 
                  max={800}
                  step={10}
                  value={firstMockRwScore}
                  onChange={(e) => { setFirstMockRwScore(e.target.value); setFirstMockScoreError(''); }}
                  placeholder="e.g. 580"
                  className="w-full text-3xl font-black p-4 bg-black/40 border border-blue-500/30 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-blue-400 font-mono transition" 
                />
              </div>

              {/* Math Dial */}
              <div className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 p-6 rounded-2xl relative">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4" /> Math Section
                  </span>
                  <span className="text-xs font-mono text-white/40">200 - 800</span>
                </div>
                <input 
                  name="first_mock_sat_math" 
                  type="number" 
                  min={200} 
                  max={800}
                  step={10}
                  value={firstMockMathScore}
                  onChange={(e) => { setFirstMockMathScore(e.target.value); setFirstMockScoreError(''); }}
                  placeholder="e.g. 620"
                  className="w-full text-3xl font-black p-4 bg-black/40 border border-emerald-500/30 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-emerald-400 font-mono transition" 
                />
              </div>
            </div>

            {firstMockScoreStatus.msg && (
              <div className={`p-4 rounded-xl text-xs flex items-center gap-2.5 font-bold mb-4 ${firstMockScoreStatus.type === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-300' : 'bg-green-500/10 border border-green-500/30 text-green-300'}`}>
                {firstMockScoreStatus.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                {firstMockScoreStatus.msg}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loadingFirstMockScores} 
              className="w-full py-3.5 bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 text-amber-300 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {loadingFirstMockScores ? 'Saving Mock Scores...' : 'Save First Mock Scores'}
            </button>
          </form>

          {/* SECTION 3: DECOUPLED FORM 3 - TWO SEPARATE WEAK TOPIC LISTS (MATH & ENGLISH) */}
          <form onSubmit={handleTopicsSubmit} className="bg-[#0a0f0a]/90 border border-white/10 p-8 rounded-3xl shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-5 gap-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2.5">
                  <Flame className="w-6 h-6 text-red-500" /> Weak Topics Target List
                </h2>
                <p className="text-xs text-white/50 mt-1">Select subtopics from official SAT domains where you need targeted practice.</p>
              </div>

              {/* Subject Tabs Toggler */}
              <div className="flex bg-black/50 p-1 rounded-2xl border border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTopicTab('math')}
                  className={`px-5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${activeTopicTab === 'math' ? 'bg-emerald-500 text-black shadow' : 'text-white/60 hover:text-white'}`}
                >
                  <Calculator className="w-3.5 h-3.5" /> Math ({mathSelectedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTopicTab('english')}
                  className={`px-5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${activeTopicTab === 'english' ? 'bg-blue-500 text-white shadow' : 'text-white/60 hover:text-white'}`}
                >
                  <BookOpen className="w-3.5 h-3.5" /> English ({englishSelectedCount})
                </button>
              </div>
            </div>

            {/* TAB 1: MATH TOPICS GROUPED BY OFFICIAL DOMAINS */}
            {activeTopicTab === 'math' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {MATH_DOMAINS.map((dom) => (
                  <div key={dom.domain} className="space-y-3">
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/10 w-fit">
                      <ChevronRight className="w-3.5 h-3.5" /> {dom.domain}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-2">
                      {dom.topics.map((t) => {
                        const isSelected = selectedTopics.includes(t.id)
                        return (
                          <div 
                            key={t.id}
                            onClick={() => toggleTopic(t.id)}
                            className={`p-3.5 rounded-xl border cursor-pointer select-none transition-all flex items-center justify-between gap-3 ${isSelected ? 'bg-red-500/15 border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.15)] text-white font-bold' : 'bg-white/5 border-white/5 hover:border-white/15 text-white/70 hover:text-white text-xs font-normal'}`}
                          >
                            <span className="text-xs leading-snug">{t.label}</span>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-red-500 border-red-500 text-white' : 'border-white/20'}`}>
                              {isSelected && <CheckCircle2 className="w-3 h-3" />}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 2: ENGLISH TOPICS GROUPED BY OFFICIAL DOMAINS */}
            {activeTopicTab === 'english' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {ENGLISH_DOMAINS.map((dom) => (
                  <div key={dom.domain} className="space-y-3">
                    <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 bg-blue-500/5 px-3 py-1.5 rounded-lg border border-blue-500/10 w-fit">
                      <ChevronRight className="w-3.5 h-3.5" /> {dom.domain}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-2">
                      {dom.topics.map((t) => {
                        const isSelected = selectedTopics.includes(t.id)
                        return (
                          <div 
                            key={t.id}
                            onClick={() => toggleTopic(t.id)}
                            className={`p-3.5 rounded-xl border cursor-pointer select-none transition-all flex items-center justify-between gap-3 ${isSelected ? 'bg-red-500/15 border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.15)] text-white font-bold' : 'bg-white/5 border-white/5 hover:border-white/15 text-white/70 hover:text-white text-xs font-normal'}`}
                          >
                            <span className="text-xs leading-snug">{t.label}</span>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-red-500 border-red-500 text-white' : 'border-white/20'}`}>
                              {isSelected && <CheckCircle2 className="w-3 h-3" />}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {topicStatus.msg && (
              <div className={`p-4 rounded-xl text-xs flex items-center gap-2.5 font-bold pt-2 ${topicStatus.type === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-300' : 'bg-green-500/10 border border-green-500/30 text-green-300'}`}>
                {topicStatus.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                {topicStatus.msg}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loadingTopics} 
              className="w-full py-4 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-200 font-extrabold rounded-2xl shadow transition active:scale-98 text-xs flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
            >
              <Save className="w-4 h-4" /> {loadingTopics ? 'Saving Selected Topics...' : `Save Selected Weak Topics (${selectedTopics.length} total)`}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN (Col-span-1): PASSWORD RESET & RESET SUBMISSIONS AT VERY TOP RIGHT */}
        <div className="lg:col-span-1 space-y-8 sticky top-6">
          
          {/* Password Reset Box */}
          <div className="bg-[#0a0f0a]/90 border border-white/10 p-8 rounded-3xl shadow-xl space-y-6">
            <h2 className="text-xl font-black text-amber-400 flex items-center gap-2 border-b border-white/10 pb-4">
              <Lock className="w-5 h-5 text-amber-400" /> Change Password
            </h2>

            {passStatus.msg && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 font-bold ${passStatus.type === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-300' : 'bg-green-500/10 border border-green-500/30 text-green-300'}`}>
                {passStatus.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                {passStatus.msg}
              </div>
            )}

            <form onSubmit={handlePassSubmit} className="space-y-4" suppressHydrationWarning>
              <div className="space-y-1.5" suppressHydrationWarning>
                <label className="text-xs font-semibold text-white/80">New Password</label>
                <input name="password" type="password" required minLength={6} placeholder="••••••••" className="w-full p-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 transition-all" suppressHydrationWarning />
              </div>

              <div className="space-y-1.5" suppressHydrationWarning>
                <label className="text-xs font-semibold text-white/80">Confirm Password</label>
                <input name="confirm_password" type="password" required minLength={6} placeholder="••••••••" className="w-full p-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 transition-all" suppressHydrationWarning />
              </div>

              <button type="submit" disabled={loadingPass} className="w-full mt-2 py-3.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold rounded-xl shadow transition active:scale-98 text-xs flex items-center justify-center gap-2 disabled:opacity-50" suppressHydrationWarning>
                <Lock className="w-3.5 h-3.5" /> {loadingPass ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>

          {/* Reset Submissions Box */}
          <div className="bg-red-950/20 border border-red-500/30 p-8 rounded-3xl shadow-xl relative overflow-hidden">
            <h3 className="text-base font-black text-red-400 flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4" /> Reset Practice History
            </h3>
            <p className="text-xs text-red-300/70 leading-relaxed">
              Clear all your completed quizzes, scores, and test logs to start practicing from scratch.
            </p>

            <button 
              type="button" 
              onClick={() => { setShowConfirmModal(true); setConfirmKeyword(''); setResetError(''); }}
              className="w-full mt-6 py-3.5 px-4 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.4)] transition active:scale-95 text-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Clear All Practice History
            </button>
          </div>

        </div>

      </div>
    </div>
  )
}
