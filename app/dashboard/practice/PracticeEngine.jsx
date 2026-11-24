'use client'

import React, { useState, useEffect, useRef } from 'react'
import RichText, { stripOptionLetter } from '@/components/RichText'
import DesmosCalculator from '@/components/DesmosCalculator'
import ReportBugModal from '@/components/ReportBugModal'
import { Bookmark, ChevronUp, ChevronDown, X, Clock, EyeOff, Ban, Calculator, CheckCircle2, XCircle, Info, Loader2, Flag, Moon, Sun } from 'lucide-react'
import { recordBatchAttemptsO1Action } from '@/app/actions/difficultyEngineActions'

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

export default function PracticeEngine({ sessionData, onExit }) {
  const { subject, questions, timeLimit } = sessionData
  const timeLimitSeconds = timeLimit ? timeLimit * 60 : 0
  const [currentIndex, setCurrentIndex] = useState(0)

  const [answers, setAnswers] = useState({})
  const [markedForReview, setMarkedForReview] = useState({})
  const [eliminatedOptions, setEliminatedOptions] = useState({})

  // Practice specific state
  const [correctlySolved, setCorrectlySolved] = useState({}) // { qid: true }
  const [wrongGuesses, setWrongGuesses] = useState({}) // { qid: ['A', 'B'] }
  const [showExplanationModal, setShowExplanationModal] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [reportingQid, setReportingQid] = useState(null)

  const [attemptHistory, setAttemptHistory] = useState([])
  const [isEnding, setIsEnding] = useState(false)

  const [timeElapsed, setTimeElapsed] = useState(timeLimitSeconds > 0 ? timeLimitSeconds : 0)
  const [isTimerVisible, setIsTimerVisible] = useState(true)

  const [showQuestionMenu, setShowQuestionMenu] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)
  
  const [showTimeUpModal, setShowTimeUpModal] = useState(false)
  const [hasContinuedPastTime, setHasContinuedPastTime] = useState(false)

  const [theme, setTheme] = useState('light')
  
  useEffect(() => {
    const savedTheme = localStorage.getItem('practice_theme')
    if (savedTheme) setTheme(savedTheme)
  }, [])
  
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('practice_theme', newTheme)
  }

  const [leftWidth, setLeftWidth] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const [showEliminators, setShowEliminators] = useState(false)

  // Highlight State
  const [highlightCoords, setHighlightCoords] = useState(null)
  const [selectionRange, setSelectionRange] = useState(null)
  const [highlights, setHighlights] = useState({})

  // Timer Logic
  useEffect(() => {
    if (!showExitModal && !isEnding && !showTimeUpModal) {
      const interval = setInterval(() => {
        setTimeElapsed(prev => {
          if (timeLimitSeconds > 0 && !hasContinuedPastTime) {
            if (prev <= 1) {
              clearInterval(interval)
              return 0
            }
            return prev - 1
          } else {
            return prev + 1
          }
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [showExitModal, timeLimitSeconds, isEnding, showTimeUpModal, hasContinuedPastTime])

  // Divider Drag Logic
  useEffect(() => {
    const onDrag = (e) => {
      if (!isDragging) return
      const newLeftWidth = (e.clientX / window.innerWidth) * 100
      if (newLeftWidth > 33 && newLeftWidth < 66) {
        setLeftWidth(newLeftWidth)
      }
    }
    const stopDrag = () => {
      if (isDragging) setIsDragging(false)
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

  // Custom Highlight Logic Effect
  useEffect(() => {
    if (!questions.length || !window.CSS || !CSS.highlights) return;
    if (!document.getElementById('highlight-styles')) {
      const style = document.createElement('style');
      style.id = 'highlight-styles';
      style.textContent = `
        ::highlight(highlight-yellow) { background-color: rgba(250, 204, 21, 0.4); }
        ::highlight(highlight-pink) { background-color: rgba(244, 114, 182, 0.4); }
        ::highlight(highlight-green) { background-color: rgba(74, 222, 128, 0.4); }
        ::highlight(highlight-blue) { background-color: rgba(96, 165, 250, 0.4); }
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

  const handleMouseUp = () => {
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      let node = selection.anchorNode
      let container = null
      while (node) {
        if (node.classList && node.classList.contains('highlightable-area')) { container = node; break }
        node = node.parentNode
      }
      if (!container) { setHighlightCoords(null); setSelectionRange(null); return }
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setHighlightCoords({ top: rect.top - 50, left: rect.left + rect.width / 2 })
      setSelectionRange(range)
    } else {
      setHighlightCoords(null); setSelectionRange(null)
    }
  }

  const applyHighlight = (colorName) => {
    if (!selectionRange) return
    let container = selectionRange.commonAncestorContainer;
    while (container && (!container.classList || !container.classList.contains('highlightable-area'))) container = container.parentNode;
    if (!container) { setHighlightCoords(null); setSelectionRange(null); return; }
    const allContainers = document.querySelectorAll('.highlightable-area');
    let containerIndex = 0;
    allContainers.forEach((c, i) => { if (c === container) containerIndex = i; });
    const getAbsoluteOffset = (node, offset) => {
      const treeWalker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
      let absoluteOffset = 0;
      while (treeWalker.nextNode()) {
        if (treeWalker.currentNode === node) return absoluteOffset + offset;
        absoluteOffset += treeWalker.currentNode.nodeValue.length;
      }
      return absoluteOffset;
    };
    const actualStart = Math.min(getAbsoluteOffset(selectionRange.startContainer, selectionRange.startOffset), getAbsoluteOffset(selectionRange.endContainer, selectionRange.endOffset));
    const actualEnd = Math.max(getAbsoluteOffset(selectionRange.startContainer, selectionRange.startOffset), getAbsoluteOffset(selectionRange.endContainer, selectionRange.endOffset));
    const qid = questions[currentIndex].qid;
    setHighlights(prev => ({ ...prev, [qid]: [...(prev[qid] || []), { startOffset: actualStart, endOffset: actualEnd, color: colorName, containerIndex }] }));
    setHighlightCoords(null); setSelectionRange(null); window.getSelection().removeAllRanges();
  }


  if (!questions || questions.length === 0) {
    return <div className="p-8 text-black">No questions provided.</div>
  }

  const currentQ = questions[currentIndex]
  const isSolved = correctlySolved[currentQ.qid]
  const hasCheckedOnce = isSolved || (wrongGuesses[currentQ.qid] && wrongGuesses[currentQ.qid].length > 0)
  const currentAnswer = answers[currentQ.qid]

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const toggleMarkForReview = () => {
    setMarkedForReview(prev => ({
      ...prev,
      [currentQ.qid]: !prev[currentQ.qid]
    }))
  }

  const toggleEliminateOption = (e, opt) => {
    e.stopPropagation()
    const qid = currentQ.qid
    setEliminatedOptions(p => {
      const willBeEliminated = !(p[qid]?.[opt])
      if (willBeEliminated) {
        setAnswers(prevAns => {
          if (prevAns[qid] === opt) return { ...prevAns, [qid]: '' }
          return prevAns
        })
      }
      return { ...p, [qid]: { ...(p[qid] || {}), [opt]: willBeEliminated } }
    })
  }

  const handleAnswer = (val) => {
    if (isSolved) return // Disable changing answer after solved
    setAnswers(prev => ({ ...prev, [currentQ.qid]: prev[currentQ.qid] === val ? '' : val }))
  }

  const handleCheckAnswer = async () => {
    if (!currentAnswer) return alert('Please select or type an answer first.')
    if (isSolved) return

    setIsChecking(true)

    let correct = false
    if (!currentQ.question_type || currentQ.question_type.toUpperCase() === 'MCQ') {
      correct = currentAnswer === currentQ.correct_answer
    } else {
      const cAns = currentQ.correct_answer.split('|').map(s => s.trim())
      correct = cAns.includes(currentAnswer.trim())
    }

    setAttemptHistory(prev => [
      ...prev,
      { qid: currentQ.qid, isCorrect: correct, subjectTag: subject }
    ])

    if (correct) {
      setCorrectlySolved(prev => ({ ...prev, [currentQ.qid]: true }))
    } else {
      setWrongGuesses(prev => ({
        ...prev,
        [currentQ.qid]: [...(prev[currentQ.qid] || []), currentAnswer]
      }))
      if (!currentQ.question_type || currentQ.question_type.toUpperCase() === 'MCQ') {
        setAnswers(prev => ({ ...prev, [currentQ.qid]: '' }))
      }
    }

    setIsChecking(false)
  }

  const handleReviewAnswers = () => {
    const newCorrectlySolved = { ...correctlySolved }
    const newWrongGuesses = { ...wrongGuesses }
    const newAttemptHistory = [...attemptHistory]

    questions.forEach(q => {
      const qid = q.qid
      const currentAns = answers[qid]
      const alreadyChecked = newCorrectlySolved[qid] || (newWrongGuesses[qid] && newWrongGuesses[qid].length > 0)
      
      if (currentAns && !alreadyChecked) {
        let correct = false
        if (!q.question_type || q.question_type.toUpperCase() === 'MCQ') {
          correct = currentAns === q.correct_answer
        } else {
          const cAns = q.correct_answer.split('|').map(s => s.trim())
          correct = cAns.includes(currentAns.trim())
        }
        
        newAttemptHistory.push({ qid, isCorrect: correct, subjectTag: subject })
        
        if (correct) {
          newCorrectlySolved[qid] = true
        } else {
          newWrongGuesses[qid] = [currentAns]
        }
      }
    })

    setCorrectlySolved(newCorrectlySolved)
    setWrongGuesses(newWrongGuesses)
    setAttemptHistory(newAttemptHistory)
    setCurrentIndex(0)
    setHasContinuedPastTime(true) // Bypass timer
    setShowExitModal(false)
  }

  const handleEndPractice = async () => {
    setIsEnding(true)
    if (attemptHistory.length > 0) {
      await recordBatchAttemptsO1Action({ attempts: attemptHistory })
    }
    setShowExitModal(false)
    onExit()
  }

  const isMath = subject === 'MATH' || currentQ.subject_tag === 'Math'
  const isSPR = currentQ.question_type && currentQ.question_type.toUpperCase() !== 'MCQ'
  const isMathSPR = isMath && isSPR
  const hasLeftSide = (!isMath && !!(currentQ.context || currentQ.image_url)) || isMathSPR

  useEffect(() => {
    if (timeLimitSeconds > 0 && timeElapsed === 0 && !isEnding && !hasContinuedPastTime) {
      setShowTimeUpModal(true)
    }
  }, [timeElapsed, timeLimitSeconds, isEnding, hasContinuedPastTime])

  return (
    <div className={`flex flex-col h-screen bg-gray-100 text-gray-900 dark:bg-[#121212] dark:text-gray-100 overflow-hidden font-serif ${theme === 'dark' ? 'dark' : ''}`}>
      <header className="flex items-center justify-between px-6 sm:px-8 py-3 border-b border-black bg-[#1a1a1a] text-white z-10 select-none font-serif">
        <div className="flex-1 font-bold text-base sm:text-lg text-white tracking-wide flex items-center gap-3">
          <span>{subject === 'MATH' ? 'Math' : 'Reading & Writing'} <span className="text-gray-400 mx-1">•</span> Practice</span>
        </div>
        <div className="flex-1 flex justify-center items-center">
          <div className="flex items-center gap-3.5">
            {isTimerVisible ? (
              <div className={`font-serif font-bold text-lg sm:text-xl tracking-[0.2em] text-white`}>
                {formatTime(timeElapsed).replace(':', ' : ')}
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
          {hasCheckedOnce && (
            <button
              onClick={() => setShowExplanationModal(true)}
              className="px-4 py-1.5 sm:px-5 sm:py-2 bg-[#333333] hover:bg-[#444444] border border-gray-600/60 rounded-[4px] font-bold text-white transition text-xs sm:text-sm tracking-wide shadow-sm flex items-center gap-2"
            >
              <Info className="w-4 h-4" />
              <span>Explanation</span>
            </button>
          )}
          {isMath && (
            <button
              type="button"
              onClick={() => setShowCalculator(!showCalculator)}
              className={`flex items-center gap-2 px-4 py-1.5 sm:px-5 sm:py-2 rounded-[4px] font-bold text-xs sm:text-sm tracking-wide transition shadow-sm border ${showCalculator
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
            End Practice
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden bg-white dark:bg-[#121212] relative">
        <DesmosCalculator
          isOpen={showCalculator && isMath && !showExitModal}
          onClose={() => setShowCalculator(false)}
        />
        {hasLeftSide && !showCalculator && (
          <div className="h-full overflow-y-auto bg-white dark:bg-[#121212] p-10 shrink-0 border-r border-gray-200 dark:border-gray-800" style={{ width: `${leftWidth}%` }} onMouseUp={handleMouseUp}>
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
                      <th className="border border-black p-3 font-normal">Acceptable ways to<br />enter answer</th>
                      <th className="border border-black p-3 font-normal">Unacceptable: will<br />NOT receive credit</th>
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
              <div className="max-w-none text-[#1a1a1a] dark:text-gray-100 leading-relaxed font-normal highlightable-area" style={{ fontSize: '16.5px', lineHeight: '1.65' }}>
                {currentQ.image_url && <div className="mb-8 flex justify-center"><img src={currentQ.image_url.startsWith('http') ? currentQ.image_url : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content_images/${currentQ.image_url}`} className="max-w-full h-auto object-contain max-h-[60vh] rounded border border-gray-200 dark:border-gray-700 shadow-sm" /></div>}
                {currentQ.context && <RichText content={currentQ.context} />}
              </div>
            )}
          </div>
        )}

        {hasLeftSide && !showCalculator && (
          <div className="w-3 h-full shrink-0 cursor-col-resize flex flex-col justify-center items-center bg-gray-100 dark:bg-[#1e1e1e] hover:bg-gray-200 dark:hover:bg-[#2a2a2a] border-r border-gray-300 dark:border-gray-800 group transition-colors relative z-10" onMouseDown={() => setIsDragging(true)} title="Drag to resize columns">
            <div className="w-1 h-10 bg-gray-400 group-hover:bg-blue-500 rounded-full transition-colors"></div>
          </div>
        )}

        <div className={`h-full overflow-y-auto bg-white dark:bg-[#121212] flex flex-col relative min-w-0 ${!hasLeftSide && !showCalculator ? 'w-1/2 mx-auto' : 'flex-1'}`} onMouseUp={handleMouseUp}>
          {/* Digital SAT Style Question Header Banner */}
          <div className="bg-[#ebebeb] dark:bg-[#1e1e1e] pt-3 pb-2.5 px-6 border-b-2 border-dashed border-black dark:border-gray-600 sticky top-0 z-10 font-sans select-none flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-black text-white px-2.5 py-1 font-bold text-sm sm:text-base rounded-sm shadow-sm">{currentIndex + 1}</div>
              <button onClick={toggleMarkForReview} className={`flex items-center gap-2 text-sm sm:text-base font-semibold px-2 py-1 rounded transition ${markedForReview[currentQ.qid] ? 'text-red-600 bg-red-50 dark:bg-red-900/30' : 'text-gray-900 dark:text-gray-200 hover:bg-gray-200/70 dark:hover:bg-white/10'}`}>
                <Bookmark className={`w-4 h-4 sm:w-5 sm:h-5 ${markedForReview[currentQ.qid] ? 'fill-current text-red-600' : 'text-gray-900 dark:text-gray-200'}`} /> Mark for Review
              </button>
            </div>
            {(!currentQ.question_type || currentQ.question_type.toUpperCase() === 'MCQ') && (
              <button onClick={() => setShowEliminators(p => !p)} className={`text-xs sm:text-sm font-bold flex items-center gap-1.5 px-2.5 py-1 rounded border-2 transition ${showEliminators ? 'bg-black dark:bg-white border-black dark:border-white text-white dark:text-black shadow-sm' : 'bg-white dark:bg-[#2a2a2a] border-black dark:border-gray-500 text-black dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#333]'}`} title={showEliminators ? "Disable Option Eliminator" : "Enable Option Eliminator"}>
                <span className="line-through decoration-2">ABC</span>
              </button>
            )}
          </div>

          <div className="px-6 sm:px-8 pt-3.5 sm:pt-4 pb-10 flex-1 max-w-4xl mx-auto w-full">
            {isMath && (currentQ.image_url || currentQ.context) && (
              <div className="mb-3 sm:mb-4 highlightable-area text-gray-900 dark:text-gray-100 font-normal leading-relaxed text-sm sm:text-base">
                {currentQ.image_url && <div className="mb-3.5 flex justify-center"><img src={currentQ.image_url.startsWith('http') ? currentQ.image_url : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content_images/${currentQ.image_url}`} className="max-w-full h-auto object-contain max-h-[45vh] rounded border border-gray-300 dark:border-gray-700 shadow-sm" /></div>}
                {currentQ.context && <RichText content={currentQ.context} />}
              </div>
            )}

            <div className="max-w-none text-gray-900 dark:text-gray-100 font-medium mb-3.5 sm:mb-4 highlightable-area leading-relaxed text-sm sm:text-base">
              <RichText content={currentQ.question} />
            </div>

            <div className="space-y-2 sm:space-y-2.5 w-full">
              {(!currentQ.question_type || currentQ.question_type.toUpperCase() === 'MCQ') ? (
                ['A', 'B', 'C', 'D'].map(letter => {
                  const optText = currentQ[`option_${letter.toLowerCase()}`]
                  if (!optText) return null
                  const isSel = answers[currentQ.qid] === letter
                  const isElim = eliminatedOptions[currentQ.qid]?.[letter]
                  const isWrongGuess = wrongGuesses[currentQ.qid]?.includes(letter)
                  const cleanOpt = stripOptionLetter(optText)

                  // Practice engine additions: Check colors
                  let isAnsCorrect = null;
                  let checkClasses = '';
                  if (isSolved) {
                    if (currentQ.correct_answer === letter) {
                      isAnsCorrect = true;
                      checkClasses = 'border-2 border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/20 shadow-sm';
                    } else if (isWrongGuess) {
                      isAnsCorrect = false;
                      checkClasses = 'border-2 border-red-600 dark:border-red-500 bg-red-50 dark:bg-red-900/20 opacity-60 grayscale';
                    } else {
                      checkClasses = 'border border-gray-300 dark:border-gray-700 opacity-70';
                    }
                  } else {
                    if (isWrongGuess) {
                      isAnsCorrect = false;
                      checkClasses = 'border-2 border-red-600 dark:border-red-500 bg-red-50 dark:bg-red-900/20 opacity-60 grayscale cursor-not-allowed';
                    } else if (isSel) {
                      checkClasses = 'border-2 border-[#0077c8] dark:border-blue-400 bg-[#f0f8ff] dark:bg-blue-900/20 shadow-sm';
                    } else if (isElim) {
                      checkClasses = 'border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-[#1a1a1a] opacity-40 grayscale cursor-not-allowed';
                    } else {
                      checkClasses = 'border border-gray-600 dark:border-gray-500 bg-white dark:bg-[#1a1a1a] hover:border-gray-900 dark:hover:border-gray-300 hover:shadow-sm';
                    }
                  }

                  return (
                    <div key={letter} className="relative flex items-center gap-2.5 w-full group">
                      <button onClick={() => !isElim && !isWrongGuess && handleAnswer(letter)} disabled={isElim || isSolved || isWrongGuess} className={`flex-1 text-left px-3.5 py-2 sm:py-2 rounded-xl flex items-center relative transition-all duration-150 ${checkClasses}`}>
                        <div className={`w-6 h-6 sm:w-6.5 sm:h-6.5 shrink-0 flex items-center justify-center rounded-full border-2 mr-2.5 font-sans font-bold text-xs transition-colors ${isSolved ? (isAnsCorrect === true ? 'bg-green-600 border-green-600 text-white' : isAnsCorrect === false ? 'bg-red-600 border-red-600 text-white' : 'border-gray-400 dark:border-gray-600 text-gray-400 dark:text-gray-500') : (isWrongGuess ? 'bg-red-600 border-red-600 text-white' : isSel ? 'bg-[#0077c8] dark:bg-blue-500 border-[#0077c8] dark:border-blue-500 text-white shadow-inner' : 'border-black dark:border-gray-400 text-black dark:text-gray-300 group-hover:bg-gray-100 dark:group-hover:bg-white/10')}`}>{letter}</div>
                        <div className="flex-1 text-gray-900 dark:text-gray-200 font-medium text-sm sm:text-base leading-snug"><RichText content={cleanOpt} /></div>
                        {isElim && <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-3.5"><div className="w-full h-[2px] bg-red-600/80"></div></div>}
                      </button>

                      {showEliminators && !isSolved && !isWrongGuess && (
                        <button onClick={e => toggleEliminateOption(e, letter)} className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${isElim ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-600 scale-105 shadow-sm' : 'bg-white dark:bg-[#2a2a2a] border-gray-400 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:border-red-500'}`} title={`Eliminate option ${letter}`}><Ban className="w-3.5 h-3.5" /></button>
                      )}

                      {/* Correct / Incorrect indicator bubbles over option right edge */}
                      {isSolved && isAnsCorrect === true && <CheckCircle2 size={24} className="text-green-600 shrink-0 absolute -right-8" />}
                      {!isSolved && isAnsCorrect === false && <XCircle size={24} className="text-red-600 shrink-0 absolute -right-8" />}
                    </div>
                  )
                })
              ) : (
                <div className="mt-6 border-t border-gray-300 dark:border-gray-700 pt-6">
                  <input
                    type="text"
                    disabled={isSolved}
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
                    className={`w-full max-w-xs border-2 rounded p-3 text-center text-lg sm:text-xl font-bold font-serif outline-none transition-colors ${isSolved
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                        : wrongGuesses[currentQ.qid]?.length ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300' : 'border-gray-600 dark:border-gray-500 bg-white dark:bg-[#1a1a1a] dark:text-white'
                      }`}
                  />
                  {!isSolved && (
                    <div className="mt-4 font-bold text-gray-900 dark:text-gray-100 font-sans tracking-wide flex items-center text-sm">
                      Answer Preview: {renderAnswerPreview(answers[currentQ.qid])}
                    </div>
                  )}

                  {isSolved && (
                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg max-w-sm">
                      <span className="font-bold text-green-800 dark:text-green-300 block mb-1">Correct Answer:</span>
                      <span className="text-green-900 dark:text-green-100 font-serif text-xl">{currentQ.correct_answer}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* PRACTICE INSTANT ACTION BUTTONS */}
            <div className="mt-8 flex items-center gap-4 border-t border-gray-200 dark:border-gray-700 pt-6 font-sans">
              <button
                type="button"
                onClick={() => setReportingQid(currentQ.qid)}
                className="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-sans font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-[#1e1e1e] hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 border border-gray-300 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-800 rounded-lg transition-all shadow-sm active:scale-95 group"
                title="Report an issue with this question"
              >
                <span>🚩</span>
                <span className="tracking-wide">Report</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="px-6 sm:px-8 py-3 sm:py-3.5 bg-[#1c1c1c] border-t border-black flex items-center justify-between z-10 font-sans select-none">
        <div className="flex-1 flex items-center gap-4">
          <img src="/logo.png" alt="Prepnova Logo" className="h-8 sm:h-9 w-auto object-contain" />
          <button
            onClick={toggleTheme}
            className="px-4 py-2 sm:py-2.5 bg-white dark:bg-[#2a2a2a] hover:bg-gray-100 dark:hover:bg-[#333] text-black dark:text-gray-200 rounded-lg font-bold text-sm sm:text-base tracking-wide transition shadow-sm flex items-center gap-2"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} Theme
          </button>
        </div>
        <div className="flex-1 flex justify-center">
          <button onClick={() => setShowQuestionMenu(true)} className="px-6 py-2 sm:px-8 sm:py-2.5 bg-[#cfcfcf] hover:bg-[#bebebe] text-black rounded-full font-bold text-sm sm:text-base tracking-wide flex items-center gap-2.5 transition shadow-sm">
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <ChevronUp className="w-4 h-4 text-black stroke-[2.5]" />
          </button>
        </div>
        <div className="flex-1 flex gap-3 sm:gap-3.5 justify-end">
          <button disabled={currentIndex === 0} onClick={() => setCurrentIndex(p => p - 1)} className="px-6 py-2 sm:px-7 sm:py-2.5 bg-[#cfcfcf] hover:bg-[#bebebe] dark:bg-[#333] dark:hover:bg-[#444] text-black dark:text-white rounded-full font-bold text-sm sm:text-base tracking-wide transition shadow-sm disabled:opacity-30 disabled:pointer-events-none">Back</button>
          {!isSolved && (
            <button
              onClick={handleCheckAnswer}
              disabled={isChecking || (!currentAnswer && currentQ.question_type === 'MCQ') || (currentQ.question_type !== 'MCQ' && !(answers[currentQ.qid]?.trim()))}
              className="px-6 py-2 sm:px-7 sm:py-2.5 bg-[#cfcfcf] hover:bg-[#bebebe] dark:bg-[#333] dark:hover:bg-[#444] text-black dark:text-white rounded-full font-bold text-sm sm:text-base tracking-wide transition shadow-sm disabled:opacity-30 disabled:pointer-events-none flex items-center gap-2"
            >
              {isChecking ? <Loader2 size={18} className="animate-spin" /> : null}
              Check
            </button>
          )}
          {currentIndex === questions.length - 1 ? (
            <button onClick={() => setShowExitModal(true)} className="px-7 py-2 sm:px-8 sm:py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-sm sm:text-base tracking-wide transition shadow-md">Complete</button>
          ) : (
            <button onClick={() => setCurrentIndex(p => p + 1)} className="px-6 py-2 sm:px-7 sm:py-2.5 bg-[#cfcfcf] hover:bg-[#bebebe] dark:bg-[#333] dark:hover:bg-[#444] text-black dark:text-white rounded-full font-bold text-sm sm:text-base tracking-wide transition shadow-sm">Next</button>
          )}
        </div>
      </footer>

      {showQuestionMenu && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] w-full max-w-4xl rounded-t-3xl p-8 shadow-2xl font-sans">
            <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
              <h3 className="text-xl font-bold text-white">Practice Session Review</h3>
              <button onClick={() => setShowQuestionMenu(false)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-6 h-6 text-gray-400" /></button>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3 mb-8">
              {questions.map((q, idx) => (
                <button
                  key={q.qid} onClick={() => { setCurrentIndex(idx); setShowQuestionMenu(false) }}
                  className={`h-16 rounded-lg flex items-center justify-center font-bold text-2xl relative border-2 ${currentIndex === idx && answers[q.qid] ? 'border-blue-500 bg-blue-600 text-white' : currentIndex === idx ? 'border-blue-500 bg-white dark:bg-[#2a2a2a] text-black dark:text-gray-200' : answers[q.qid] ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-[#2a2a2a] border-gray-500 dark:border-gray-600 text-black dark:text-gray-200'}`}
                >
                  {idx + 1}
                  {markedForReview[q.qid] && <div className="absolute -top-1.5 -right-1.5"><Bookmark className="w-4 h-4 fill-red-600 text-red-600" /></div>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selection Highlighter Popup Menu */}
      {highlightCoords && (
        <div
          className="fixed z-[100] bg-[#1a1a1a] text-white px-3 py-1.5 rounded-full shadow-2xl border border-gray-700 flex items-center gap-2 -translate-x-1/2 animate-in fade-in zoom-in-95 duration-150 select-none"
          style={{ top: `${Math.max(10, highlightCoords.top)}px`, left: `${highlightCoords.left}px` }}
        >
          <span className="text-[11px] font-bold text-gray-300 mr-1">Highlight:</span>
          <button
            onClick={() => applyHighlight('yellow')}
            className="w-5 h-5 rounded-full bg-yellow-300 hover:scale-125 transition border border-yellow-500 shadow-sm"
            title="Yellow Highlight"
          />
          <button
            onClick={() => applyHighlight('green')}
            className="w-5 h-5 rounded-full bg-green-300 hover:scale-125 transition border border-green-500 shadow-sm"
            title="Green Highlight"
          />
          <button
            onClick={() => applyHighlight('pink')}
            className="w-5 h-5 rounded-full bg-pink-300 hover:scale-125 transition border border-pink-500 shadow-sm"
            title="Pink Highlight"
          />
          <button
            onClick={() => applyHighlight('blue')}
            className="w-5 h-5 rounded-full bg-blue-300 hover:scale-125 transition border border-blue-500 shadow-sm"
            title="Blue Highlight"
          />
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

      {/* Explanation Modal */}
      {showExplanationModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 font-sans">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 sm:p-10 rounded-2xl shadow-2xl max-w-3xl w-full border border-gray-200 dark:border-gray-800 text-left max-h-[85vh] overflow-y-auto relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowExplanationModal(false)} className="absolute top-6 right-6 p-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 rounded-full transition"><X className="w-5 h-5 text-gray-500 dark:text-gray-400" /></button>
            <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-6 pr-8 flex items-center gap-3">
              Official Explanation
              {currentQ.difficulty && (
                <span className="text-xs font-bold px-2.5 py-1 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 rounded-md border border-gray-200 dark:border-white/10 tracking-wider uppercase">
                  Difficulty: {currentQ.difficulty}
                </span>
              )}
            </h3>

            {currentQ.correct_answer && (
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                <span className="font-bold text-green-700 dark:text-green-400 block mb-1 tracking-wide uppercase text-xs">Correct Answer:</span>
                <span className="text-green-800 dark:text-green-300 font-serif text-xl">{currentQ.correct_answer}</span>
              </div>
            )}

            {currentQ.correct_answer_explanation ? (
              <div className="prose prose-lg max-w-none prose-p:leading-relaxed selection:bg-purple-500/40 text-black dark:text-gray-200">
                <RichText content={currentQ.correct_answer_explanation} />
              </div>
            ) : (
              <div className="text-gray-500 italic">No explanation provided for this question.</div>
            )}
          </div>
        </div>
      )}

      {/* Exit/Finish Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 font-sans">
          <div className="bg-[#1a1a1a] p-10 rounded-2xl shadow-2xl max-w-md w-full border border-gray-700 animate-in zoom-in duration-300 text-left">
            <h3 className="text-2xl font-black text-white mb-2">Ready to leave?</h3>
            <p className="text-gray-400 mb-2 text-sm leading-relaxed">
              You have answered <strong className="text-white">{Object.keys(answers).length}</strong> out of <strong className="text-white">{questions.length}</strong> practice questions. What would you like to do?
            </p>
            <div className="flex flex-col gap-3 mt-8">
              <button
                onClick={handleReviewAnswers}
                className="w-full py-3.5 bg-green-600 text-white rounded-lg font-bold text-sm tracking-wide hover:bg-green-700 transition-all active:scale-[0.98]"
              >
                Review Answers
              </button>
              <button
                onClick={handleEndPractice}
                disabled={isEnding}
                className="w-full py-3.5 bg-red-600 text-white rounded-lg font-bold text-sm tracking-wide hover:bg-red-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isEnding && <Loader2 className="w-5 h-5 animate-spin" />}
                End Practice
              </button>
              <button
                onClick={() => setShowExitModal(false)}
                className="w-full py-3.5 bg-white dark:bg-[#2a2a2a] text-black dark:text-white rounded-lg font-bold text-sm tracking-wide hover:bg-gray-200 dark:hover:bg-[#333] transition-all active:scale-[0.98]"
              >
                Back to Practice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time's Up Modal */}
      {showTimeUpModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 font-sans">
          <div className="bg-[#1a1a1a] p-10 rounded-2xl shadow-2xl max-w-md w-full border border-gray-700 animate-in zoom-in duration-300 text-left flex flex-col items-center text-center">
            <Clock className="w-16 h-16 text-yellow-500 mb-4" />
            <h3 className="text-2xl font-black text-white mb-2">Time's Up!</h3>
            <p className="text-gray-400 mb-8 text-sm leading-relaxed">
              Your allotted time for this practice session has expired. Do you want to continue practicing or end the session now?
            </p>
            <div className="flex w-full gap-4">
              <button
                onClick={() => {
                  setShowTimeUpModal(false)
                  setHasContinuedPastTime(true)
                }}
                className="flex-1 py-3.5 bg-white dark:bg-[#2a2a2a] text-black dark:text-white rounded-lg font-bold text-sm tracking-wide hover:bg-gray-200 dark:hover:bg-[#333] transition-all active:scale-[0.98]"
              >
                Continue
              </button>
              <button
                onClick={() => {
                  setShowTimeUpModal(false)
                  handleEndPractice()
                }}
                className="flex-1 py-3.5 bg-blue-600 text-white rounded-lg font-bold text-sm tracking-wide hover:bg-blue-500 transition-all active:scale-[0.98]"
              >
                End Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Bug Modal */}
      <ReportBugModal
        isOpen={!!reportingQid}
        onClose={() => setReportingQid(null)}
        questionId={reportingQid}
      />
    </div>
  )
}
