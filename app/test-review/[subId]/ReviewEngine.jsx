'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import RichText, { stripOptionLetter } from '@/components/RichText'
import DesmosCalculator from '@/components/DesmosCalculator'
import ReportBugModal from '@/components/ReportBugModal'
import { getQuestionByIdAction } from '@/app/actions/testActions'
import { Bookmark, ChevronUp, X, Loader2, Calculator, CheckCircle, Flag } from 'lucide-react'

const renderAnswerPreview = (val) => {
  if (!val) return null;
  if (typeof val === 'string' && val.includes('/')) {
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

export default function ReviewEngine({ testSub, practiceTest, questionMeta, studentAnswers }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionCache, setQuestionCache] = useState({});
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    const qid = questionMeta[currentIndex]?.qid;
    if (!qid || questionCache[qid]) return;

    let isMounted = true;
    const fetchQ = async () => {
      setLoadingQuestion(true);
      setFetchError(null);
      try {
        const res = await getQuestionByIdAction(qid);
        if (isMounted) {
          if (res?.error) {
            setFetchError(res.error);
          } else if (res?.data) {
            setQuestionCache(prev => ({ ...prev, [qid]: res.data }));
          } else {
            setFetchError("No data received from server.");
          }
        }
      } catch (err) {
        if (isMounted) setFetchError(err.message || "Network error");
      } finally {
        if (isMounted) setLoadingQuestion(false);
      }
    };
    fetchQ();
    return () => { isMounted = false };
  }, [currentIndex, questionMeta, questionCache]);

  const [showQuestionMenu, setShowQuestionMenu] = useState(false);
  const [leftWidth, setLeftWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [reportingQid, setReportingQid] = useState(null);
  const router = useRouter();

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

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const newWidth = (e.clientX / window.innerWidth) * 100;
        setLeftWidth(Math.max(20, Math.min(80, newWidth)));
      }
    };
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!questionMeta || questionMeta.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 flex-col">
        <div className="w-12 h-12 flex items-center justify-center bg-red-100 rounded-full mb-4">
          <span className="text-red-600 font-bold text-xl">!</span>
        </div>
        <div className="text-gray-500 font-bold uppercase tracking-widest text-sm">No Questions Found</div>
        <div className="text-gray-400 text-xs mt-2">This submission may be corrupted or missing module data.</div>
      </div>
    )
  }

  const groupedQuestions = [];
  let currentGroup = null;
  questionMeta.forEach((q, idx) => {
    if (!currentGroup || currentGroup.module_id !== q.module_id) {
      currentGroup = {
        module_id: q.module_id,
        module_name: q.module_name || 'Module',
        questions: []
      };
      groupedQuestions.push(currentGroup);
    }
    currentGroup.questions.push({ ...q, absoluteIndex: idx, localIndex: currentGroup.questions.length });
  });

  const currentQMeta = questionMeta[currentIndex];
  let localIndex = 0;
  let currentModuleLength = 0;
  if (currentQMeta) {
    const activeGroup = groupedQuestions.find(g => g.module_id === currentQMeta.module_id);
    if (activeGroup) {
      currentModuleLength = activeGroup.questions.length;
      const localQ = activeGroup.questions.find(q => q.absoluteIndex === currentIndex);
      if (localQ) localIndex = localQ.localIndex;
    }
  }

  const currentQ = questionCache[currentQMeta?.qid];
  if (loadingQuestion || !currentQ || fetchError) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 flex-col">
        {!fetchError ? <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" /> : <div className="w-12 h-12 flex items-center justify-center bg-red-100 rounded-full mb-4"><span className="text-red-600 font-bold text-xl">!</span></div>}
        <div className="text-gray-500 font-bold uppercase tracking-widest text-sm">{fetchError ? "Failed to Load" : "Loading Question..."}</div>
        {fetchError && (
          <div className="text-red-500 text-xs mt-3 font-bold bg-red-50 px-4 py-2 rounded border border-red-200">
            Error: {fetchError}
          </div>
        )}
      </div>
    )
  }

  const isMath = currentQ.subject_tag === 'Math' || (currentQ.subject && currentQ.subject.toUpperCase() === 'MATH') || (currentQMeta?.module_name || '').toUpperCase().includes('MATH')
  const isSPR = !currentQ.question_type || currentQ.question_type.toUpperCase() !== 'MCQ'
  const isMathSPR = isMath && isSPR
  const hasLeftSide = (!isMath && !!(currentQ.context || currentQ.image_url)) || isMathSPR

  let isCurrentQCorrect = false;
  let isCurrentQUnanswered = true;
  if (currentQ) {
    if (!currentQ.question_type || currentQ.question_type.toUpperCase() === 'MCQ') {
      isCurrentQCorrect = studentAnswers[currentQ.qid] === currentQ.correct_answer;
      isCurrentQUnanswered = !studentAnswers[currentQ.qid];
    } else {
      isCurrentQCorrect = studentAnswers[currentQ.qid] && checkMultipleSprs(studentAnswers[currentQ.qid], currentQ.correct_answer);
      isCurrentQUnanswered = !studentAnswers[currentQ.qid];
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-900 overflow-hidden font-serif">
      <header className="flex items-center justify-between px-6 sm:px-8 py-3 border-b border-black bg-[#1a1a1a] text-white z-10 select-none font-serif">
        <div className="flex-1 font-bold text-base sm:text-lg text-white tracking-wide flex items-center gap-3">
          <span>{practiceTest?.test_name || 'Submission Review'} <span className="text-gray-400 mx-1">•</span> Review Mode</span>
        </div>
        <div className="flex-1 flex justify-center items-center">
          <div className="font-serif font-bold text-lg sm:text-xl tracking-[0.2em] text-white">
            REVIEW
          </div>
        </div>
        <div className="flex-1 flex justify-end items-center gap-3 font-sans">
          <button onClick={() => router.push('/dashboard/history')} className="px-4 py-1.5 sm:px-5 sm:py-2 bg-[#d32f2f] hover:bg-[#b71c1c] border border-[#b71c1c]/60 rounded-[4px] font-bold text-white transition text-xs sm:text-sm tracking-wide shadow-sm">
            Return to History
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden bg-white relative">
        <DesmosCalculator isOpen={showCalculator && isMath} onClose={() => setShowCalculator(false)} />
        {hasLeftSide && !showCalculator && (
          <div className="h-full overflow-y-auto bg-white p-10 shrink-0 border-r border-gray-200" style={{ width: `${leftWidth}%` }}>
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
              </div>
            ) : (
              <div className="max-w-none text-[#1a1a1a] leading-relaxed font-normal" style={{ fontSize: '16.5px', lineHeight: '1.65' }}>
                {currentQ.image_url && <div className="mb-8 flex justify-center"><img src={currentQ.image_url} className="max-w-full h-auto object-contain max-h-[60vh] rounded border border-gray-200 shadow-sm" /></div>}
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

        <div className={`h-full overflow-y-auto bg-white flex flex-col relative min-w-0 ${!hasLeftSide && !showCalculator ? 'w-1/2 mx-auto' : 'flex-1'}`}>
          <div className="bg-[#ebebeb] pt-3 pb-2.5 px-6 border-b-2 border-dashed border-black sticky top-0 z-10 font-sans select-none flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-black text-white px-2.5 py-1 font-bold text-sm sm:text-base rounded-sm shadow-sm">{localIndex + 1}</div>
              {currentQ && (
                <div className={`px-2.5 py-1 sm:px-3 sm:py-1 rounded-sm text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white shadow-sm ${isCurrentQUnanswered ? 'bg-gray-500' : (isCurrentQCorrect ? 'bg-[#188038]' : 'bg-[#d32f2f]')}`}>
                  {isCurrentQUnanswered ? 'Skipped' : (isCurrentQCorrect ? 'Correct' : 'Wrong')}
                </div>
              )}
            </div>
          </div>

          <div className="px-6 sm:px-8 pt-3.5 sm:pt-4 pb-10 flex-1 max-w-4xl mx-auto w-full">
            {isMath && (currentQ.image_url || currentQ.context) && (
              <div className="mb-3 sm:mb-4 text-gray-900 font-normal leading-relaxed text-sm sm:text-base">
                {currentQ.image_url && <div className="mb-3.5 flex justify-center"><img src={currentQ.image_url} className="max-w-full h-auto object-contain max-h-[45vh] rounded border border-gray-300 shadow-sm" /></div>}
                {currentQ.context && <RichText content={currentQ.context} />}
              </div>
            )}

            <div className="max-w-none text-gray-900 font-medium mb-3.5 sm:mb-4 leading-relaxed text-sm sm:text-base">
              <RichText content={currentQ.question} />
            </div>

            <div className="space-y-2 sm:space-y-2.5 w-full">
              {(!currentQ.question_type || currentQ.question_type.toUpperCase() === 'MCQ') ? (
                ['A', 'B', 'C', 'D'].map(letter => {
                  const optText = currentQ[`option_${letter.toLowerCase()}`]
                  if (!optText) return null
                  const isStudentAns = studentAnswers[currentQ.qid] === letter
                  const isCorrectAns = currentQ.correct_answer === letter
                  const cleanOpt = stripOptionLetter(optText)

                  let bgClass = 'border border-gray-300 bg-white'
                  let circleClass = 'border-black/30 text-black/60 font-medium'
                  let badge = null

                  if (isCorrectAns && isStudentAns) {
                    bgClass = 'border-2 border-green-500 bg-green-50 shadow-sm'
                    circleClass = 'bg-green-500 border-green-500 text-white'
                    badge = <span className="text-green-600 text-[10px] sm:text-xs font-bold ml-auto bg-green-100 px-2 py-0.5 sm:py-1 rounded">✓ Your Answer (Correct)</span>
                  } else if (isCorrectAns && !isStudentAns) {
                    bgClass = 'border-2 border-green-500 bg-green-50 shadow-sm'
                    circleClass = 'bg-green-500 border-green-500 text-white'
                    badge = <span className="text-green-600 text-[10px] sm:text-xs font-bold ml-auto bg-green-100 px-2 py-0.5 sm:py-1 rounded">✓ Correct Answer</span>
                  } else if (isStudentAns && !isCorrectAns) {
                    bgClass = 'border-2 border-red-500 bg-red-50 shadow-sm'
                    circleClass = 'bg-red-500 border-red-500 text-white'
                    badge = <span className="text-red-600 text-[10px] sm:text-xs font-bold ml-auto bg-red-100 px-2 py-0.5 sm:py-1 rounded">✗ Your Answer</span>
                  }

                  return (
                    <div key={letter} className="relative flex items-center gap-2.5 w-full">
                      <div className={`flex-1 text-left px-3.5 py-2 sm:py-2 rounded-xl flex items-center relative transition-all duration-150 ${bgClass}`}>
                        <div className={`w-6 h-6 sm:w-6.5 sm:h-6.5 shrink-0 flex items-center justify-center rounded-full border-2 mr-2.5 font-sans font-bold text-xs transition-colors ${circleClass}`}>{letter}</div>
                        <div className="flex-1 text-gray-900 font-medium text-sm sm:text-base leading-snug"><RichText content={cleanOpt} /></div>
                        {badge && <div className="ml-2 shrink-0">{badge}</div>}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="mt-6 border-t border-gray-300 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">Your Answer</div>
                      <div className={`p-4 rounded-xl border-2 font-mono text-xl ${studentAnswers[currentQ.qid] && checkMultipleSprs(studentAnswers[currentQ.qid], currentQ.correct_answer) ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700'}`}>
                        {studentAnswers[currentQ.qid] || <span className="text-red-400 italic">Not Answered</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">Correct Answer</div>
                      <div className="p-4 rounded-xl border-2 border-green-500 bg-green-50 text-green-700 font-mono text-xl">
                        {currentQ.correct_answer}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => setReportingQid(currentQ.qid)}
                className="mt-6 flex items-center gap-2 text-xs sm:text-sm font-bold text-gray-500 hover:text-[#d32f2f] transition-colors"
              >
                <Flag className="w-4 h-4" /> Report an issue with this question
              </button>

              {currentQ.correct_answer_explanation && (
                <div className="mt-6 bg-[#f8f9fa] border-l-4 border-[#0077c8] p-5 rounded-r-xl shadow-sm">
                  <h4 className="font-sans font-bold text-[#0077c8] uppercase tracking-wider text-xs mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Official Explanation
                  </h4>
                  <div className="text-gray-800 text-sm sm:text-base leading-relaxed">
                    <RichText content={currentQ.correct_answer_explanation} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="px-6 sm:px-8 py-3 sm:py-3.5 bg-[#1c1c1c] border-t border-black flex items-center justify-between z-10 font-sans select-none">
        <div className="flex-1 flex items-center">
          <img src="/logo.png" alt="Prepnova Logo" className="h-8 sm:h-9 w-auto object-contain" />
        </div>
        <div className="flex-1 flex justify-center">
          <button onClick={() => setShowQuestionMenu(true)} className="px-6 py-2 sm:px-8 sm:py-2.5 bg-[#cfcfcf] hover:bg-[#bebebe] text-black rounded-full font-bold text-sm sm:text-base tracking-wide flex items-center gap-2.5 transition shadow-sm">
            <span>Question {localIndex + 1} of {currentModuleLength}</span>
            <ChevronUp className="w-4 h-4 text-black stroke-[2.5]" />
          </button>
        </div>
        <div className="flex-1 flex gap-3 sm:gap-3.5 justify-end">
          <button disabled={currentIndex === 0} onClick={() => setCurrentIndex(p => p - 1)} className="px-6 py-2 sm:px-7 sm:py-2.5 bg-[#cfcfcf] hover:bg-[#bebebe] text-black rounded-full font-bold text-sm sm:text-base tracking-wide transition shadow-sm disabled:opacity-30 disabled:pointer-events-none">Back</button>
          <button disabled={currentIndex === questionMeta.length - 1} onClick={() => setCurrentIndex(p => p + 1)} className="px-6 py-2 sm:px-7 sm:py-2.5 bg-[#cfcfcf] hover:bg-[#bebebe] text-black rounded-full font-bold text-sm sm:text-base tracking-wide transition shadow-sm disabled:opacity-30 disabled:pointer-events-none">Next</button>
        </div>
      </footer>

      {showQuestionMenu && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] w-full max-w-4xl rounded-t-3xl p-8 shadow-2xl font-sans">
            <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
              <h3 className="text-xl font-bold text-white">Section Review</h3>
              <button onClick={() => setShowQuestionMenu(false)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-6 h-6 text-gray-400" /></button>
            </div>
            <div className="space-y-8 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
              {groupedQuestions.map((group, gIdx) => (
                <div key={gIdx} className="mb-6">
                  <h4 className="text-white/90 font-bold mb-4 tracking-wide border-b border-gray-700/50 pb-2 inline-block">
                    {group.module_name}
                  </h4>
                  <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
                    {group.questions.map((q) => {
                      let isCorrect = false;
                      let isUnanswered = false;
                      if (!q.question_type || q.question_type.toUpperCase() === 'MCQ') {
                        isCorrect = studentAnswers[q.qid] === q.correct_answer;
                        isUnanswered = !studentAnswers[q.qid];
                      } else {
                        isCorrect = studentAnswers[q.qid] && checkMultipleSprs(studentAnswers[q.qid], q.correct_answer);
                        isUnanswered = !studentAnswers[q.qid];
                      }
                      const isCurrent = currentIndex === q.absoluteIndex;
                      const borderColor = isCurrent ? 'border-white border-4 scale-110 shadow-lg' : 'border-black/50 border-2';
                      const bgColor = isUnanswered ? 'bg-gray-500 opacity-70' : (isCorrect ? 'bg-[#188038]' : 'bg-[#d32f2f]');

                      return (
                        <button
                          key={q.qid} onClick={() => { setCurrentIndex(q.absoluteIndex); setShowQuestionMenu(false) }}
                          className={`h-12 sm:h-14 rounded-lg flex flex-col items-center justify-center font-bold relative ${borderColor} ${bgColor} text-white hover:opacity-100 transition`}
                        >
                          <span className="text-lg sm:text-xl">{q.localIndex + 1}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ReportBugModal
        isOpen={!!reportingQid}
        onClose={() => setReportingQid(null)}
        questionId={reportingQid}
        moduleId={currentQMeta?.module_id}
        testId={practiceTest?.id || 'submission-review'}
        questionIndex={localIndex + 1}
        contextRoute={`/test-review/${testSub?.id}`}
      />
    </div>
  )
}