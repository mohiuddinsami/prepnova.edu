'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Sparkles, UserPlus, LogIn, ChevronRight, BookOpen, Calculator, Filter, Play, Loader2, Check, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { getPracticeDashboardMetadataAction, fetchPracticeQuestionsAction } from '@/app/actions/practiceActions'
import PracticeEngine from './PracticeEngine'

const SAT_DOMAINS = {
  English: [
    { name: "Information and Ideas", topics: ["Central Ideas and Details", "Command of Evidence", "Inferences"] },
    { name: "Craft and Structure", topics: ["Words in Context", "Text Structure and Purpose", "Cross-Text Connections"] },
    { name: "Expression of Ideas", topics: ["Rhetorical Synthesis", "Transitions"] },
    { name: "Standard English Conventions", topics: ["Boundaries", "Form, Structure, and Sense"] }
  ],
  Math: [
    { name: "Algebra", topics: ["Linear equations", "Linear inequalities"] },
    { name: "Advanced Math", topics: ["Equivalent expressions", "Nonlinear functions and equations"] },
    { name: "Problem-Solving and Data Analysis", topics: ["Ratios, percentage, rates, proportional relationships, and units", "One-variable & Two-variable data: Models and scatterplots, Distributions and measures of center and spread", "Probability and conditional probability", "Statistics"] },
    { name: "Geometry and Trigonometry", topics: ["Area and volume", "Lines, angles, and triangles", "Right triangles and trigonometry", "Circles"] }
  ]
}

export default function PracticeClient({ userLevel = 1 }) {
  const [subject, setSubject] = useState('English') // Default to English
  const [loadingMetadata, setLoadingMetadata] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  // Data from backend
  const [questionsMeta, setQuestionsMeta] = useState([])
  const [userAttempts, setUserAttempts] = useState({})

  // Filters
  const [difficultyFilter, setDifficultyFilter] = useState('ALL') // ALL, EASY, MEDIUM, HARD, CUSTOM
  const [customDiffRange, setCustomDiffRange] = useState([200, 800])
  const [sourceFilter, setSourceFilter] = useState('ALL') // ALL, Digital SAT, Official, etc.
  const [statusFilter, setStatusFilter] = useState('ALL') // ALL, SOLVED, TRIED, UNTOUCHED
  
  // New States
  const [questionCountType, setQuestionCountType] = useState('10')
  const [customQuestionCount, setCustomQuestionCount] = useState(10)
  
  const [quotaModalOpen, setQuotaModalOpen] = useState(false)
  const [quotaModalMessage, setQuotaModalMessage] = useState('')

  // Selection
  const [selectedTopics, setSelectedTopics] = useState({})

  // Engine State
  const [launching, setLaunching] = useState(false)

  // Derived state: Extract unique sources for the filter dropdown
  const uniqueSources = useMemo(() => {
    const sources = new Set(questionsMeta.map(q => q.question_source).filter(Boolean))
    return Array.from(sources)
  }, [questionsMeta])

  // Helper to determine question status based on difficultyEngine state
  const getQuestionStatus = (qid) => {
    const attempt = userAttempts[qid]
    if (!attempt) return 'UNTOUCHED'
    const [state] = Array.isArray(attempt) ? attempt : [0]
    if (state > 0) return 'SOLVED'
    if (state < 0) return 'TRIED'
    return 'UNTOUCHED'
  }

  // Filter the questions based on current selected filters (but NOT by topic yet)
  const filterQuestion = (q) => {
    // 1. Difficulty
    let diffMatch = true
    const d = q.difficulty
    if (difficultyFilter === 'EASY') diffMatch = (d >= 200 && d <= 420)
    else if (difficultyFilter === 'MEDIUM') diffMatch = (d >= 430 && d <= 620)
    else if (difficultyFilter === 'HARD') diffMatch = (d >= 630 && d <= 800)
    else if (difficultyFilter === 'CUSTOM') diffMatch = (d >= customDiffRange[0] && d <= customDiffRange[1])
    if (!diffMatch) return false

    // 2. Source
    if (sourceFilter !== 'ALL' && q.question_source !== sourceFilter) return false

    // 3. Status
    if (statusFilter !== 'ALL') {
      const status = getQuestionStatus(q.qid)
      if (status !== statusFilter) return false
    }

    return true
  }

  // Derived state: Group the FILTERED questions by topic tag
  const topicsData = useMemo(() => {
    const groups = {}
    questionsMeta.forEach(q => {
      if (!q.topic_tag) return
      if (!groups[q.topic_tag]) groups[q.topic_tag] = { name: q.topic_tag, totalCount: 0, filteredCount: 0, qids: [] }

      groups[q.topic_tag].totalCount++
      if (filterQuestion(q)) {
        groups[q.topic_tag].filteredCount++
        groups[q.topic_tag].qids.push(q.qid)
      }
    })
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name))
  }, [questionsMeta, difficultyFilter, customDiffRange, sourceFilter, statusFilter, userAttempts])

  // Derived state: Group the topics into SAT Domains
  const groupedTopics = useMemo(() => {
    if (!subject) return []
    const domains = SAT_DOMAINS[subject] || []

    const result = domains.map(d => ({
      name: d.name,
      items: d.topics.map(tName => ({
        name: tName,
        totalCount: 0,
        filteredCount: 0,
        qids: []
      }))
    }))

    const otherDomain = { name: "Other Topics", items: [] }

    topicsData.forEach(topic => {
      let placed = false
      for (let d of result) {
        const itemIndex = d.items.findIndex(t => t.name.toLowerCase() === topic.name.toLowerCase())
        if (itemIndex !== -1) {
          d.items[itemIndex] = topic
          placed = true
          break
        }
      }
      if (!placed) {
        otherDomain.items.push(topic)
      }
    })

    if (otherDomain.items.length > 0) result.push(otherDomain)
    return result // ALWAYS return all domains, even if empty
  }, [topicsData, subject])

  useEffect(() => {
    if (subject) {
      setLoadingMetadata(true)
      getPracticeDashboardMetadataAction(subject).then(res => {
        if (res.success) {
          setQuestionsMeta(res.questions)
          setUserAttempts(res.userAttempts)
          // Reset selection when subject changes
          setSelectedTopics({})
          setErrorMsg(null)
        } else {
          setErrorMsg(res.error)
        }
        setLoadingMetadata(false)
      })
    }
  }, [subject])

  const toggleTopic = (topicName) => {
    setSelectedTopics(prev => ({
      ...prev,
      [topicName]: !prev[topicName]
    }))
  }

  const handleLaunch = async () => {
    // Collect all qids from selected topics
    let pool = []
    topicsData.forEach(t => {
      if (selectedTopics[t.name]) {
        pool.push(...t.qids)
      }
    })

    if (pool.length === 0) return alert('No questions match your filters in the selected topics!')

    // Randomize the pool
    pool = pool.sort(() => Math.random() - 0.5)

    let finalCount = pool.length
    if (questionCountType !== 'ALL') {
      finalCount = questionCountType === 'CUSTOM' ? customQuestionCount : parseInt(questionCountType, 10)
    }
    const selectedQids = pool.slice(0, finalCount)

    // Time limit is automatically 1 min per question
    const finalTimeLimit = selectedQids.length

    setLaunching(true)
    const res = await fetchPracticeQuestionsAction(selectedQids)
    if (res.success) {
      const sessionId = Math.random().toString(36).substring(2, 10)
      localStorage.setItem(`prepnova_practice_${sessionId}`, JSON.stringify({
        subject,
        questions: res.questions,
        timeLimit: finalTimeLimit
      }))
      window.location.href = `/practice/${sessionId}`
    } else {
      setQuotaModalMessage(res.error || 'Error launching practice session.')
      setQuotaModalOpen(true)
    }
    setLaunching(false)
  }

  if (userLevel === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
        <div className="w-20 h-20 bg-[#D0F288]/10 rounded-full border border-[#D0F288]/30 flex items-center justify-center mb-6 shadow-inner text-[#D0F288]">
          <Sparkles className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight mb-4">Unlimited Practice Engine</h1>
        <p className="text-gray-400 max-w-md text-sm leading-relaxed mb-8">
          Register a free account to generate customized practice quizzes, track your progress, and master every SAT topic.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs">
          <Link href="/signup" className="flex-1 py-3.5 rounded-xl font-black text-sm bg-[#D0F288] text-[#050805] hover:brightness-110 shadow-lg shadow-[#D0F288]/20 transition flex items-center justify-center gap-2">
            <UserPlus className="w-4 h-4" /> Sign Up Free
          </Link>
          <Link href="/login" className="flex-1 py-3.5 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/15 text-white border border-white/10 transition flex items-center justify-center gap-2">
            <LogIn className="w-4 h-4" /> Log In
          </Link>
        </div>
      </div>
    )
  }



  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 py-6 border-b border-white/10 bg-[#0a0f0a] flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Practice Engine</h1>
          <p className="text-gray-400 text-sm mt-1">Generate targeted practice sessions from thousands of questions.</p>
        </div>
        <div className="flex flex-col items-end gap-4">
          <div className="flex bg-white/10 rounded-lg p-1 shrink-0">
            <button
              onClick={() => setSubject('English')}
              className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${subject === 'English' ? 'bg-[#D0F288] text-[#050805]' : 'text-gray-400 hover:text-white'}`}
            >
              <BookOpen className="w-4 h-4" /> Reading & Writing
            </button>
            <button
              onClick={() => setSubject('Math')}
              className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${subject === 'Math' ? 'bg-[#D0F288] text-[#050805]' : 'text-gray-400 hover:text-white'}`}
            >
              <Calculator className="w-4 h-4" /> Math
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Filters */}
        <div className="w-full border-b border-white/10 bg-[#0a0f0a] p-4 flex flex-wrap items-end gap-6 shrink-0">

          {errorMsg && (
            <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <h3 className="text-red-500 font-bold mb-1">Error Fetching Practice Data</h3>
              <p className="text-red-400 text-sm font-mono whitespace-pre-wrap">{errorMsg}</p>
            </div>
          )}

          {/* Difficulty Filter */}
          <div className="w-56">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-2">
              <Filter className="w-3 h-3" /> Difficulty
            </label>
            <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-[#D0F288]/50">
              <option value="ALL" className="bg-[#0a0f0a]">All</option>
              <option value="EASY" className="bg-[#0a0f0a]">Easy (200-380)</option>
              <option value="MEDIUM" className="bg-[#0a0f0a]">Medium (390-520)</option>
              <option value="HARD" className="bg-[#0a0f0a]">Hard (530-800)</option>
              <option value="CUSTOM" className="bg-[#0a0f0a]">Custom Range</option>
            </select>
          </div>

          {difficultyFilter === 'CUSTOM' && (
            <div className="flex items-center gap-2">
              <input type="number" min="200" max="800" step="10" value={customDiffRange[0]} onChange={e => setCustomDiffRange([parseInt(e.target.value) || 200, customDiffRange[1]])} className="w-20 bg-white/5 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-[#D0F288]/50" />
              <span className="text-gray-500">-</span>
              <input type="number" min="200" max="800" step="10" value={customDiffRange[1]} onChange={e => setCustomDiffRange([customDiffRange[0], parseInt(e.target.value) || 800])} className="w-20 bg-white/5 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-[#D0F288]/50" />
            </div>
          )}

          {/* Status Filter */}
          <div className="w-48">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-2">
              <Filter className="w-3 h-3" /> Status
            </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-[#D0F288]/50">
              <option value="ALL" className="bg-[#0a0f0a]">All</option>
              <option value="UNTOUCHED" className="bg-[#0a0f0a]">Unattempted</option>
              <option value="TRIED" className="bg-[#0a0f0a]">Tried (Incorrect)</option>
              <option value="SOLVED" className="bg-[#0a0f0a]">Solved</option>
            </select>
          </div>

          {/* Source Filter */}
          <div className="w-48">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-2">
              <Filter className="w-3 h-3" /> Source
            </label>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-[#D0F288]/50">
              <option value="ALL" className="bg-[#0a0f0a]">All</option>
              {uniqueSources.map(s => (
                <option key={s} value={s} className="bg-[#0a0f0a]">{s}</option>
              ))}
            </select>
          </div>

          <div className="ml-auto flex items-center gap-5 border-l border-white/10 pl-6">
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Questions Count</label>
              <div className="flex items-center gap-2">
                <select value={questionCountType} onChange={e => setQuestionCountType(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg p-1.5 text-white text-xs focus:outline-none focus:border-[#D0F288]/50">
                  <option value="10" className="bg-[#0a0f0a]">10 Questions</option>
                  <option value="20" className="bg-[#0a0f0a]">20 Questions</option>
                  <option value="50" className="bg-[#0a0f0a]">50 Questions</option>
                  <option value="ALL" className="bg-[#0a0f0a]">All</option>
                  <option value="CUSTOM" className="bg-[#0a0f0a]">Custom</option>
                </select>
                {questionCountType === 'CUSTOM' && (
                  <input type="number" min="1" value={customQuestionCount} onChange={e => setCustomQuestionCount(parseInt(e.target.value) || 1)} className="w-14 bg-white/5 border border-white/10 rounded-lg p-1.5 text-white text-xs focus:outline-none focus:border-[#D0F288]/50" />
                )}
              </div>
            </div>

            <div className="w-px h-10 bg-white/10 mx-2"></div>

            <div className="text-gray-400 text-sm whitespace-nowrap">
              {topicsData.filter(t => selectedTopics[t.name]).reduce((acc, curr) => acc + curr.filteredCount, 0)} matches
            </div>
            <button
              onClick={handleLaunch}
              disabled={launching || Object.values(selectedTopics).filter(Boolean).length === 0}
              className="px-8 py-2.5 bg-[#D0F288] text-[#050805] font-black rounded-xl hover:brightness-110 disabled:opacity-50 transition flex items-center gap-2 whitespace-nowrap"
            >
              {launching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
              Start
            </button>
          </div>
        </div>

        {/* Main Content (Topics Grid) */}
        <div className="flex-1 flex flex-col bg-[#050805]">
          {loadingMetadata ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#D0F288] animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex-1 p-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">Select Topic for Randomized Practice</h2>
                  <div className="text-sm text-gray-400">
                    {Object.values(selectedTopics).filter(Boolean).length} selected
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {groupedTopics.map(domain => (
                    <div key={domain.name} className="bg-[#0a0f0a] border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-sm">
                      {/* Domain Header */}
                      <div className="bg-white/5 px-6 py-4 flex items-center gap-3 border-b border-white/10">
                        <Sparkles className="w-5 h-5 text-gray-400" />
                        <h3 className="font-bold text-white text-lg">{domain.name}</h3>
                      </div>

                      {/* Topics List */}
                      <div className="flex flex-col">
                        {domain.items.map((topic, index) => {
                          const isSelected = !!selectedTopics[topic.name]
                          const isDisabled = topic.filteredCount === 0
                          return (
                            <div key={topic.name} className={`px-6 py-5 flex items-center justify-between transition-colors ${index !== domain.items.length - 1 ? 'border-b border-white/5' : ''} ${isSelected ? 'bg-[#D0F288]/5' : isDisabled ? 'bg-black/20' : 'hover:bg-white/5'}`}>

                              <div className="flex-1">
                                <h4 className={`font-bold text-base mb-1 ${isDisabled ? 'text-gray-500' : 'text-white'}`}>{topic.name}</h4>
                                <div className={`flex items-center gap-2 text-sm ${isDisabled ? 'text-gray-600' : 'text-gray-400'}`}>
                                  <span className={`font-bold ${isDisabled ? 'text-gray-600' : 'text-[#D0F288]'}`}>{topic.filteredCount}</span>
                                  <span>/ {topic.totalCount} questions</span>
                                </div>

                                {/* Status Dot */}
                                {!isDisabled && (
                                  <div className="flex items-center gap-2 text-xs font-medium mt-3">
                                    <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-[#D0F288] shadow-[0_0_8px_rgba(208,242,136,0.6)]' : 'bg-gray-500'}`} />
                                    <span className={isSelected ? 'text-[#D0F288]' : 'text-gray-500'}>
                                      {isSelected ? 'Selected for practice' : 'Not selected'}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Action (Checkbox) */}
                              <div className="pl-6 shrink-0 flex items-center">
                                <button
                                  onClick={() => !isDisabled && toggleTopic(topic.name)}
                                  disabled={isDisabled}
                                  className={`relative w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${isDisabled ? 'border-white/5 bg-transparent opacity-50 cursor-not-allowed' :
                                      isSelected ? 'bg-[#D0F288] border-[#D0F288] text-[#050805] shadow-[0_0_15px_rgba(208,242,136,0.3)]' : 'border-gray-600 text-transparent hover:border-gray-400 bg-white/5'
                                    }`}
                                >
                                  <Check className={`w-6 h-6 ${isSelected ? 'stroke-[3] opacity-100' : 'opacity-0'}`} />
                                </button>
                              </div>

                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {quotaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-[#1a1a1a] p-8 rounded-2xl shadow-2xl max-w-md w-full border border-red-500/20 text-center animate-in zoom-in">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2">Limit Reached</h3>
            <p className="text-gray-400 mb-8">{quotaModalMessage}</p>
            <div className="flex gap-4">
              <button onClick={() => setQuotaModalOpen(false)} className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold transition">
                Close
              </button>
              <Link href="/upgrade" className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition">
                Upgrade Now
              </Link>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
