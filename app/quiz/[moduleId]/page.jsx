'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import RichText, { stripOptionLetter } from '@/components/RichText'
import { submitQuizAction, getSecureQuizDataAction } from '@/app/actions/quizActions'
import DesmosCalculator from '@/components/DesmosCalculator'
import ReportBugModal from '@/components/ReportBugModal'
import { Bookmark, ChevronUp, ChevronDown, X, Clock, EyeOff, Ban, Calculator, Bug, Flag } from 'lucide-react'

const renderAnswerPreview = (val) => {
  if (!val) return null;
  if (val.includes('/')) {
    const [num, den] = val.split('/');
    let isNegative = false;
    let numerator = num;
    if (num.startsWith('-')) {
      isNegative = true;
      numerator = num.substring(1);
    }
    return (
      <span className="inline-flex items-center ml-2 font-serif text-[22px] text-black align-middle">
        {isNegative && <span className="mr-1.5">-</span>}
        <span className="inline-flex flex-col items-center justify-center leading-none" style={{ marginTop: '2px' }}>
          <span className="border-b border-black px-1 pb-[2px]">{numerator}</span>
          <span className="px-1 pt-[2px]">{den}</span>
        </span>
      </span>
    );
  }
  return <span className="ml-2 font-serif font-normal text-black text-[22px]">{val}</span>;
}

export default function QuizPage({ params }) {
  const { moduleId } = use(params)
  const router = useRouter()

  // --- STATE DECLARATIONS ---
  const [moduleData, setModuleData] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)

  const [answers, setAnswers] = useState({})
  const [markedForReview, setMarkedForReview] = useState({})
  const [eliminatedOptions, setEliminatedOptions] = useState({})

  const [timeRemaining, setTimeRemaining] = useState(null)
  const [isTimerVisible, setIsTimerVisible] = useState(true)

  const [showQuestionMenu, setShowQuestionMenu] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)
  const [showTimeUpModal, setShowTimeUpModal] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)
  const [reportingQid, setReportingQid] = useState(null)

  const [highlightCoords, setHighlightCoords] = useState(null)
  const [selectionRange, setSelectionRange] = useState(null)
  const [highlights, setHighlights] = useState({})

  const [leftWidth, setLeftWidth] = useState(50)
  const [isDragging, setIsDragging] = useState(false)

  // Security & Loading States
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [showEliminators, setShowEliminators] = useState(false)

  // --- REACT HOOKS (Must remain at the top) ---

  // 1. Fetch Secure Data
  useEffect(() => {
    const fetchQuiz = async () => {
      const response = await getSecureQuizDataAction(moduleId)

      if (response.error) {
        setAuthError(response.error)
        setLoading(false)
        return
      }

      if (response.moduleData) {
        setModuleData(response.moduleData)
        setTimeRemaining(response.moduleData.time_limit_minutes * 60)
        setQuestions(response.questions || [])
      }
      setLoading(false)
    }
    fetchQuiz()
  }, [moduleId])

  // 2. Timer Logic
  useEffect(() => {
    if (timeRemaining !== null && timeRemaining > 0 && !showTimeUpModal && !showExitModal && !reportingQid) {
      const interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (showTimeUpModal || showExitModal || reportingQid) return prev
          if (prev <= 1) {
            clearInterval(interval)
            setShowTimeUpModal(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [timeRemaining, showTimeUpModal, showExitModal, reportingQid])

  // 3. Divider Drag Logic
  useEffect(() => {
    const onDrag = (e) => {
      if (!isDragging) return
      const newLeftWidth = (e.clientX / window.innerWidth) * 100
      if (newLeftWidth > 33 && newLeftWidth < 66) {
        setLeftWidth(newLeftWidth)
      }
    }
    const stopDrag = () => {
      setIsDragging(false)
      document.body.classList.remove('select-none')
    }

    if (isDragging) {
      document.body.classList.add('select-none')
      window.addEventListener('mousemove', onDrag)
      window.addEventListener('mouseup', stopDrag)
    }
    return () => {
      window.removeEventListener('mousemove', onDrag)
      window.removeEventListener('mouseup', stopDrag)
      document.body.classList.remove('select-none')
    }
  }, [isDragging])

  // 4. Custom Highlight API
  useEffect(() => {
    if (!questions.length || !window.CSS || !CSS.highlights) return;

    // Inject highlight CSS at runtime (PostCSS can't parse ::highlight)
    if (!document.getElementById('highlight-styles')) {
      const style = document.createElement('style');
      style.id = 'highlight-styles';
      style.textContent = `
        ::highlight(highlight-yellow) { background-color: rgba(250, 204, 21, 0.4); }
        ::highlight(highlight-pink) { background-color: rgba(244, 114, 182, 0.4); }
        ::highlight(highlight-green) { background-color: rgba(74, 222, 128, 0.4); }
      `;
      document.head.appendChild(style);
    }

    const qid = questions[currentIndex]?.qid;
    if (!qid) return;
    const currentHighlights = highlights[qid] || [];

    CSS.highlights.clear();
    if (currentHighlights.length === 0) return;

    const timer = setTimeout(() => {
      const containers = document.querySelectorAll('.highlightable-area');
      if (!containers.length) return;

      const colorGroups = {};
      currentHighlights.forEach(h => {
        if (!colorGroups[h.color]) colorGroups[h.color] = [];
        colorGroups[h.color].push(h);
      });

      Object.entries(colorGroups).forEach(([color, hList]) => {
        const ranges = [];

        hList.forEach(h => {
          const containerIdx = h.containerIndex || 0;
          const container = containers[containerIdx];
          if (!container) return;

          const range = new Range();
          const treeWalker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);

          let currentOffset = 0;
          let startNodeSet = false;

          while (treeWalker.nextNode()) {
            const node = treeWalker.currentNode;
            const nodeLen = node.nodeValue.length;

            if (!startNodeSet && currentOffset + nodeLen >= h.startOffset) {
              range.setStart(node, Math.max(0, h.startOffset - currentOffset));
              startNodeSet = true;
            }

            if (startNodeSet && currentOffset + nodeLen >= h.endOffset) {
              range.setEnd(node, Math.min(nodeLen, h.endOffset - currentOffset));
              ranges.push(range);
              break;
            }
            currentOffset += nodeLen;
          }
        });

        if (ranges.length > 0) {
          const highlight = new Highlight(...ranges);
          CSS.highlights.set(`highlight-${color}`, highlight);
        }
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [highlights, currentIndex, questions, leftWidth]);

  // 5. Escape Key Handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (showExitModal) setShowExitModal(false)
        if (showQuestionMenu) setShowQuestionMenu(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [showExitModal, showQuestionMenu])

  // --- HELPER FUNCTIONS ---

  const formatTime = (seconds) => {
    if (seconds === null) return "00:00"
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleAnswer = (val) => {
    setAnswers(prev => ({ ...prev, [questions[currentIndex].qid]: val }))
  }

  const toggleMarkForReview = () => {
    const qid = questions[currentIndex].qid
    setMarkedForReview(prev => ({ ...prev, [qid]: !prev[qid] }))
  }

  const toggleEliminateOption = (e, letter) => {
    e.stopPropagation()
    const qid = questions[currentIndex].qid
    
    setEliminatedOptions(prev => {
      const willBeEliminated = !(prev[qid]?.[letter])
      
      if (willBeEliminated) {
        setAnswers(prevAns => {
          if (prevAns[qid] === letter) return { ...prevAns, [qid]: '' }
          return prevAns
        })
      }
      
      return {
        ...prev,
        [qid]: {
          ...(prev[qid] || {}),
          [letter]: willBeEliminated
        }
      }
    })
  }

  const handleMouseUp = () => {
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      let node = selection.anchorNode
      let container = null
      while (node) {
        if (node.classList && node.classList.contains('highlightable-area')) {
          container = node
          break
        }
        node = node.parentNode
      }

      if (!container) {
        setHighlightCoords(null)
        setSelectionRange(null)
        return
      }

      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setHighlightCoords({ top: rect.top - 50, left: rect.left + rect.width / 2 })
      setSelectionRange(range)
    } else {
      setHighlightCoords(null)
      setSelectionRange(null)
    }
  }

  const applyHighlight = (colorName) => {
    if (!selectionRange) return

    let container = selectionRange.commonAncestorContainer;
    while (container && (!container.classList || !container.classList.contains('highlightable-area'))) {
      container = container.parentNode;
    }

    if (!container) {
      setHighlightCoords(null);
      setSelectionRange(null);
      return;
    }

    // Determine which container index this is (0 = context, 1 = question)
    const allContainers = document.querySelectorAll('.highlightable-area');
    let containerIndex = 0;
    allContainers.forEach((c, i) => {
      if (c === container) containerIndex = i;
    });

    const getAbsoluteOffset = (node, offset) => {
      const treeWalker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
      let absoluteOffset = 0;
      while (treeWalker.nextNode()) {
        const currentNode = treeWalker.currentNode;
        if (currentNode === node) {
          return absoluteOffset + offset;
        }
        absoluteOffset += currentNode.nodeValue.length;
      }
      return absoluteOffset;
    };

    const startOffset = getAbsoluteOffset(selectionRange.startContainer, selectionRange.startOffset);
    const endOffset = getAbsoluteOffset(selectionRange.endContainer, selectionRange.endOffset);

    const actualStart = Math.min(startOffset, endOffset);
    const actualEnd = Math.max(startOffset, endOffset);

    const qid = questions[currentIndex].qid;
    setHighlights(prev => ({
      ...prev,
      [qid]: [...(prev[qid] || []), { startOffset: actualStart, endOffset: actualEnd, color: colorName, containerIndex }]
    }));

    setHighlightCoords(null);
    setSelectionRange(null);
    window.getSelection().removeAllRanges();
  }

  const parseSprValue = (inputStr) => {
    if (!inputStr) return null;
    const cleanStr = String(inputStr).trim();
    if (cleanStr.includes('/')) {
      const [num, den] = cleanStr.split('/');
      return parseFloat(num) / parseFloat(den);
    }
    return parseFloat(cleanStr);
  };

  const gradeSpr = (studentInput, dbAnswerString) => {
    if (String(studentInput).trim() === String(dbAnswerString).trim()) return true;

    const studentValue = parseSprValue(studentInput);
    const correctValue = parseSprValue(dbAnswerString);

    if (isNaN(studentValue) || isNaN(correctValue)) return false;

    if (correctValue >= 0) {
      return Math.abs(studentValue - correctValue) < 0.001;
    } else {
      return Math.abs(studentValue - correctValue) < 0.01;
    }
  };

  const checkMultipleSprs = (studentInput, dbAnswerString) => {
    if (!dbAnswerString) return false;
    const possibleAnswers = String(dbAnswerString).split('||');
    return possibleAnswers.some(ans => gradeSpr(studentInput, ans));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)

    let correctCount = 0
    questions.forEach(q => {
      const studentAns = answers[q.qid];
      if (!studentAns) return;

      const qType = q.question_type ? q.question_type.toUpperCase() : 'MCQ';
      if (qType === 'SPR') {
        if (checkMultipleSprs(studentAns, q.correct_answer)) correctCount++;
      } else {
        if (studentAns === q.correct_answer) correctCount++;
      }
    })

    const scoreEstimate = Math.round((correctCount / questions.length) * 800)

    const submissionData = {
      module_id: moduleId,
      total_questions: questions.length,
      correct_count: correctCount,
      score_estimate: scoreEstimate,
      student_answers: answers
    }

    const result = await submitQuizAction(submissionData)

    if (result.error) {
      setIsSubmitting(false)
      if (result.error.isRateLimit) {
        alert(result.error.message)
      } else {
        alert(`Error submitting quiz: ${result.error.message || JSON.stringify(result.error)}`)
      }
      return
    }

    router.push('/dashboard/history')
  }

  // --- SECURITY GATES & CONDITIONAL RENDERS ---

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-gray-50 text-xl font-bold tracking-tight text-gray-400">Loading secure environment...</div>
  }

  if (authError === 'LOGIN_REQUIRED') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 flex-col px-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200 text-center max-w-md">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">Please log in to your account to access this module and save your progress securely.</p>
          <button onClick={() => router.push('/login')} className="w-full py-4 bg-[#162444] text-white rounded-xl font-bold hover:opacity-90 transition shadow-lg">
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  if (authError === 'PREMIUM_REQUIRED') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 flex-col px-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200 text-center max-w-md">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bookmark className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-4">Premium Access Only</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">Upgrade to Premium to unlock this module and access our complete SAT question bank.</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => router.push('/dashboard')} className="w-full py-4 bg-[#162444] text-white rounded-xl font-bold hover:opacity-90 transition shadow-lg">
              Upgrade Now
            </button>
            <button onClick={() => router.push('/dashboard')} className="w-full py-3 text-gray-500 font-bold hover:text-gray-700 transition">
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (authError === 'MODULE_NOT_FOUND' || !questions.length) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 flex-col px-4">
        <div className="text-xl font-bold text-gray-400">Module not found or empty.</div>
        <button onClick={() => router.push('/dashboard')} className="mt-4 text-blue-600 font-bold underline">Return Home</button>
      </div>
    )
  }

  // Prevent user from taking/submitting module if ANY question is corrupted/missing
  if (moduleData?.question_ids && questions.length !== moduleData.question_ids.length) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 flex-col px-4">
        <div className="bg-white p-10 rounded-3xl shadow-2xl border border-red-100 text-center max-w-md w-full relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-2 bg-red-600"></div>
          <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-red-100">
            <Ban className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-red-600 mb-3 tracking-tight">[Error 121]</h2>
          <div className="text-gray-900 font-bold text-lg mb-2">Question not found</div>
          <p className="text-gray-500 mb-8 leading-relaxed font-medium">Please contact admins to resolve the issue.</p>
          <button onClick={() => router.push('/dashboard')} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg hover:shadow-xl active:scale-[0.98]">
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // --- FINAL UI RENDER ---

  const currentQ = questions[currentIndex]
  
  if (!currentQ) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 flex-col px-4 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Ban className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Question Corrupted</h2>
        <div className="text-lg font-bold text-gray-500 mb-8">Question not found pls contact admins error 121</div>
        <button onClick={() => router.push('/dashboard')} className="px-8 py-3 bg-[#162444] text-white rounded-xl font-bold hover:opacity-90 transition shadow-lg">
          Return to Dashboard
        </button>
      </div>
    )
  }

  const isMath = currentQ?.subject_tag === 'Math'
  const isSPR = !currentQ.question_type || currentQ.question_type.toUpperCase() !== 'MCQ'
  const isMathSPR = isMath && isSPR
  const hasLeftSide = (!isMath && !!(currentQ.context || currentQ.image_url)) || isMathSPR || (isMath && showCalculator)

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-900 overflow-hidden font-serif">

      <header className="flex items-center justify-between px-6 sm:px-8 py-3 border-b border-black bg-[#1a1a1a] text-white z-10 select-none font-serif">
        <div className="flex-1 font-bold text-base sm:text-lg text-white tracking-wide">
          {moduleData?.module_name || 'Practice Quiz'}
        </div>
        <div className="flex-1 flex justify-center items-center">
          <div className="flex items-center gap-3.5">
            {isTimerVisible ? (
              <div className={`font-serif font-bold text-lg sm:text-xl tracking-[0.2em] ${timeRemaining < 300 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                {formatTime(timeRemaining).replace(':', ' : ')}
              </div>
            ) : (
              <div className="font-serif text-sm font-bold tracking-wider text-gray-400 flex items-center gap-2">Hidden</div>
            )}
            <button onClick={() => setIsTimerVisible(!isTimerVisible)} className="p-1 rounded hover:bg-white/10 transition text-gray-400 hover:text-white" title={isTimerVisible ? "Hide Timer" : "Show Timer"}>
              {isTimerVisible ? <EyeOff className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="flex-1 flex justify-end items-center gap-3 font-sans">
          {isMath && (
            <button
              type="button"
              onClick={() => setShowCalculator(!showCalculator)}
              className={`flex items-center gap-2 px-4 py-1.5 sm:px-5 sm:py-2 rounded-[4px] font-bold text-xs sm:text-sm tracking-wide transition shadow-sm border ${
                showCalculator
                  ? 'bg-blue-600 hover:bg-blue-500 border-blue-500 text-white'
                  : 'bg-[#333333] hover:bg-[#444444] border-gray-600/60 text-white'
              }`}
              title="Toggle College Board Graphing Calculator"
            >
              <Calculator className="w-4 h-4" />
              <span>Calculator</span>
            </button>
          )}
          <button
            onClick={() => setShowExitModal(true)}
            className="px-4 py-1.5 sm:px-5 sm:py-2 bg-[#d32f2f] hover:bg-[#b71c1c] border border-[#b71c1c]/60 rounded-[4px] font-bold text-white transition text-xs sm:text-sm tracking-wide shadow-sm"
          >
            Finish & Exit
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden bg-white relative">
        <DesmosCalculator
          isOpen={showCalculator && isMath && !showExitModal}
          onClose={() => setShowCalculator(false)}
        />
        {hasLeftSide && !showCalculator && (
          <div className="h-full overflow-y-auto bg-white p-10 shrink-0 border-r border-gray-200" style={{ width: `${leftWidth}%` }} onMouseUp={handleMouseUp}>
            {isMathSPR ? (
              <div className="font-sans text-sm text-gray-900 max-w-2xl mx-auto pb-10">
                <h3 className="font-bold text-[15px] mb-4">Student-produced response directions</h3>
                <ul className="list-disc pl-5 space-y-3 mb-8 text-[14px]">
                  <li>If you find <strong>more than one correct answer</strong>, enter only one answer.</li>
                  <li>You can enter up to 5 characters for a <strong>positive</strong> answer and up to 6 characters (including the negative sign) for a <strong>negative</strong> answer.</li>
                  <li>If your answer is a <strong>fraction</strong> that doesn't fit in the provided space, enter the decimal equivalent.</li>
                  <li>If your answer is a <strong>decimal</strong> that doesn't fit in the provided space, enter it by truncating or rounding at the fourth digit.</li>
                  <li>If your answer is a <strong>mixed number</strong> (such as <span className="whitespace-nowrap">3 <sup className="-mr-0.5">1</sup>&frasl;<sub className="-ml-0.5">2</sub></span>), enter it as an improper fraction (7/2) or its decimal equivalent (3.5).</li>
                  <li>Don't enter <strong>symbols</strong> such as a percent sign, comma, or dollar sign.</li>
                </ul>
                <div className="text-center font-bold mb-2 text-[14px]">Examples</div>
                <table className="w-full border-collapse text-center text-[13px]">
                  <thead>
                    <tr>
                      <th className="border border-black p-3 font-normal">Answer</th>
                      <th className="border border-black p-3 font-normal">Acceptable ways to<br/>enter answer</th>
                      <th className="border border-black p-3 font-normal">Unacceptable: will<br/>NOT receive credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black p-3 font-mono font-bold text-[15px]">3.5</td>
                      <td className="border border-black p-3 font-mono font-bold text-[15px]">
                        <div className="mb-1">3.5</div>
                        <div className="mb-1">3.50</div>
                        <div>7/2</div>
                      </td>
                      <td className="border border-black p-3 font-mono font-bold text-[15px] text-gray-600">
                        <div className="mb-1">31/2</div>
                        <div>3 1/2</div>
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-3 font-bold text-[15px]">
                        <span className="inline-flex flex-col items-center justify-center leading-none align-middle font-serif">
                          <span className="border-b border-black px-1 pb-[2px]">2</span>
                          <span className="px-1 pt-[2px]">3</span>
                        </span>
                      </td>
                      <td className="border border-black p-3 font-mono font-bold text-[15px]">
                        <div className="mb-1">2/3</div>
                        <div className="mb-1">.6666</div>
                        <div className="mb-1">.6667</div>
                        <div className="mb-1">0.666</div>
                        <div>0.667</div>
                      </td>
                      <td className="border border-black p-3 font-mono font-bold text-[15px] text-gray-600">
                        <div className="mb-1">0.66</div>
                        <div className="mb-1">.66</div>
                        <div className="mb-1">0.67</div>
                        <div>.67</div>
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-3 font-bold text-[15px]">
                        <span className="inline-flex items-center align-middle font-serif">
                          <span className="mr-1">-</span>
                          <span className="inline-flex flex-col items-center justify-center leading-none">
                            <span className="border-b border-black px-1 pb-[2px]">1</span>
                            <span className="px-1 pt-[2px]">3</span>
                          </span>
                        </span>
                      </td>
                      <td className="border border-black p-3 font-mono font-bold text-[15px]">
                        <div className="mb-1">-1/3</div>
                        <div className="mb-1">-.3333</div>
                        <div>-0.333</div>
                      </td>
                      <td className="border border-black p-3 font-mono font-bold text-[15px] text-gray-600">
                        <div className="mb-1">-.33</div>
                        <div>-0.33</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="max-w-none text-[#1a1a1a] leading-relaxed font-normal highlightable-area" style={{ fontSize: '16.5px', lineHeight: '1.65' }}>
                {currentQ.image_url && <div className="mb-8 flex justify-center"><img src={currentQ.image_url} className="max-w-full h-auto object-contain max-h-[60vh] rounded border border-gray-200 shadow-sm"/></div>}
                {currentQ.context && <RichText content={currentQ.context} />}
              </div>
            )}
          </div>
        )}

        {hasLeftSide && !showCalculator && (
          <div className="w-3 h-full shrink-0 cursor-col-resize flex flex-col justify-center items-center bg-gray-100 hover:bg-gray-200 border-r border-gray-300 group transition-colors relative z-10" onMouseDown={() => setIsDragging(true)} title="Drag to resize columns">
             <div className="w-1 h-10 bg-gray-400 group-hover:bg-blue-500 rounded-full transition-colors"></div>
          </div>
        )}

        <div className={`h-full overflow-y-auto bg-white flex flex-col relative min-w-0 ${!hasLeftSide && !showCalculator ? 'w-1/2 mx-auto' : 'flex-1'}`} onMouseUp={handleMouseUp}>
          {/* Digital SAT Style Question Header Banner */}
          <div className="bg-[#ebebeb] pt-3 pb-2.5 px-6 border-b-2 border-dashed border-black sticky top-0 z-10 font-sans select-none flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-black text-white px-2.5 py-1 font-bold text-sm sm:text-base rounded-sm shadow-sm">{currentIndex + 1}</div>
              <button onClick={toggleMarkForReview} className={`flex items-center gap-2 text-sm sm:text-base font-semibold px-2 py-1 rounded transition ${markedForReview[currentQ.qid] ? 'text-red-600 bg-red-50' : 'text-gray-900 hover:bg-gray-200/70'}`}>
                <Bookmark className={`w-4 h-4 sm:w-5 sm:h-5 ${markedForReview[currentQ.qid] ? 'fill-red-600 text-red-600' : 'text-gray-900'}`} /> Mark for Review
              </button>
            </div>
            {(!currentQ.question_type || currentQ.question_type.toUpperCase() === 'MCQ') && (
              <button onClick={() => setShowEliminators(p => !p)} className={`text-xs sm:text-sm font-bold flex items-center gap-1.5 px-2.5 py-1 rounded border-2 transition ${showEliminators ? 'bg-black border-black text-white shadow-sm' : 'bg-white border-black text-black hover:bg-gray-100'}`} title={showEliminators ? "Disable Option Eliminator" : "Enable Option Eliminator"}>
                <span className="line-through decoration-2">ABC</span>
              </button>
            )}
          </div>

          <div className="px-6 sm:px-8 pt-3.5 sm:pt-4 pb-10 flex-1 max-w-4xl mx-auto w-full">
            {isMath && (currentQ.image_url || currentQ.context) && (
              <div className="mb-3 sm:mb-4 highlightable-area text-gray-900 font-normal leading-relaxed text-sm sm:text-base">
                {currentQ.image_url && <div className="mb-3.5 flex justify-center"><img src={currentQ.image_url} className="max-w-full h-auto object-contain max-h-[45vh] rounded border border-gray-300 shadow-sm"/></div>}
                {currentQ.context && <RichText content={currentQ.context} />}
              </div>
            )}

            <div className="max-w-none text-gray-900 font-medium mb-3.5 sm:mb-4 highlightable-area leading-relaxed text-sm sm:text-base">
              <RichText content={currentQ.question} />
            </div>

            <div className="space-y-2 sm:space-y-2.5 w-full">
              {(!currentQ.question_type || currentQ.question_type.toUpperCase() === 'MCQ') ? (
                ['A', 'B', 'C', 'D'].map(letter => {
                  const optText = currentQ[`option_${letter.toLowerCase()}`]
                  if (!optText) return null
                  const isSel = answers[currentQ.qid] === letter
                  const isElim = eliminatedOptions[currentQ.qid]?.[letter]
                  const cleanOpt = stripOptionLetter(optText)
                  return (
                    <div key={letter} className="relative flex items-center gap-2.5 w-full group">
                      <button onClick={() => !isElim && handleAnswer(letter)} disabled={isElim} className={`flex-1 text-left px-3.5 py-2 sm:py-2 rounded-xl border flex items-center relative transition-all duration-150 ${isSel ? 'border-2 border-[#0077c8] bg-[#f0f8ff] shadow-sm' : isElim ? 'border border-gray-300 bg-gray-100 opacity-40 grayscale cursor-not-allowed' : 'border border-gray-600 bg-white hover:border-gray-900 hover:shadow-sm'}`}>
                        <div className={`w-6 h-6 sm:w-6.5 sm:h-6.5 shrink-0 flex items-center justify-center rounded-full border-2 mr-2.5 font-sans font-bold text-xs transition-colors ${isSel ? 'bg-[#0077c8] border-[#0077c8] text-white shadow-inner' : 'border-black text-black group-hover:bg-gray-100'}`}>{letter}</div>
                        <div className="flex-1 text-gray-900 font-medium text-sm sm:text-base leading-snug"><RichText content={cleanOpt} /></div>
                        {isElim && <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-3.5"><div className="w-full h-[2px] bg-red-600/80"></div></div>}
                      </button>
                      {showEliminators && (
                        <button onClick={e => toggleEliminateOption(e, letter)} className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${isElim ? 'bg-red-50 border-red-500 text-red-600 scale-105 shadow-sm' : 'bg-white border-gray-400 text-gray-400 hover:text-red-600 hover:border-red-500'}`} title={`Eliminate option ${letter}`}><Ban className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="mt-6 border-t border-gray-300 pt-6">
                  <input
                    type="text"
                    value={answers[currentQ.qid] || ''}
                    onKeyDown={(e) => {
                      if (e.key.length === 1 && !/[0-9.\/-]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        handleAnswer('');
                        return;
                      }
                      if (/[^0-9.\/-]/.test(val)) return;
                      if (val.indexOf('-') > 0 || val.split('-').length > 2) return;
                      if (val.split('.').length > 2 || val.split('/').length > 2) return;
                      if (val.includes('.') && val.includes('/')) return;
                      if (val.length > (val.startsWith('-') ? 6 : 5)) return;
                      handleAnswer(val);
                    }}
                    placeholder="Enter answer"
                    className="w-full max-w-[14rem] p-3.5 text-xl border-2 border-gray-600 rounded-lg focus:border-[#0077c8] focus:ring-4 focus:ring-blue-100 outline-none transition-all font-mono shadow-sm text-black"
                  />
                  <div className="mt-4 font-bold text-gray-900 font-sans tracking-wide flex items-center text-sm">
                    Answer Preview: {renderAnswerPreview(answers[currentQ.qid])}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-5 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setReportingQid(currentQ.qid)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-sans font-bold text-gray-700 bg-white hover:bg-red-50 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded-lg transition-all shadow-sm active:scale-95 group"
                title="Report an issue with this question"
              >
                <Flag className="w-3.5 h-3.5 text-gray-500 group-hover:text-red-600 transition-colors" />
                <span className="tracking-wide">Report</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Highlight Tooltip */}
      {highlightCoords && (
        <div
          className="fixed z-[100] bg-[#1a1a1a] text-white px-3 py-1.5 rounded-full shadow-2xl border border-gray-700 flex items-center gap-2 -translate-x-1/2 animate-in fade-in zoom-in-95 duration-150 select-none"
          style={{ top: `${Math.max(10, highlightCoords.top)}px`, left: `${highlightCoords.left}px` }}
        >
          <span className="text-[11px] font-bold text-gray-300 mr-1">Highlight:</span>
          <button onClick={() => applyHighlight('yellow')} className="w-5 h-5 rounded-full bg-yellow-300 hover:scale-125 transition border border-yellow-500 shadow-sm" title="Yellow Highlight"/>
          <button onClick={() => applyHighlight('green')} className="w-5 h-5 rounded-full bg-green-300 hover:scale-125 transition border border-green-500 shadow-sm" title="Green Highlight"/>
          <button onClick={() => applyHighlight('pink')} className="w-5 h-5 rounded-full bg-pink-300 hover:scale-125 transition border border-pink-500 shadow-sm" title="Pink Highlight"/>
          <button onClick={() => applyHighlight('blue')} className="w-5 h-5 rounded-full bg-blue-300 hover:scale-125 transition border border-blue-500 shadow-sm" title="Blue Highlight"/>
          <div className="w-px h-4 bg-gray-700 mx-1" />
          <button
            onClick={() => { setHighlightCoords(null); setSelectionRange(null); window.getSelection().removeAllRanges() }}
            className="text-gray-400 hover:text-white text-xs font-bold px-1"
            title="Cancel"
          >
            ✕
          </button>
        </div>
      )}

      {/* Footer Navigation */}
      <footer className="px-6 sm:px-8 py-3 sm:py-3.5 bg-[#1c1c1c] border-t border-black flex items-center justify-between z-10 font-sans select-none">
        <div className="flex-1 flex items-center">
          <img src="/logo.png" alt="Prepnova Logo" className="h-8 sm:h-9 w-auto object-contain" />
        </div>
        <div className="flex-1 flex justify-center">
           <button onClick={() => setShowQuestionMenu(true)} className="px-6 py-2 sm:px-8 sm:py-2.5 bg-[#cfcfcf] hover:bg-[#bebebe] text-black rounded-full font-bold text-sm sm:text-base tracking-wide flex items-center gap-2.5 transition shadow-sm">
             <span>Question {currentIndex + 1} of {questions.length}</span>
             <ChevronUp className="w-4 h-4 text-black stroke-[2.5]" />
           </button>
        </div>
        <div className="flex-1 flex gap-3 sm:gap-3.5 justify-end">
          <button disabled={currentIndex === 0} onClick={() => setCurrentIndex(p => p - 1)} className="px-6 py-2 sm:px-7 sm:py-2.5 bg-[#cfcfcf] hover:bg-[#bebebe] text-black rounded-full font-bold text-sm sm:text-base tracking-wide transition shadow-sm disabled:opacity-30 disabled:pointer-events-none">Back</button>
          {currentIndex === questions.length - 1 ? (
             <button onClick={() => setShowExitModal(true)} className="px-7 py-2 sm:px-8 sm:py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-sm sm:text-base tracking-wide transition shadow-md">Next</button>
          ) : (
            <button onClick={() => setCurrentIndex(p => p + 1)} className="px-6 py-2 sm:px-7 sm:py-2.5 bg-[#cfcfcf] hover:bg-[#bebebe] text-black rounded-full font-bold text-sm sm:text-base tracking-wide transition shadow-sm">Next</button>
          )}
        </div>
      </footer>

      {/* Question Navigation Modal */}
      {showQuestionMenu && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#1a1a1a] w-full max-w-4xl rounded-t-3xl p-8 shadow-2xl border-t border-gray-700 animate-in slide-in-from-bottom duration-500 font-sans">
            <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
              <h3 className="text-xl font-bold text-white">Section Review</h3>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-500">Press ESC to close</span>
                <button onClick={() => setShowQuestionMenu(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3 mb-8">
              {questions.map((q, idx) => {
                const isAnswered = !!answers[q.qid];
                const isCurrent = currentIndex === idx;
                const isMarked = markedForReview[q.qid];

                return (
                  <button
                    key={q.qid}
                    onClick={() => {
                      setCurrentIndex(idx)
                      setShowQuestionMenu(false)
                    }}
                    className={`h-16 rounded-lg flex items-center justify-center font-bold text-2xl transition-all relative border-2 ${isCurrent && isAnswered
                        ? 'border-blue-500 bg-blue-600 text-white shadow-[0_0_12px_rgba(59,130,246,0.7)]'
                        : isCurrent
                          ? 'border-blue-500 bg-white text-black shadow-[0_0_12px_rgba(59,130,246,0.7)]'
                          : isAnswered
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-gray-500 text-black hover:border-gray-300'
                      }`}
                  >
                    {idx + 1}
                    {isMarked && (
                      <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center">
                        <Bookmark className="w-4 h-4 fill-red-600 text-red-600 drop-shadow-sm" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="flex justify-end pt-4 border-t border-gray-700">
              <button
                onClick={() => setShowExitModal(true)}
                className="px-8 py-3 bg-blue-600 text-white rounded-full font-bold text-sm tracking-wide hover:bg-blue-700 transition-all shadow-sm active:scale-[0.98]"
              >
                Go to Submit Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit/Finish Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 font-sans">
          <div className="bg-[#1a1a1a] p-10 rounded-2xl shadow-2xl max-w-md w-full border border-gray-700 animate-in zoom-in duration-300">
            <h3 className="text-2xl font-black text-white mb-2">Ready to leave?</h3>
            <p className="text-gray-400 mb-2 text-sm leading-relaxed">
              You have answered <strong className="text-white">{Object.keys(answers).length}</strong> out of <strong className="text-white">{questions.length}</strong> questions. What would you like to do?
            </p>
            <p className="text-yellow-400 text-xs font-semibold mb-8 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Timer is paused
            </p>
            <div className="flex flex-col gap-3">
              <button
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="w-full py-3.5 bg-blue-600 text-white rounded-lg font-bold text-sm tracking-wide hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit & View Results'}
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-3.5 bg-red-600 text-white rounded-lg font-bold text-sm tracking-wide hover:bg-red-700 transition-all active:scale-[0.98]"
              >
                Quit Without Submitting
              </button>
              <button
                onClick={() => setShowExitModal(false)}
                className="w-full py-3.5 bg-white text-black rounded-lg font-bold text-sm tracking-wide hover:bg-gray-200 transition-all active:scale-[0.98]"
              >
                Continue Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Up Modal */}
      {showTimeUpModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-xl p-4 font-sans">
          <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-lg w-full text-center border border-gray-100 animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Time's Up!</h3>
            <p className="text-gray-500 mb-8 text-base">The testing period has ended. Your answers have been saved locally. What would you like to do?</p>
            <div className="flex flex-col gap-3">
              <button
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-sm tracking-wide hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit & View Results'}
              </button>
              <button
                onClick={() => setShowTimeUpModal(false)}
                className="w-full py-3 text-gray-400 font-semibold text-sm hover:text-gray-600 transition"
              >
                Continue Reviewing
              </button>
            </div>
          </div>
        </div>
      )}

      <ReportBugModal
        isOpen={!!reportingQid}
        onClose={() => setReportingQid(null)}
        questionId={reportingQid}
        moduleId={moduleId}
        questionIndex={currentIndex + 1}
        contextRoute={`/quiz/${moduleId}`}
      />
    </div>
  )
}
