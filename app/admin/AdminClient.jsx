'use client'

import { useState, useEffect, useRef } from 'react'
import { createContentClient as createClient, createClient as createUserClient } from '@/utils/supabase/client'
import { Upload, Plus, Edit2, Search, Link as LinkIcon, Trash2, RefreshCw, X, Maximize2, GripHorizontal, Download, ArrowLeft, FolderTree, FlaskConical, LayoutGrid, ChevronDown, ChevronRight, Folder, FileText, FileCheck } from 'lucide-react'
import RichText, { stripOptionLetter } from '@/components/RichText'
import { forceChangePassword, getUserActivity, getUserDetails, getLightweightUsers, updateUserPlan, updateUserLevelsAction, deleteQuestionsAction, deleteUserAction } from '@/app/actions/adminUserActions'
import { processBulkUploadAction, checkDuplicatesAction, deleteQuestionAction, checkExistingQidsAction, calculateImageHashesAction, calculateImageHashesFromUrlsAction, uploadQuestionImageAction, fetchQuestionByQidAction } from '@/app/actions/bulkActions'
import { bulkToggleQuestionsToModuleAction, toggleSingleQuestionAction, clearAllModuleQuestionsAction, fetchAdminQuestionsAction, fetchAdminModulesAction } from '@/app/actions/moduleAssignmentActions'

export const generateHash = async (message) => {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const getHashPrefix = (q, isRestructured = false) => {
  const type = (q.question_type || 'MCQ').toUpperCase();
  const rest = isRestructured ? 'REST_' : '';
  return `${rest}${type}_`;
};

export const getQuestionHashString = (q, imageHashes = {}, isRestructured = false) => {
  const qType = q.question_type ? q.question_type.toUpperCase() : 'MCQ';
  
  if (qType === 'SPR') {
    const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
    const simplifyFraction = (str) => {
      if (!str.includes('/')) return str;
      const parts = str.split('/');
      if (parts.length === 2) {
        const num = parseInt(parts[0].trim(), 10);
        const den = parseInt(parts[1].trim(), 10);
        if (!isNaN(num) && !isNaN(den) && den !== 0) {
          const common = gcd(num, den);
          return `${num / common}/${den / common}`;
        }
      }
      return str;
    };

    let answers = String(q.correct_answer || '').split('||').map(s => simplifyFraction(s.trim()));
    answers.sort((a, b) => a.localeCompare(b));
    const sortedAnswersStr = answers.join('||');
    
    if (isRestructured) {
      return `${q.question || ''}|${sortedAnswersStr}`;
    }
    return sortedAnswersStr;
  } else {
    // MCQ
    const getProcessedOpt = (opt) => {
       if (!opt) return '';
       const cleanOpt = String(opt).trim();
       if (cleanOpt.includes('||')) {
          const parts = cleanOpt.split('||').map(p => p.trim());
          if (parts.length > 1 && imageHashes[parts[1]]) {
             return `${parts[0]} || ${imageHashes[parts[1]]}`;
          }
       } else if (imageHashes[cleanOpt]) {
          return `|| ${imageHashes[cleanOpt]}`;
       }
       return cleanOpt;
    };

    const opts = [
      getProcessedOpt(q.option_a || q.option_A),
      getProcessedOpt(q.option_b || q.option_B),
      getProcessedOpt(q.option_c || q.option_C),
      getProcessedOpt(q.option_d || q.option_D)
    ];
    
    const sortedOptions = opts.map(o => o.toLowerCase()).sort().join('|');

    const correctLetter = (q.correct_answer || '').trim().toUpperCase();
    let correctAnswerText = '';
    if (correctLetter === 'A') correctAnswerText = getProcessedOpt(q.option_a || q.option_A);
    else if (correctLetter === 'B') correctAnswerText = getProcessedOpt(q.option_b || q.option_B);
    else if (correctLetter === 'C') correctAnswerText = getProcessedOpt(q.option_c || q.option_C);
    else if (correctLetter === 'D') correctAnswerText = getProcessedOpt(q.option_d || q.option_D);
    
    correctAnswerText = correctAnswerText.toLowerCase();

    const baseMCQString = `${sortedOptions}|${correctAnswerText}`;

    if (isRestructured) {
      return `${baseMCQString}|${q.context || ''}|${q.question || ''}`;
    }
    return baseMCQString;
  }
};

export const getSprAnswerHashes = async (q, isRestructured = false) => {
  const qType = q.question_type ? q.question_type.toUpperCase() : 'MCQ';
  if (qType !== 'SPR' || isRestructured) return [];
  
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const simplifyFraction = (str) => {
    if (!str.includes('/')) return str;
    const parts = str.split('/');
    if (parts.length === 2) {
      const num = parseInt(parts[0].trim(), 10);
      const den = parseInt(parts[1].trim(), 10);
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        const common = gcd(num, den);
        return `${num / common}/${den / common}`;
      }
    }
    return str;
  };

  let answers = String(q.correct_answer || '').split('||').map(s => simplifyFraction(s.trim())).filter(Boolean);
  const uniqueAnswers = Array.from(new Set(answers));
  const prefix = getHashPrefix(q, false);
  
  const hashes = [];
  for (const ans of uniqueAnswers) {
    if (ans) {
      hashes.push(prefix + (await generateHash(ans)));
    }
  }
  return hashes;
};

export function QuestionPreviewModal({ question, onClose }) {
  if (!question) return null;
  const hasLeftSide = !!(question.context || question.image_url);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto p-4 sm:p-8 flex flex-col justify-center items-center backdrop-blur-sm">
      <div className="flex flex-col w-full max-w-5xl bg-[#aaaaaa] text-gray-900 overflow-hidden font-sans border border-gray-400 rounded-lg shadow-2xl" style={{ height: '80vh' }}>
        <header className="flex justify-between items-center px-8 py-3 border-b border-gray-300 bg-[#162444] text-white z-10 relative shadow-sm shrink-0">
          <div className="flex-1 font-bold text-lg text-white">
            Question Preview
          </div>
          <div className="flex flex-col items-center flex-1">
            <div className="text-xl font-black tracking-widest text-white">
              {question.qid}
            </div>
          </div>
          <div className="flex-1 flex justify-end">
            <button onClick={onClose} className="px-6 py-1.5 bg-[#747474] border border-gray-400 rounded-full font-bold hover:bg-red-600 hover:border-red-600 transition text-sm text-white shadow-sm flex items-center gap-2">
              <X className="w-4 h-4" /> Close
            </button>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden relative bg-white">
          {hasLeftSide ? (
            <>
              <div className="w-1/2 h-full overflow-y-auto bg-white p-10 lg:p-14 border-r border-gray-300">
                <div className="prose prose-2xl max-w-none text-black leading-relaxed font-medium">
                  {question.image_url && (
                    <div className="mb-8 flex justify-center w-full">
                      <img src={question.image_url} alt="Reference figure" className="max-w-full h-auto object-contain rounded-lg shadow-sm border border-gray-300" style={{ maxHeight: '60vh' }} />
                    </div>
                  )}
                  {question.context && <RichText content={question.context} />}
                </div>
              </div>
              <div className="w-4 bg-gray-300 flex flex-col justify-center items-center z-10 border-l border-r border-gray-200 flex-shrink-0">
                <div className="w-1 h-12 bg-gray-500 rounded-full"></div>
              </div>
              <div className="w-1/2 h-full overflow-y-auto bg-white p-10 lg:p-14 flex flex-col relative">
                <div className="prose prose-2xl max-w-none text-black font-medium mb-10 leading-relaxed">
                  <RichText content={question.question} />
                </div>
                <div className="space-y-3 w-full">
                  {['a', 'b', 'c', 'd'].map((letter) => {
                    const opt = question[`option_${letter}`] || question[`option_${letter.toUpperCase()}`]
                    if (!opt) return null
                    const cleanOpt = stripOptionLetter(opt)
                    return (
                      <div key={letter} className="relative flex items-center gap-4 w-full group">
                        <div className="flex-1 text-left pr-12 pl-4 py-2 rounded-lg border-2 transition-all flex items-center text-2xl font-medium border-gray-400 bg-white shadow-sm">
                          <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full border-2 mr-4 font-bold border-gray-500 text-gray-700 uppercase">
                            {letter}
                          </div>
                          <div className="flex-1 text-black prose prose-xl max-w-none [&_p]:mb-0">
                            <RichText content={cleanOpt} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full overflow-y-auto bg-white p-10 lg:p-14 flex flex-col relative max-w-5xl mx-auto">
              <div className="prose prose-2xl max-w-none text-black font-medium mb-10 leading-relaxed">
                <RichText content={question.question} />
              </div>
              <div className="space-y-3 w-full">
                {['a', 'b', 'c', 'd'].map((letter) => {
                  const opt = question[`option_${letter}`] || question[`option_${letter.toUpperCase()}`]
                  if (!opt) return null
                  const cleanOpt = stripOptionLetter(opt)
                  return (
                    <div key={letter} className="relative flex items-center gap-4 w-full group">
                      <div className="flex-1 text-left pr-12 pl-4 py-2 rounded-lg border-2 transition-all flex items-center text-2xl font-medium border-gray-400 bg-white shadow-sm">
                        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full border-2 mr-4 font-bold border-gray-500 text-gray-700 uppercase">
                          {letter}
                        </div>
                        <div className="flex-1 text-black prose prose-xl max-w-none [&_p]:mb-0">
                          <RichText content={cleanOpt} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function AdminClient({ initialQuestions, initialModules, initialUsers }) {
  const [activeTab, setActiveTab] = useState('users')
  const [questions, setQuestions] = useState(initialQuestions)
  const [modules, setModules] = useState(initialModules)
  const supabase = createClient()

  const fetchData = async () => {
    const qRes = await fetchAdminQuestionsAction()
    const mRes = await fetchAdminModulesAction()
    if (qRes.success && qRes.data.length > 0) setQuestions(qRes.data)
    if (mRes.success) setModules(mRes.data)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[800px] flex flex-col">
      <div className="flex border-b border-gray-200 overflow-x-auto">
        <button onClick={() => setActiveTab('users')} className={`whitespace-nowrap px-6 py-4 font-medium text-sm ${activeTab === 'users' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>User Management</button>
        <button onClick={() => setActiveTab('bank')} className={`whitespace-nowrap px-6 py-4 font-medium text-sm ${activeTab === 'bank' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>Question Bank</button>
        <button onClick={() => setActiveTab('modules')} className={`whitespace-nowrap px-6 py-4 font-medium text-sm ${activeTab === 'modules' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>Module Builder</button>
        <button onClick={() => setActiveTab('upload')} className={`whitespace-nowrap px-6 py-4 font-medium text-sm ${activeTab === 'upload' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>Bulk Uploader</button>
      </div>
      <div className="p-6 flex-1 bg-gray-50/50">
        {activeTab === 'users' && <UserManagement initialUsers={initialUsers} />}
        {activeTab === 'bank' && <QuestionBank questions={questions} modules={modules} onUpdate={fetchData} supabase={supabase} />}
        {activeTab === 'modules' && <ModuleBuilder modules={modules} questions={questions} onUpdate={fetchData} supabase={supabase} />}
        {activeTab === 'upload' && <BulkUploader onUploadComplete={fetchData} supabase={supabase} />}
      </div>
    </div>
  )
}

export function QuestionBank({ questions, modules, onUpdate, supabase }) {
  const [filter, setFilter] = useState({ search: '', subject: '', difficulty: '', topic: '', assignment: 'All', sort: 'Newest', hasImage: 'All', source: '', questionType: '' })
  const [selectedQuestion, setSelectedQuestion] = useState(null)
  const [selectedQuestions, setSelectedQuestions] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    setCurrentPage(1)
  }, [filter, itemsPerPage])

  // Safety Rule 2: Clear selected questions when any filter changes
  useEffect(() => {
    setSelectedQuestions([])
  }, [filter.search, filter.subject, filter.difficulty, filter.topic, filter.assignment, filter.hasImage, filter.source, filter.questionType])

  const uniqueTopics = [...new Set(questions.map(q => q.topic_tag).filter(Boolean))]
  const uniqueSources = [...new Set(questions.map(q => q.question_source).filter(Boolean))]

  const filtered = questions.filter(q => {
    if (filter.search) {
      const lowerSearch = filter.search.toLowerCase()
      const matchesQid = q.qid?.toLowerCase().startsWith(lowerSearch)
      const matchesContext = q.context?.toLowerCase().includes(lowerSearch) || q.question?.toLowerCase().includes(lowerSearch)
      if (!matchesQid && !matchesContext) return false
    }

    if (filter.subject && q.subject_tag !== filter.subject) return false
    if (filter.difficulty && q.difficulty !== filter.difficulty) return false
    if (filter.topic && q.topic_tag !== filter.topic) return false
    if (filter.source && q.question_source !== filter.source) return false
    if (filter.questionType && (q.question_type || 'MCQ').toUpperCase() !== filter.questionType) return false

    if (filter.hasImage === 'Yes' && !q.image_url) return false
    if (filter.hasImage === 'No' && q.image_url) return false

    const isAssigned = q.assigned_modules && q.assigned_modules.length > 0
    if (filter.assignment === 'Assigned' && !isAssigned) return false
    if (filter.assignment === 'Unassigned' && isAssigned) return false

    return true
  }).sort((a, b) => {
    if (filter.sort === 'Least Assigned') {
      const countA = a.assigned_modules?.length || 0;
      const countB = b.assigned_modules?.length || 0;
      return countA - countB;
    }
    if (filter.sort === 'Oldest') {
      return new Date(a.created_at) - new Date(b.created_at);
    }
    return 0; // Default order (Newest) from the DB fetch
  })

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginatedQuestions = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleSave = async (updatedQ) => {
    // 1. Gather all image URLs to fetch pixel hashes
    const imageUrls = [];
    if (updatedQ.image_url) imageUrls.push(updatedQ.image_url);
    ['a', 'b', 'c', 'd'].forEach(l => {
       const opt = updatedQ[`option_${l}`] || updatedQ[`option_${l.toUpperCase()}`];
       if (opt && String(opt).includes('||')) {
          imageUrls.push(String(opt).split('||')[1].trim());
       } else if (opt && String(opt).match(/\.(png|jpg|jpeg|svg)(\?.*)?$/i) && !String(opt).includes(' ')) {
          imageUrls.push(String(opt).trim());
       }
    });
    
    // 2. Fetch the pixel hashes for these URLs from the server
    let imageHashes = {};
    if (imageUrls.length > 0) {
       const res = await calculateImageHashesFromUrlsAction(imageUrls);
       if (!res.error) imageHashes = res.imageHashes;
    }
    
    // 3. Generate Basic Hash
    const basicFingerprint = getQuestionHashString(updatedQ, imageHashes, false);
    const basicPrefix = getHashPrefix(updatedQ, false);
    let newBasicHash = null;
    if (basicFingerprint !== '|||' && basicFingerprint !== '|') {
      newBasicHash = basicPrefix + (await generateHash(basicFingerprint));
    }
    updatedQ.options_hash = newBasicHash;
    updatedQ.all_options_hashes = [newBasicHash].filter(Boolean);
    if ((updatedQ.question_type ? updatedQ.question_type.toUpperCase() : 'MCQ') === 'SPR' && !updatedQ.is_restructured_hash) {
      const sprHashes = await getSprAnswerHashes(updatedQ, false);
      if (sprHashes.length > 0) {
        updatedQ.all_options_hashes = sprHashes;
        updatedQ.options_hash = sprHashes[0];
      }
    }

    // 4. Generate Restructured Hash if applicable
    let newRestHash = null;
    if (updatedQ.is_restructured_hash) {
      const restFingerprint = getQuestionHashString(updatedQ, imageHashes, true);
      const restPrefix = getHashPrefix(updatedQ, true);
      if (restFingerprint !== '|||' && restFingerprint !== '|') {
        newRestHash = restPrefix + (await generateHash(restFingerprint));
      }
    }
    updatedQ.restructured_hash = newRestHash;
    if (updatedQ.image_url && imageHashes[updatedQ.image_url]) {
       updatedQ.image_hash = basicPrefix + imageHashes[updatedQ.image_url];
    } else if (!updatedQ.image_url) {
       updatedQ.image_hash = null; 
    }

    // Check DB for duplicates
    if (newBasicHash || newRestHash || updatedQ.image_hash) {
      // Create a payload similar to bulk upload for checking
      const payloadToCheck = [{
        qid: updatedQ.qid,
        options_hash: updatedQ.options_hash,
        all_options_hashes: updatedQ.all_options_hashes,
        restructured_hash: updatedQ.restructured_hash,
        image_hash: updatedQ.image_hash,
        subject_tag: updatedQ.subject_tag,
        topic_tag: updatedQ.topic_tag,
        question_type: updatedQ.question_type,
        is_restructured_hash: updatedQ.is_restructured_hash || false
      }];
      
      const dbCheck = await checkDuplicatesAction(payloadToCheck);
      
      if (dbCheck.error) {
        alert("Error checking duplicates: " + dbCheck.error);
        return;
      }

      if (dbCheck && dbCheck.duplicates && dbCheck.duplicates.length > 0) {
        alert(`[ERROR] Edit failed: These options or images exactly match an existing question (QID: ${dbCheck.duplicates[0].dbQid}).`);
        return;
      }
    }

    const { error } = await supabase.from('questions').update(updatedQ).eq('qid', updatedQ.qid)
    if (!error) {
      onUpdate()
      setSelectedQuestion(null)
    } else {
      alert("Error saving: " + error.message)
    }
  }

  const handleDeleteSingle = async (qId) => {
    if (window.confirm(`Are you sure you want to delete question ${qId}?`)) {
      setIsDeleting(true)
      const res = await deleteQuestionsAction([qId])
      if (res.success) {
        onUpdate()
        setSelectedQuestion(null)
        setSelectedQuestions(prev => prev.filter(id => id !== qId))
      } else {
        alert("Error deleting: " + res.error)
      }
      setIsDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedQuestions.length} questions?`)) {
      setIsDeleting(true)
      const res = await deleteQuestionsAction(selectedQuestions)
      if (res.success) {
        onUpdate()
        setSelectedQuestions([])
        if (selectedQuestion && selectedQuestions.includes(selectedQuestion.qid)) {
          setSelectedQuestion(null)
        }
      } else {
        alert("Error deleting: " + res.error)
      }
      setIsDeleting(false)
    }
  }

  const handleSelectQuestion = async (q) => {
    setSelectedQuestion(q) // Set optimistic lightweight state
    // Fetch heavy payload (options, context, explanation) dynamically
    const { data } = await fetchQuestionByQidAction(q.qid)
    if (data) {
      setSelectedQuestion(data)
    }
  }

  return (
    <div className="flex flex-1 h-full bg-white overflow-hidden">
      <div className="w-1/3 flex flex-col bg-gray-50/50 border-r border-gray-200 p-4 overflow-y-auto">
        <div className="flex flex-col gap-2 mb-4">
          <input
            type="text"
            placeholder="Search by QID or Context..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="w-full p-2 border rounded text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <select onChange={(e) => setFilter({ ...filter, subject: e.target.value })} className="w-full p-2 border rounded text-sm">
              <option value="">All Subjects</option>
              <option value="Math">Math</option>
              <option value="English">English</option>
            </select>
            <select onChange={(e) => setFilter({ ...filter, questionType: e.target.value })} value={filter.questionType} className="w-full p-2 border rounded text-sm">
              <option value="">All Types</option>
              <option value="MCQ">MCQ</option>
              <option value="SPR">SPR</option>
            </select>
            <select onChange={(e) => setFilter({ ...filter, difficulty: e.target.value })} className="w-full p-2 border rounded text-sm">
              <option value="">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
            <select onChange={(e) => setFilter({ ...filter, topic: e.target.value })} className="w-full p-2 border rounded text-sm">
              <option value="">All Topics</option>
              {uniqueTopics.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filter.assignment} onChange={(e) => setFilter({ ...filter, assignment: e.target.value })} className="w-full p-2 border rounded text-sm">
              <option value="All">All Status</option>
              <option value="Assigned">Assigned (Any)</option>
              <option value="Unassigned">Unassigned</option>
            </select>
            <select onChange={(e) => setFilter({ ...filter, hasImage: e.target.value })} value={filter.hasImage} className="w-full p-2 border rounded text-sm">
              <option value="All">All Image Status</option>
              <option value="Yes">Has Image</option>
              <option value="No">No Image</option>
            </select>
            <select onChange={(e) => setFilter({ ...filter, source: e.target.value })} value={filter.source} className="w-full p-2 border rounded text-sm">
              <option value="">All Sources</option>
              {uniqueSources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sort by:</span>
            <select value={filter.sort} onChange={(e) => setFilter({ ...filter, sort: e.target.value })} className="flex-1 p-2 border rounded text-sm bg-gray-50">
              <option value="Newest">Newest First</option>
              <option value="Oldest">Oldest First</option>
              <option value="Least Assigned">Least Assigned</option>
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center mb-2 text-sm font-medium text-gray-600">
          <span>Filtered: {filtered.length} | Selected: {selectedQuestions.length}</span>
          <div className="flex gap-2">
            <button onClick={() => setSelectedQuestions(filtered.map(q => q.qid))} className="px-2 py-1 bg-gray-100 border rounded hover:bg-gray-200 text-xs transition-colors">Select All</button>
            <button onClick={() => setSelectedQuestions([])} className="px-2 py-1 bg-gray-100 border rounded hover:bg-gray-200 text-xs transition-colors">Deselect All</button>
          </div>
        </div>

        {selectedQuestions.length > 0 && (
          <button onClick={handleBulkDelete} disabled={isDeleting} className="w-full mb-2 px-3 py-2 bg-red-600 text-white rounded font-bold text-sm hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm">
            {isDeleting ? 'Deleting...' : `Delete ${selectedQuestions.length} Selected`}
          </button>
        )}

        <div className="overflow-y-auto flex-1 border-t pt-2 space-y-2">
          {paginatedQuestions.map(q => {
            const assignedCount = q.assigned_modules?.length || 0;
            return (
              <div key={q.qid} onClick={() => handleSelectQuestion(q)} className={`p-3 border rounded cursor-pointer text-sm ${selectedQuestion?.qid === q.qid ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'} flex gap-3`}>              <div className="pt-0.5">
                <input
                  type="checkbox"
                  checked={selectedQuestions.includes(q.qid)}
                  onChange={(e) => {
                    e.stopPropagation();
                    const checked = e.target.checked;
                    setSelectedQuestions(prev => checked ? [...prev, q.qid] : prev.filter(id => id !== q.qid));
                  }}
                  className="w-4 h-4 cursor-pointer text-blue-600 rounded border-gray-300"
                />
              </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-bold text-gray-900">{q.qid}</span>
                    <span className="font-medium truncate text-gray-700">{q.question}</span>
                  </div>
                  <div className="text-xs mt-2 flex flex-wrap gap-2 items-center">
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded border">{q.subject_tag}</span>
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded border">{q.topic_tag}</span>
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded border">{q.difficulty}</span>
                    {assignedCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded border border-green-200 font-medium">Assigned to {assignedCount} Module{assignedCount !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-between items-center pt-4 border-t mt-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Show:</span>
            <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="p-1 border rounded bg-gray-50">
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50 transition-colors">Prev</button>
            {Array.from({ length: totalPages || 1 }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(currentPage - p) <= 1)
              .map((p, i, arr) => (
                <div key={p} className="flex items-center">
                  {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-gray-400 text-xs">...</span>}
                  <button
                    onClick={() => setCurrentPage(p)}
                    className={`px-2 py-1 border rounded text-xs transition-colors ${currentPage === p ? 'bg-blue-600 text-white font-bold border-blue-600' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
                  >
                    {p}
                  </button>
                </div>
              ))}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages || totalPages === 0} className="px-2 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50 transition-colors">Next</button>
          </div>
        </div>
      </div>
      <div className="w-2/3 bg-white p-6 flex flex-col overflow-y-auto">
        {selectedQuestion ? (
          <EditQuestionPanel question={selectedQuestion} onSave={handleSave} onDelete={() => handleDeleteSingle(selectedQuestion.qid)} isDeleting={isDeleting} onCancel={() => setSelectedQuestion(null)} onUpdate={onUpdate} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">Select a question to preview/edit</div>
        )}
      </div>
    </div>
  )
}
const OptionPreview = ({ rawOptionText }) => {
  if (!rawOptionText) return null;
  const cleanOpt = stripOptionLetter(rawOptionText);
  let textPart = cleanOpt;
  let imagePart = null;
  
  if (cleanOpt.includes('||')) {
    const parts = cleanOpt.split('||');
    textPart = parts[0].trim();
    imagePart = parts[1].trim();
  } else if (cleanOpt.match(/\.(png|svg|jpg|jpeg)(\?.*)?$/i) && !cleanOpt.includes(' ')) {
    textPart = '';
    imagePart = cleanOpt.trim();
  }

  return (
    <div className="p-3 pt-4 bg-white rounded border-2 border-green-100 text-sm shadow-sm">
      {textPart && <RichText content={textPart} />}
      {imagePart && (
        <div className={textPart ? "mt-3" : ""}>
          <img src={imagePart} alt="Option Image" className="max-w-full h-auto object-contain max-h-48" />
        </div>
      )}
    </div>
  );
};


function EditQuestionPanel({ question, onSave, onDelete, isDeleting, onCancel, onUpdate }) {
  const [formData, setFormData] = useState(question)
  const [imageUploading, setImageUploading] = useState(false)
  const [showChangeImageModal, setShowChangeImageModal] = useState(false)
  const [pendingImageFile, setPendingImageFile] = useState(null)
  const [pendingImagePreview, setPendingImagePreview] = useState(null)
  const fileInputRef = useRef(null)
  const modalFileInputRef = useRef(null)

  useEffect(() => {
    setFormData(question)
  }, [question])

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value })
  }

  // Display real newlines as literal '\n' so the user sees exactly what the raw string contains.
  const displayRaw = (val) => (val || '').replace(/\n/g, '\\n')

  // When saving/changing, convert literal '\n' typed by the user back to real newlines.
  const parseRaw = (val) => val.replace(/\\n/g, '\n')

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify([question], null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${question.qid}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImageUpload = async (file) => {
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!allowed.includes(file.type)) {
      alert(`Invalid file type: ${file.type}. Allowed: PNG, JPG, SVG, WebP`);
      return;
    }
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append('qid', formData.qid);
      fd.append('image', file);
      if (formData.image_url) {
        fd.append('old_image_url', formData.image_url);
      }
      const result = await uploadQuestionImageAction(fd);
      if (result.error) {
        alert(`Upload failed: ${result.error}`);
      } else {
        handleChange('image_url', result.newUrl);
        if (onUpdate) onUpdate();
      }
    } catch (e) {
      alert(`Upload error: ${e.message}`);
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (modalFileInputRef.current) modalFileInputRef.current.value = '';
    }
  };

  const openChangeImageModal = () => {
    setPendingImageFile(null);
    setPendingImagePreview(null);
    setShowChangeImageModal(true);
  };

  const handleModalFileSelect = (file) => {
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!allowed.includes(file.type)) {
      alert(`Invalid file type: ${file.type}. Allowed: PNG, JPG, SVG, WebP`);
      return;
    }
    setPendingImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setPendingImagePreview(previewUrl);
  };

  const confirmChangePicture = async () => {
    if (!pendingImageFile) return;
    setShowChangeImageModal(false);
    await handleImageUpload(pendingImageFile);
    if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
    setPendingImageFile(null);
    setPendingImagePreview(null);
  };

  const cancelChangeImage = () => {
    if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
    setPendingImageFile(null);
    setPendingImagePreview(null);
    setShowChangeImageModal(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">Edit Question</h3>
        <div className="flex gap-2">
          <button onClick={handleDownload} className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 border rounded hover:bg-gray-200 transition-colors flex items-center gap-1">
            <Download className="w-4 h-4" />
            Download JSON
          </button>
          <button onClick={onDelete} disabled={isDeleting} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1">
            <Trash2 className="w-4 h-4" />
            Delete Question
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(formData)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Save Changes</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
          <input value={formData.subject_tag || ''} onChange={(e) => handleChange('subject_tag', e.target.value)} className="w-full p-2 border rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Topic</label>
          <input value={formData.topic_tag || ''} onChange={(e) => handleChange('topic_tag', e.target.value)} className="w-full p-2 border rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
          <select value={formData.question_type || ''} onChange={(e) => handleChange('question_type', e.target.value)} className="w-full p-2 border rounded text-sm">
            <option value="MCQ">MCQ</option>
            <option value="SPR">SPR</option>
          </select>
        </div>
      </div>

      <div className="border-t pt-4">
        <label className="block text-xs font-medium text-gray-700 mb-2">Question Image</label>
        
        {formData.image_url ? (
          <div className="mb-4">
            <div className="flex justify-center p-4 bg-gray-50 rounded-lg border border-gray-200 relative">
              <img src={formData.image_url} alt="Question Reference" className="max-w-full h-auto object-contain rounded shadow-sm" style={{ maxHeight: '200px' }} />
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={openChangeImageModal}
                disabled={imageUploading}
                className="px-4 py-2 bg-amber-500 text-white rounded text-sm font-bold hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                {imageUploading ? 'Processing...' : 'Change Picture'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.svg,.webp"
              className="hidden"
              onChange={(e) => handleImageUpload(e.target.files?.[0])}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading}
              className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4" />
              {imageUploading ? 'Uploading...' : 'Upload Image'}
            </button>
            <p className="text-xs text-gray-400 mt-1">Accepts PNG, JPG, SVG, WebP</p>
          </div>
        )}

        {/* Change Picture Modal */}
        {showChangeImageModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={cancelChangeImage}>
            <div className="bg-white rounded-xl shadow-2xl w-[520px] max-w-[90vw] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b bg-gray-50">
                <h4 className="font-bold text-lg text-gray-800">Change Question Image</h4>
                <p className="text-sm text-gray-500 mt-0.5">Select a new image to replace the current one.</p>
              </div>

              <div className="p-6">
                {/* Current image preview */}
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Current Image</label>
                  <div className="flex justify-center p-3 bg-gray-50 rounded-lg border">
                    <img src={formData.image_url} alt="Current" className="max-w-full h-auto object-contain rounded" style={{ maxHeight: '120px' }} />
                  </div>
                </div>

                {/* New image selection */}
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">New Image</label>
                  <input
                    ref={modalFileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg,.webp"
                    className="hidden"
                    onChange={(e) => handleModalFileSelect(e.target.files?.[0])}
                  />
                  {pendingImagePreview ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex justify-center p-3 bg-emerald-50 rounded-lg border-2 border-emerald-200 w-full">
                        <img src={pendingImagePreview} alt="New preview" className="max-w-full h-auto object-contain rounded" style={{ maxHeight: '120px' }} />
                      </div>
                      <button onClick={() => modalFileInputRef.current?.click()} className="text-xs text-blue-600 hover:underline font-medium">Choose a different file</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => modalFileInputRef.current?.click()}
                      className="w-full py-6 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors flex flex-col items-center gap-2"
                    >
                      <Upload className="w-6 h-6" />
                      <span className="text-sm font-medium">Click to select an image</span>
                      <span className="text-xs text-gray-400">PNG, JPG, SVG, WebP</span>
                    </button>
                  )}
                </div>

                {/* Warning */}
                {pendingImageFile && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                    <Trash2 className="w-4 h-4 mt-0.5 shrink-0" />
                    <span><strong>Warning:</strong> You are about to delete the current image from the database and replace it with the new one. This action cannot be undone.</span>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
                <button onClick={cancelChangeImage} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-100 transition-colors font-medium">Cancel</button>
                <button
                  onClick={confirmChangePicture}
                  disabled={!pendingImageFile}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold flex items-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  Confirm Change Picture
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-end mb-1">
          <label className="block text-xs font-medium text-gray-700">Context (Optional)</label>
          <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded tracking-wider">RAW INPUT</span>
        </div>
        <textarea value={displayRaw(formData.context)} onChange={(e) => handleChange('context', parseRaw(e.target.value))} className="w-full p-2 border rounded text-sm h-24 mb-1 font-mono bg-gray-50" placeholder="Enter context text if applicable..." />
        {formData.context && (
          <div className="mb-6 relative mt-2">
            <div className="absolute -top-2.5 left-3 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200 z-10 tracking-wider">PREVIEW</div>
            <div className="p-4 pt-5 bg-white rounded border-2 border-blue-100 shadow-sm"><RichText content={formData.context} /></div>
          </div>
        )}

        <div className="flex justify-between items-end mb-1">
          <label className="block text-xs font-medium text-gray-700">Question Text</label>
          <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded tracking-wider">RAW INPUT</span>
        </div>
        <textarea value={displayRaw(formData.question)} onChange={(e) => handleChange('question', parseRaw(e.target.value))} className="w-full p-2 border rounded text-sm h-24 mb-1 font-mono bg-gray-50" />
        {formData.question && (
          <div className="mb-6 relative mt-2">
            <div className="absolute -top-2.5 left-3 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200 z-10 tracking-wider">PREVIEW</div>
            <div className="p-4 pt-5 bg-white rounded border-2 border-blue-100 shadow-sm"><RichText content={formData.question} /></div>
          </div>
        )}

        {(!formData.question_type || formData.question_type.toUpperCase() === 'MCQ') && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-6 mb-6">
            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="block text-xs font-medium text-gray-700">Option A</label>
                <span className="text-[9px] font-bold bg-gray-200 text-gray-600 px-1 rounded">RAW</span>
              </div>
              <textarea value={displayRaw(formData.option_a)} onChange={(e) => handleChange('option_a', parseRaw(e.target.value))} className="w-full p-2 border rounded text-sm h-24 mb-1 font-mono bg-gray-50" />
              {formData.option_a && (
                <div className="relative mt-2">
                  <div className="absolute -top-2 left-2 bg-green-100 text-green-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-green-200 z-10">PREVIEW</div>
                  <OptionPreview rawOptionText={formData.option_a} />
                </div>
              )}
            </div>
            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="block text-xs font-medium text-gray-700">Option B</label>
                <span className="text-[9px] font-bold bg-gray-200 text-gray-600 px-1 rounded">RAW</span>
              </div>
              <textarea value={displayRaw(formData.option_b)} onChange={(e) => handleChange('option_b', parseRaw(e.target.value))} className="w-full p-2 border rounded text-sm h-24 mb-1 font-mono bg-gray-50" />
              {formData.option_b && (
                <div className="relative mt-2">
                  <div className="absolute -top-2 left-2 bg-green-100 text-green-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-green-200 z-10">PREVIEW</div>
                  <OptionPreview rawOptionText={formData.option_b} />
                </div>
              )}
            </div>
            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="block text-xs font-medium text-gray-700">Option C</label>
                <span className="text-[9px] font-bold bg-gray-200 text-gray-600 px-1 rounded">RAW</span>
              </div>
              <textarea value={displayRaw(formData.option_c)} onChange={(e) => handleChange('option_c', parseRaw(e.target.value))} className="w-full p-2 border rounded text-sm h-24 mb-1 font-mono bg-gray-50" />
              {formData.option_c && (
                <div className="relative mt-2">
                  <div className="absolute -top-2 left-2 bg-green-100 text-green-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-green-200 z-10">PREVIEW</div>
                  <OptionPreview rawOptionText={formData.option_c} />
                </div>
              )}
            </div>
            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="block text-xs font-medium text-gray-700">Option D</label>
                <span className="text-[9px] font-bold bg-gray-200 text-gray-600 px-1 rounded">RAW</span>
              </div>
              <textarea value={displayRaw(formData.option_d)} onChange={(e) => handleChange('option_d', parseRaw(e.target.value))} className="w-full p-2 border rounded text-sm h-24 mb-1 font-mono bg-gray-50" />
              {formData.option_d && (
                <div className="relative mt-2">
                  <div className="absolute -top-2 left-2 bg-green-100 text-green-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-green-200 z-10">PREVIEW</div>
                  <OptionPreview rawOptionText={formData.option_d} />
                </div>
              )}
            </div>
          </div>
        )}

        <label className="block text-xs font-medium text-gray-700 mb-1">Correct Answer</label>
        <input value={formData.correct_answer || ''} onChange={(e) => handleChange('correct_answer', e.target.value)} className="w-full p-2 border rounded text-sm mb-6" />

        <div className="flex justify-between items-end mb-1">
          <label className="block text-xs font-medium text-gray-700">Explanation</label>
          <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded tracking-wider">RAW INPUT</span>
        </div>
        <textarea value={displayRaw(formData.correct_answer_explanation)} onChange={(e) => handleChange('correct_answer_explanation', parseRaw(e.target.value))} className="w-full p-2 border rounded text-sm h-24 mb-1 font-mono bg-gray-50" />
        {formData.correct_answer_explanation && (
          <div className="mb-6 relative mt-2">
            <div className="absolute -top-2.5 left-3 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200 z-10 tracking-wider">PREVIEW</div>
            <div className="p-4 pt-5 bg-white rounded border-2 border-blue-100 shadow-sm"><RichText content={formData.correct_answer_explanation} /></div>
          </div>
        )}
      </div>
    </div>
  )
}


function ModuleSettingsEditor({ module, onUpdate, supabase, allModules }) {
  const [moduleName, setModuleName] = useState(module.module_name)
  const [timeLimit, setTimeLimit] = useState(module.time_limit_minutes)
  const [difficulty, setDifficulty] = useState(module.difficulty || 'Mixed')
  const [requiredLevel, setRequiredLevel] = useState(module.required_level ?? 1)
  const [directory, setDirectory] = useState(module.directory || '')
  const [saving, setSaving] = useState(false)

  const existingDirs = [...new Set((allModules || []).map(m => m.directory).filter(Boolean))].sort()

  useEffect(() => {
    setModuleName(module.module_name)
    setTimeLimit(module.time_limit_minutes)
    setDifficulty(module.difficulty || 'Mixed')
    setRequiredLevel(module.required_level ?? 1)
    setDirectory(module.directory || '')
  }, [module])

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('modules').update({
      module_name: moduleName,
      time_limit_minutes: timeLimit,
      difficulty: difficulty,
      required_level: requiredLevel,
      directory: directory.trim() || null
    }).eq('id', module.id)
    if (moduleName !== module.module_name) {
      await supabase.from('files').update({ name: moduleName }).eq('type', 'module').eq('reference_id', module.id)
    }
    onUpdate()
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded border text-sm">
      <div className="flex gap-2 items-center">
        <span className="font-bold text-gray-700 w-16">Name:</span>
        <input type="text" value={moduleName} onChange={e => setModuleName(e.target.value)} className="flex-1 p-1 border rounded" />
      </div>
      <div className="flex gap-2 items-center">
        <span className="font-bold text-gray-700 w-16">Folder:</span>
        <input
          list="dir-autocomplete-settings"
          type="text"
          value={directory}
          onChange={e => setDirectory(e.target.value)}
          placeholder="None (dashboard root)"
          className="flex-1 p-1 border rounded"
        />
        <datalist id="dir-autocomplete-settings">
          {existingDirs.map(d => <option key={d} value={d} />)}
        </datalist>
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <span className="font-bold text-gray-700 w-16">Settings:</span>
        <input type="number" value={timeLimit} onChange={e => setTimeLimit(parseInt(e.target.value) || 0)} className="w-16 p-1 border rounded" />
        <span className="text-gray-500">mins</span>
        <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="p-1 border rounded">
          <option value="Mixed">Mixed</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>
        <select value={requiredLevel} onChange={e => {
          const val = parseInt(e.target.value, 10)
          setRequiredLevel(val)
        }} className="p-1 border rounded font-bold">
          <option value={1}>Level 1 (Free)</option>
          <option value={2}>Level 2 (Practice)</option>
          <option value={4}>Level 4 (Flash)</option>
          <option value={6}>Level 6 (Master)</option>
        </select>
        <button onClick={handleSave} disabled={saving} className="px-4 py-1 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 disabled:opacity-50 ml-auto">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

function ModuleReorderEditor({ module, questions, onUpdate, supabase, setPreviewQuestion }) {
  const [numChunks, setNumChunks] = useState(1);
  const [chunks, setChunks] = useState([module.question_ids || []]);
  const [chunkNames, setChunkNames] = useState(['Chunk 1']);
  const [chunkIds, setChunkIds] = useState([Math.random().toString()]);
  const [draggedPos, setDraggedPos] = useState(null);
  const [selectedForMove, setSelectedForMove] = useState([]);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [draggedChunkIndex, setDraggedChunkIndex] = useState(null);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  useEffect(() => {
    setNumChunks(1);
    setChunks([module.question_ids || []]);
    setChunkNames(['Chunk 1']);
    setChunkIds([Math.random().toString()]);
    setSelectedForMove([]);
  }, [module]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Control') {
        if (!e.repeat) {
          setIsCtrlPressed(true);
          setSelectedForMove([]);
        }
      }
    };
    const handleKeyUp = (e) => {
      if (e.key === 'Control') {
        setIsCtrlPressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleSave = async () => {
    const flatQIds = chunks.flat();
    await supabase.from('modules').update({ question_ids: flatQIds }).eq('id', module.id);
    onUpdate();
    alert('Order saved!');
  };

  const handleSort = (direction) => {
    const flatQIds = chunks.flat();
    flatQIds.sort((a, b) => {
      if (direction === 'asc') return a.localeCompare(b);
      if (direction === 'desc') return b.localeCompare(a);
      return 0;
    });

    let newChunks = [];
    let currentIndex = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunkSize = chunks[i].length;
      newChunks.push(flatQIds.slice(currentIndex, currentIndex + chunkSize));
      currentIndex += chunkSize;
    }
    setChunks(newChunks);
  };

  const handleNumChunksChange = (e) => {
    let newNum = parseInt(e.target.value) || 1;
    if (newNum < 1) newNum = 1;
    if (newNum > 10) newNum = 10;

    if (newNum < chunks.length) {
      // Safety check: Cannot reduce chunks if the chunks being removed have questions
      for (let i = newNum; i < chunks.length; i++) {
        if (chunks[i].length > 0) {
          alert(`Cannot decrease chunks to ${newNum} because Chunk ${i + 1} is not empty. Please move its questions first.`);
          return;
        }
      }
    }

    let newChunks = [...chunks];
    let newNames = [...chunkNames];
    let newIds = [...chunkIds];
    if (newNum > chunks.length) {
      for (let i = chunks.length; i < newNum; i++) {
        newChunks.push([]);
        newNames.push(`Chunk ${i + 1}`);
        newIds.push(Math.random().toString());
      }
    } else if (newNum < chunks.length) {
      newChunks.splice(newNum);
      newNames.splice(newNum);
      newIds.splice(newNum);
    }

    setNumChunks(newNum);
    setChunks(newChunks);
    setChunkNames(newNames);
    setChunkIds(newIds);
  };

  const onDragStart = (e, chunkIndex, itemIndex) => {
    e.stopPropagation(); // Crucial: prevents the chunk's onDragStart from firing simultaneously
    const qId = chunks[chunkIndex][itemIndex];
    if (!selectedForMove.includes(qId)) {
      setSelectedForMove([qId]);
    }
    setDraggedPos({ chunkIndex, itemIndex });
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOverItem = (e, targetChunkIndex, targetItemIndex) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent the chunk's onDragOver from firing
    if (!draggedPos) return;

    const targetId = chunks[targetChunkIndex][targetItemIndex];
    if (selectedForMove.includes(targetId)) return;

    let newChunks = chunks.map(chunk => chunk.filter(id => !selectedForMove.includes(id)));

    let newTargetIndex = newChunks[targetChunkIndex].indexOf(targetId);
    if (newTargetIndex === -1) newTargetIndex = newChunks[targetChunkIndex].length;

    newChunks[targetChunkIndex].splice(newTargetIndex, 0, ...selectedForMove);
    setDraggedPos({ chunkIndex: targetChunkIndex, itemIndex: newTargetIndex });
    setChunks(newChunks);
  };

  const onDragOverChunkBackground = (e, targetChunkIndex) => {
    e.preventDefault();
    if (!draggedPos) return;

    let newChunks = chunks.map(chunk => chunk.filter(id => !selectedForMove.includes(id)));
    newChunks[targetChunkIndex].push(...selectedForMove);
    setDraggedPos({ chunkIndex: targetChunkIndex, itemIndex: newChunks[targetChunkIndex].length - selectedForMove.length });
    setChunks(newChunks);
  };

  const toggleSelection = (qId) => {
    if (selectedForMove.includes(qId)) {
      setSelectedForMove(prev => prev.filter(id => id !== qId));
    } else {
      setSelectedForMove(prev => {
        const flatQIds = chunks.flat();
        const next = [...prev, qId];
        return next.sort((a, b) => flatQIds.indexOf(a) - flatQIds.indexOf(b));
      });
    }
  };

  const addToSelection = (qId) => {
    if (!selectedForMove.includes(qId)) {
      setSelectedForMove(prev => {
        const flatQIds = chunks.flat();
        const next = [...prev, qId];
        return next.sort((a, b) => flatQIds.indexOf(a) - flatQIds.indexOf(b));
      });
    }
  };

  const onDragStartChunk = (e, chunkIndex) => {
    // Only allow chunk dragging if not dragging an item
    if (draggedPos !== null) {
      e.preventDefault();
      return;
    }
    setDraggedChunkIndex(chunkIndex);
    e.dataTransfer.effectAllowed = "move";
    // We can't let children catch this
  };

  const onDragOverChunk = (e, targetChunkIndex) => {
    e.preventDefault();
    if (draggedChunkIndex === null || draggedChunkIndex === targetChunkIndex) return;

    let newChunks = [...chunks];
    let newNames = [...chunkNames];
    let newIds = [...chunkIds];

    const draggedChunk = newChunks.splice(draggedChunkIndex, 1)[0];
    const draggedName = newNames.splice(draggedChunkIndex, 1)[0];
    const draggedId = newIds.splice(draggedChunkIndex, 1)[0];

    newChunks.splice(targetChunkIndex, 0, draggedChunk);
    newNames.splice(targetChunkIndex, 0, draggedName);
    newIds.splice(targetChunkIndex, 0, draggedId);

    setDraggedChunkIndex(targetChunkIndex);
    setChunks(newChunks);
    setChunkNames(newNames);
    setChunkIds(newIds);
  };

  const renderChunks = (isHorizontal) => (
    <div className={`flex gap-4 pb-4 flex-1 ${isHorizontal ? 'overflow-x-auto items-stretch min-h-[300px]' : 'flex-col overflow-y-auto'}`}>
      {chunks.map((chunk, cIndex) => (
        <div
          key={chunkIds[cIndex]}
          className={`${isHorizontal ? 'flex-shrink-0 w-96' : 'w-full'} bg-gray-50 p-3 rounded-lg border border-gray-200 flex flex-col min-h-[250px] shadow-inner ${draggedChunkIndex === cIndex ? 'opacity-50 border-blue-400' : 'hover:border-blue-400'} transition-colors`}
          onDragOver={(e) => {
            if (draggedChunkIndex !== null && isHorizontal) {
              onDragOverChunk(e, cIndex);
            } else if (draggedPos !== null) {
              onDragOverChunkBackground(e, cIndex);
            }
          }}
          draggable={isHorizontal && draggedPos === null}
          onDragStart={(e) => isHorizontal && draggedPos === null ? onDragStartChunk(e, cIndex) : e.preventDefault()}
          onDragEnd={() => setDraggedChunkIndex(null)}
        >
          <div className={`font-bold text-gray-700 mb-3 px-2 text-sm border-b border-gray-200 pb-2 flex justify-between items-center ${isHorizontal ? 'cursor-move' : ''}`} title={isHorizontal ? "Drag to move entire column" : ""}>
            <div className="flex items-center gap-2 flex-1">
              {isHorizontal && <GripHorizontal className="w-5 h-5 text-gray-400 shrink-0" />}
              <input
                type="text"
                value={chunkNames[cIndex]}
                onChange={e => {
                  const newNames = [...chunkNames];
                  newNames[cIndex] = e.target.value;
                  setChunkNames(newNames);
                }}
                className={`bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none w-full ${isHorizontal ? 'cursor-text' : ''}`}
                placeholder="Chunk Name"
                onMouseDown={e => e.stopPropagation()} // Prevent drag when clicking input
              />
            </div>
            <span className="text-blue-600 bg-blue-50 px-2 rounded-full text-xs py-0.5 pointer-events-none shrink-0 ml-2">{chunk.length} Qs</span>
          </div>
          <div className="space-y-2 flex-1 overflow-y-auto pr-1" onMouseDown={e => e.stopPropagation()}>
            {chunk.map((qId, iIndex) => {
              const q = questions.find(qu => qu.qid === qId);
              if (!q) return null;
              const isSelected = selectedForMove.includes(qId);
              const isDragged = draggedPos?.chunkIndex === cIndex && draggedPos?.itemIndex === iIndex;

              return (
                <div
                  key={qId}
                  draggable
                  onDragStart={(e) => onDragStart(e, cIndex, iIndex)}
                  onDragOver={(e) => onDragOverItem(e, cIndex, iIndex)}
                  onDragEnd={() => setDraggedPos(null)}
                  onMouseDown={(e) => {
                    if (e.ctrlKey && e.button === 0) {
                      e.preventDefault();
                      addToSelection(qId);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (e.ctrlKey && e.buttons === 1) {
                      addToSelection(qId);
                    }
                  }}
                  className={`p-3 border rounded bg-white shadow-sm cursor-move flex items-center justify-between transition-colors ${draggedPos && isSelected ? 'opacity-60 border-blue-400 bg-blue-50' : 'hover:border-blue-400'} ${isSelected && !draggedPos ? 'border-blue-500 bg-blue-100' : ''}`}
                >
                  <div className="text-sm truncate flex-1 mr-2 flex items-center gap-3">
                    <div className="pt-0.5 shrink-0" onMouseDown={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(qId)}
                        className="w-4 h-4 cursor-pointer text-blue-600 rounded border-gray-300"
                      />
                    </div>
                    <span className="font-bold text-gray-400 text-xs w-4 shrink-0">{iIndex + 1}.</span>
                    <div className="flex flex-col min-w-0">
                      <div onClick={() => setPreviewQuestion(q)} className="text-sm truncate font-bold cursor-pointer text-gray-800 hover:text-blue-600 transition-colors" title={q.qid}>
                        {q.qid}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate mt-0.5">
                        {q.subject_tag} • {q.topic_tag} • {q.difficulty}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {chunk.length === 0 && <div className="text-gray-400 text-xs italic text-center mt-6 pointer-events-none">Empty Chunk... Drop questions here.</div>}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full relative">
      {!isEnlarged && (
        <>
          <div className="flex justify-between items-center mb-4 border-b pb-4 shrink-0">
            <div className="flex items-center gap-4">
              <h3 className="font-bold text-lg">Reordering: {module.module_name}</h3>
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded border text-sm">
                <span className="font-bold text-gray-700">Chunks:</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={numChunks}
                  onChange={handleNumChunksChange}
                  className="w-16 p-1 border rounded text-center bg-white"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsEnlarged(true)} className="px-3 py-2 bg-gray-200 text-gray-700 rounded font-bold text-sm hover:bg-gray-300 transition-colors shadow-sm flex items-center gap-1">
                <Maximize2 className="w-4 h-4" /> Enlarge
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded font-bold text-sm hover:bg-blue-700 shadow-sm">Save Order</button>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4 shrink-0">
            <p className="text-sm text-gray-500">Divide into chunks, then drag blocks across columns. Click QID to preview.</p>
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2 border-r pr-4 border-gray-300">
                <span className="text-xs font-bold text-gray-500 uppercase">Sort by QID:</span>
                <select 
                  onChange={(e) => {
                    if (e.target.value) {
                      handleSort(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="text-xs border rounded p-1.5 font-medium bg-white text-gray-700 outline-none"
                >
                  <option value="">Select...</option>
                  <option value="asc">A - Z (Small to Large)</option>
                  <option value="desc">Z - A (Large to Small)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSelectedForMove(chunks.flat())} className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 text-xs font-bold text-gray-700 transition-colors">Select All</button>
                <button onClick={() => setSelectedForMove([])} className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 text-xs font-bold text-gray-700 transition-colors">Deselect All</button>
              </div>
            </div>
          </div>

          {renderChunks(false)}
        </>
      )}

      {isEnlarged && (
        <div className="fixed inset-0 bg-white z-40 flex flex-col p-6 overflow-hidden">
          <header className="flex justify-between items-center px-6 py-4 border-b border-gray-300 bg-gray-100 rounded-t-lg shadow-sm shrink-0 mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-gray-800">Enlarged Reorder View</h2>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border text-sm shadow-sm">
                <span className="font-bold text-gray-700">Chunks:</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={numChunks}
                  onChange={handleNumChunksChange}
                  className="w-16 p-1 border rounded text-center bg-gray-50"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow-sm flex items-center gap-2 transition-colors">
                Save Order
              </button>
              <div className="w-px h-6 bg-gray-300 mx-2"></div>
              <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded border shadow-sm">
                <span className="text-xs font-bold text-gray-500 uppercase">Sort QIDs:</span>
                <select 
                  onChange={(e) => {
                    if (e.target.value) {
                      handleSort(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="text-sm border-none bg-transparent font-medium text-gray-700 outline-none cursor-pointer"
                >
                  <option value="">Select...</option>
                  <option value="asc">A - Z</option>
                  <option value="desc">Z - A</option>
                </select>
              </div>
              <div className="w-px h-6 bg-gray-300 mx-2"></div>
              <button onClick={() => setSelectedForMove(chunks.flat())} className="px-3 py-1.5 bg-gray-200 border border-gray-300 rounded hover:bg-gray-300 text-sm font-bold transition-colors">Select All</button>
              <button onClick={() => setSelectedForMove([])} className="px-3 py-1.5 bg-gray-200 border border-gray-300 rounded hover:bg-gray-300 text-sm font-bold transition-colors">Deselect All</button>
              <div className="w-px h-6 bg-gray-300 mx-2"></div>
              <button onClick={() => setIsEnlarged(false)} className="px-4 py-2 bg-[#747474] text-white rounded font-bold hover:bg-red-600 shadow-sm flex items-center gap-2 transition-colors">
                <X className="w-4 h-4" /> Close
              </button>
            </div>
          </header>
          <div className="flex justify-between items-center mb-4 shrink-0 px-2">
            <p className="text-sm text-gray-500">Hold Ctrl and drag your mouse to bulk select. Drag a selected chunk to move it. Drag a Chunk Title to reorder the entire column.</p>
          </div>
          {renderChunks(true)}
        </div>
      )}
    </div>
  );
}

export async function cleanupDeletedModulesFromDb(modIds, supabase) {
  if (!modIds || modIds.length === 0) return;
  
  let allQs = [];
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const { data } = await supabase.from('questions').select('qid, assigned_modules').not('assigned_modules', 'is', null).range(page * 1000, (page + 1) * 1000 - 1);
    if (data && data.length > 0) {
      allQs = allQs.concat(data);
      page++;
      if (data.length < 1000) hasMore = false;
    } else {
      hasMore = false;
    }
  }

  const qsToUpdate = allQs.filter(q => q.assigned_modules && q.assigned_modules.some(id => modIds.some(mId => String(mId) === String(id))));
  
  const chunkSize = 50;
  for (let i = 0; i < qsToUpdate.length; i += chunkSize) {
    const chunk = qsToUpdate.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (q) => {
      const cleanedMods = q.assigned_modules.filter(id => !modIds.some(mId => String(mId) === String(id)));
      await supabase.from('questions').update({ assigned_modules: [...new Set(cleanedMods)] }).eq('qid', q.qid);
    }));
  }
}

export function ModuleBuilder({ modules, setModules, questions, setQuestions, onUpdate, supabase, forceSelectedModuleId, onBack, test, setEditingModuleId }) {
  const [newModule, setNewModule] = useState({ module_name: '', time_limit_minutes: 60, difficulty: 'Mixed', required_level: 6, parent_directory: '/root/modules' })
  const existingDirectories = []
  const [selectedModuleId, setSelectedModuleId] = useState(forceSelectedModuleId || null)
  const [activeView, setActiveView] = useState('bank') // 'bank' or 'assigned'
  const [reorderMode, setReorderMode] = useState(false)
  const [filter, setFilter] = useState({ search: '', subject: '', difficulty: '', topic: '', assignment: 'All', sort: 'Newest', hasImage: 'All', source: '' })
  const [selectedQuestions, setSelectedQuestions] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [previewQuestion, setPreviewQuestion] = useState(null)
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)

  useEffect(() => {
    if (forceSelectedModuleId && forceSelectedModuleId !== selectedModuleId) {
      setSelectedModuleId(forceSelectedModuleId)
    }
  }, [forceSelectedModuleId])

  useEffect(() => {
    setCurrentPage(1)
  }, [filter, itemsPerPage, selectedModuleId])

  useEffect(() => {
    setSelectedQuestions([])
  }, [filter.search, filter.subject, filter.difficulty, filter.topic, filter.assignment, filter.hasImage, filter.source, selectedModuleId])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Control') {
        if (!e.repeat) {
          setIsCtrlPressed(true);
          setSelectedQuestions([]);
        }
      }
    };
    const handleKeyUp = (e) => {
      if (e.key === 'Control') {
        setIsCtrlPressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const selectedModule = modules.find(m => m.id === selectedModuleId) || null
  const uniqueTopics = [...new Set(questions.map(q => q.topic_tag).filter(Boolean))]
  const uniqueSources = [...new Set(questions.map(q => q.question_source).filter(Boolean))]

  const filteredQuestions = questions.filter(q => {
    if (filter.search) {
      const lowerSearch = filter.search.toLowerCase()
      const matchesQid = q.qid?.toLowerCase().startsWith(lowerSearch)
      const matchesContext = q.context?.toLowerCase().includes(lowerSearch) || q.question?.toLowerCase().includes(lowerSearch)
      if (!matchesQid && !matchesContext) return false
    }

    if (filter.subject && q.subject_tag !== filter.subject) return false
    if (filter.difficulty && q.difficulty !== filter.difficulty) return false
    if (filter.topic && q.topic_tag !== filter.topic) return false
    if (filter.source && q.question_source !== filter.source) return false

    if (filter.hasImage === 'Yes' && !q.image_url) return false
    if (filter.hasImage === 'No' && q.image_url) return false

    const isAssigned = q.assigned_modules && q.assigned_modules.length > 0;
    if (filter.assignment === 'Assigned' && !isAssigned) return false;
    if (filter.assignment === 'Unassigned' && isAssigned) return false;

    return true;
  }).sort((a, b) => {
    if (filter.sort === 'Least Assigned') {
      const countA = a.assigned_modules?.length || 0;
      const countB = b.assigned_modules?.length || 0;
      return countA - countB;
    }
    if (filter.sort === 'Oldest') {
      return new Date(a.created_at) - new Date(b.created_at);
    }
    return 0; // Default order (Newest)
  })

  const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage)
  const paginatedQuestions = filteredQuestions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleCreate = async () => {
    if (!newModule.module_name) {
      alert("Please enter a module name")
      return
    }
    const moduleToInsert = { 
      module_name: newModule.module_name, 
      time_limit_minutes: newModule.time_limit_minutes, 
      difficulty: newModule.difficulty, 
      required_level: newModule.required_level
    }
    
    const { data: insertedData, error } = await supabase.from('modules').insert([moduleToInsert]).select()
    
    if (!error && insertedData?.length > 0) {
      await supabase.from('files').insert({
        name: insertedData[0].module_name,
        type: 'module',
        parent_directory: newModule.parent_directory.trim() || '/root/modules',
        reference_id: insertedData[0].id
      })
      
      setNewModule({ module_name: '', time_limit_minutes: 60, difficulty: 'Mixed', required_level: 6, parent_directory: '/root/modules' })
      onUpdate()
    } else {
      console.error("Module creation error:", error)
      alert("Error creating module: " + error.message)
    }
  }

  const toggleQuestion = async (mod, qId) => {
    // 1. Optimistic: calculate expected new arrays for instant UI
    const isCurrentlyAssigned = mod.question_ids?.some(id => String(id) === String(qId))
    const optimisticQIds = isCurrentlyAssigned 
      ? (mod.question_ids || []).filter(id => String(id) !== String(qId)) 
      : [...new Set([...(mod.question_ids || []), qId])]

    const q = questions.find(q => String(q.qid) === String(qId))
    const optimisticAssignedMods = isCurrentlyAssigned 
      ? (q?.assigned_modules || []).filter(id => String(id) !== String(mod.id)) 
      : [...new Set([...(q?.assigned_modules || []), mod.id])]

    // 2. OPTIMISTIC UI UPDATE
    setModules(prev => prev.map(m => String(m.id) === String(mod.id) ? { ...m, question_ids: optimisticQIds } : m))
    setQuestions(prev => prev.map(qu => String(qu.qid) === String(qId) ? { ...qu, assigned_modules: optimisticAssignedMods } : qu))

    // 3. ATOMIC SERVER ACTION (reads current DB state, not stale client state)
    console.log('[toggleQuestion] Calling server action:', { moduleId: mod.id, qId, isCurrentlyAssigned });
    const res = await toggleSingleQuestionAction(mod.id, qId)
    console.log('[toggleQuestion] Server action result:', res);
    if (!res.success) {
      console.error('toggleSingleQuestionAction failed:', res.error)
    } else {
      // Force-update local state with authoritative server result
      setModules(prev => prev.map(m => String(m.id) === String(mod.id) ? { ...m, question_ids: res.newQIds } : m))
      setQuestions(prev => prev.map(qu => String(qu.qid) === String(qId) ? { ...qu, assigned_modules: res.newAssignedMods } : qu))
    }

    // 4. Refetch to sync with authoritative DB state
    await onUpdate()
  }

  const handleBulkToggle = async (assign) => {
    if (!selectedModule) return;

    // 1. Get QIDs to toggle (from explicitly selected checkboxes)
    const qidsToToggle = [...selectedQuestions];
    if (qidsToToggle.length === 0) return;

    // 2. Optimistic UI update
    let optimisticQIds = [];
    if (assign) {
      optimisticQIds = [...new Set([...(selectedModule.question_ids || []), ...qidsToToggle])];
    } else {
      optimisticQIds = (selectedModule.question_ids || []).filter(id => !qidsToToggle.some(qId => String(qId) === String(id)));
    }

    setModules(prev => prev.map(m => String(m.id) === String(selectedModule.id) ? { ...m, question_ids: optimisticQIds } : m));
    setQuestions(prevQuestions => prevQuestions.map(qu => {
      if (qidsToToggle.some(qId => String(qId) === String(qu.qid))) {
        const rawMods = assign
          ? [...(qu.assigned_modules || []), selectedModule.id]
          : (qu.assigned_modules || []).filter(id => String(id) !== String(selectedModule.id));
        return { ...qu, assigned_modules: [...new Set(rawMods)] };
      }
      return qu;
    }));

    // Instantly clear checkboxes
    setSelectedQuestions([]);

    // 3. ATOMIC SERVER ACTION (reads current DB state, not stale client state)
    console.log('[handleBulkToggle] Calling server action:', { moduleId: selectedModule.id, qidCount: qidsToToggle.length, assign });
    const res = await bulkToggleQuestionsToModuleAction(selectedModule.id, qidsToToggle, assign);
    console.log('[handleBulkToggle] Server action result:', res);
    if (!res.success) {
      console.error('bulkToggleQuestionsToModuleAction failed:', res.error);
      alert('Assignment failed: ' + res.error);
    } else {
      // Force-update local module state with the authoritative server result
      // This ensures we don't rely on the refetch alone
      setModules(prev => prev.map(m => String(m.id) === String(selectedModule.id) ? { ...m, question_ids: res.newQIds } : m));
      if (res.updatedQs && res.updatedQs.length > 0) {
        const updatedMap = new Map(res.updatedQs.map(item => [String(item.qid), item.assigned_modules]));
        setQuestions(prev => prev.map(q => updatedMap.has(String(q.qid)) ? { ...q, assigned_modules: updatedMap.get(String(q.qid)) } : q));
      }
    }

    // 4. Refetch to sync with authoritative DB state
    console.log('[handleBulkToggle] Starting onUpdate refetch...');
    await onUpdate();
    console.log('[handleBulkToggle] onUpdate refetch complete.');
  }

  const handleClearAllAssigned = async (mod) => {
    if (!mod || !mod.question_ids || mod.question_ids.length === 0) return;
    const qidsToClear = [...mod.question_ids];

    // 1. Optimistic UI update
    setModules(prev => prev.map(m => String(m.id) === String(mod.id) ? { ...m, question_ids: [] } : m));
    setQuestions(prevQuestions => prevQuestions.map(qu => {
      if (qidsToClear.some(qId => String(qId) === String(qu.qid))) {
        const cleanedMods = (qu.assigned_modules || []).filter(id => String(id) !== String(mod.id));
        return { ...qu, assigned_modules: [...new Set(cleanedMods)] };
      }
      return qu;
    }));

    // 2. ATOMIC SERVER ACTION (reads current DB state, not stale client state)
    const res = await clearAllModuleQuestionsAction(mod.id);
    if (!res.success) {
      console.error('clearAllModuleQuestionsAction failed:', res.error);
    }

    // 3. Refetch to sync with authoritative DB state
    onUpdate();
  };

  return (
    <div className={`flex flex-1 h-full bg-white overflow-hidden`}>
      {!forceSelectedModuleId && (
        <div className="w-1/3 bg-gray-50/50 border-r border-gray-200 p-4 flex flex-col overflow-y-auto">
        <div className="mb-6 p-4 bg-gray-50 rounded border">
          <h4 className="text-sm font-bold mb-3">Create Module</h4>
          <input placeholder="Module Name" value={newModule.module_name} onChange={e => setNewModule({ ...newModule, module_name: e.target.value })} className="w-full mb-2 p-2 text-sm border rounded" />
          <div className="flex gap-2 mb-2">
            <input type="number" placeholder="Minutes" value={newModule.time_limit_minutes} onChange={e => setNewModule({ ...newModule, time_limit_minutes: parseInt(e.target.value) })} className="w-1/2 p-2 text-sm border rounded" />
            <select value={newModule.difficulty} onChange={e => setNewModule({ ...newModule, difficulty: e.target.value })} className="w-1/2 p-2 text-sm border rounded">
              <option value="Mixed">Mixed</option>
              <option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option>
            </select>
          </div>
          <div className="mb-2">
            <label className="block text-xs font-bold text-gray-700 mb-1">Required Access Level:</label>
            <select value={newModule.required_level} onChange={e => setNewModule({ ...newModule, required_level: parseInt(e.target.value, 10) })} className="w-full p-2 text-sm border rounded font-bold">
              <option value={1}>Level 1 — Basic Free Tier</option>
              <option value={2}>Level 2 — Practice Plan</option>
              <option value={4}>Level 4 — Flash Plan</option>
              <option value={6}>Level 6 — Master Plan</option>
            </select>
          </div>
          <div className="relative mb-3">
            <input
              list="dir-autocomplete-create"
              placeholder="Parent Directory (default: /root/modules)"
              value={newModule.parent_directory}
              onChange={e => setNewModule({ ...newModule, parent_directory: e.target.value })}
              className="w-full p-2 text-sm border rounded"
            />
            <datalist id="dir-autocomplete-create">
              <option value="/root/modules" />
            </datalist>
          </div>
          <button onClick={handleCreate} className="w-full bg-blue-600 text-white p-2 rounded text-sm font-medium"><Plus className="inline w-4 h-4 mr-1" /> Create</button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-2">
          {modules.map(m => {
            let missingQids = [];
            if (m && m.question_ids) {
              missingQids = m.question_ids.filter(id => !questions.some(q => q.qid === id));
            }
            return (
            <div key={m.id} className={`p-3 border rounded ${selectedModule?.id === m.id ? 'border-blue-500 bg-blue-50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className="font-bold text-sm truncate">{m.module_name}</div>
              </div>
              <div className="text-xs text-gray-500 mb-3">{m.question_ids?.length || 0} Questions • {m.time_limit_minutes} Mins • <span className="text-purple-600 font-bold">Level {m.required_level ?? 1}</span></div>
              {missingQids.length > 0 && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs font-bold text-red-600">
                  <div className="mb-1">Warning: QIDs assigned but missing from DB:</div>
                  <ul className="list-disc pl-4 font-mono font-normal">
                    {missingQids.map(id => <li key={id}>{id}</li>)}
                  </ul>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const cleaned = (m.question_ids || []).filter(id => !missingQids.includes(id));
                      await supabase.from('modules').update({ question_ids: cleaned }).eq('id', m.id);
                      onUpdate();
                    }}
                    className="mt-2 px-3 py-1.5 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 transition-colors"
                  >
                    Re-adjust Module ({missingQids.length} removed)
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => { setSelectedModuleId(m.id); setReorderMode(false); }} className={`px-3 py-1.5 text-xs rounded font-bold transition-colors ${selectedModule?.id === m.id && !reorderMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>Edit</button>
                <button onClick={() => { setSelectedModuleId(m.id); setReorderMode(true); }} className={`px-3 py-1.5 text-xs rounded font-bold transition-colors ${selectedModule?.id === m.id && reorderMode ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>Reorder</button>
                <a href={`/quiz/${m.id}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300 transition-colors">Preview</a>
                <button
                  onClick={async () => {
                    if (!confirm(`Are you sure you want to delete module "${m.module_name}"? This will also erase it from all assigned questions.`)) return;
                    await supabase.from('modules').delete().eq('id', m.id);
                    await supabase.from('files').delete().eq('reference_id', m.id);
                    await cleanupDeletedModulesFromDb([m.id], supabase);
                    if (selectedModuleId === m.id) setSelectedModuleId(null);
                    onUpdate();
                  }}
                  className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded font-bold hover:bg-red-200 transition-colors ml-auto flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
            )
          })}
        </div>
        </div>
      )}
      <div className={`${forceSelectedModuleId ? 'w-full' : 'w-2/3'} bg-white p-4 overflow-y-auto flex flex-col`}>
        {forceSelectedModuleId && (
           <div className="flex justify-between items-center mb-4 pb-4 border-b shrink-0">
             <h2 className="text-xl font-black text-gray-800">Test Structure Editor</h2>
             <div className="flex items-center gap-2">
               <button onClick={() => setReorderMode(false)} className={`px-4 py-2 rounded font-bold text-sm transition-colors shadow-sm ${!reorderMode ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Edit Content</button>
               <button onClick={() => setReorderMode(true)} className={`px-4 py-2 rounded font-bold text-sm transition-colors shadow-sm ${reorderMode ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Reorder</button>
               <div className="w-px h-8 bg-gray-300 mx-2"></div>
               <button onClick={onBack} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded font-bold text-sm transition-colors shadow-sm flex items-center gap-2"><ArrowLeft className="w-4 h-4"/> Back to Test Structure</button>
             </div>
           </div>
        )}
        <div className="flex-1">
        {selectedModule ? (
          reorderMode ? (
            <ModuleReorderEditor module={selectedModule} questions={questions} onUpdate={onUpdate} supabase={supabase} setPreviewQuestion={setPreviewQuestion} />
          ) : (
            <div>
              <div className="flex flex-col gap-4 mb-6 border-b pb-4">
                <h3 className="font-bold text-lg">Managing: {selectedModule.module_name}</h3>
                <ModuleSettingsEditor module={selectedModule} onUpdate={onUpdate} supabase={supabase} allModules={modules} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 mb-6 border-b pb-4">
                {test && setEditingModuleId ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: test.rw_base_module_id, label: '1. RW Base' },
                      { id: test.rw_easier_module_id, label: '2. RW Easy' },
                      { id: test.rw_harder_module_id, label: '3. RW Hard' },
                      { id: test.math_base_module_id, label: '4. Math Base' },
                      { id: test.math_easier_module_id, label: '5. Math Easy' },
                      { id: test.math_harder_module_id, label: '6. Math Hard' }
                    ].map(mod => mod.id ? (
                      <button 
                        key={mod.id}
                        onClick={() => {
                          setEditingModuleId(mod.id);
                          setSelectedModuleId(mod.id);
                        }}
                        className={`px-4 py-2 border rounded font-bold text-sm transition-colors shadow-sm flex items-center justify-center min-w-[100px] ${selectedModule.id === mod.id ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}`}
                      >
                        {mod.label}
                      </button>
                    ) : null)}
                  </div>
                ) : <div />}

                <button
                  onClick={() => setActiveView(v => v === 'bank' ? 'assigned' : 'bank')}
                  className={`px-5 py-2 border rounded font-bold text-sm transition-all shadow-sm flex items-center gap-2 ml-auto ${activeView === 'assigned' ? 'bg-purple-600 text-white border-purple-700 ring-2 ring-purple-300' : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-300'}`}
                >
                  {activeView === 'assigned' ? (
                    <>Assign Questions (Question Bank)</>
                  ) : (
                    <>See Assigned ({selectedModule.question_ids?.length || 0})</>
                  )}
                </button>
              </div>
              {activeView === 'bank' ? (
                <>
                  <div className="flex flex-col gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Search by QID or Context..."
                  value={filter.search}
                  onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                  className="w-full p-2 border rounded text-sm bg-white shadow-sm"
                />
                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg border shadow-sm">
                  <select onChange={(e) => setFilter({ ...filter, subject: e.target.value })} className="w-full p-2 border rounded text-sm bg-white">
                    <option value="">All Subjects</option>
                    <option value="Math">Math</option>
                    <option value="English">English</option>
                  </select>
                  <select onChange={(e) => setFilter({ ...filter, difficulty: e.target.value })} className="w-full p-2 border rounded text-sm bg-white">
                    <option value="">All Difficulties</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                  <select onChange={(e) => setFilter({ ...filter, topic: e.target.value })} className="w-full p-2 border rounded text-sm bg-white">
                    <option value="">All Topics</option>
                    {uniqueTopics.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select value={filter.assignment} onChange={(e) => setFilter({ ...filter, assignment: e.target.value })} className="w-full p-2 border rounded text-sm bg-white">
                    <option value="All">All Status</option>
                    <option value="Assigned">Assigned (Any)</option>
                    <option value="Unassigned">Unassigned</option>
                  </select>
                  <select onChange={(e) => setFilter({ ...filter, hasImage: e.target.value })} value={filter.hasImage} className="w-full p-2 border rounded text-sm bg-white">
                    <option value="All">All Image Status</option>
                    <option value="Yes">Has Image</option>
                    <option value="No">No Image</option>
                  </select>
                  <select onChange={(e) => setFilter({ ...filter, source: e.target.value })} value={filter.source} className="w-full p-2 border rounded text-sm bg-white">
                    <option value="">All Sources</option>
                    {uniqueSources.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-1 px-1">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sort by:</span>
                  <select value={filter.sort} onChange={(e) => setFilter({ ...filter, sort: e.target.value })} className="flex-1 p-2 border rounded text-sm bg-gray-50">
                    <option value="Newest">Newest First</option>
                    <option value="Oldest">Oldest First</option>
                    <option value="Least Assigned">Least Assigned</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between items-center mb-2 text-sm font-medium text-gray-600">
                <span>Filtered: {filteredQuestions.length} | Selected: {selectedQuestions.length}</span>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedQuestions(filteredQuestions.map(q => q.qid))} className="px-2 py-1 bg-gray-100 border rounded hover:bg-gray-200 text-xs transition-colors">Select All</button>
                  <button onClick={() => setSelectedQuestions([])} className="px-2 py-1 bg-gray-100 border rounded hover:bg-gray-200 text-xs transition-colors">Deselect All</button>
                </div>
              </div>

              {selectedQuestions.length > 0 && (
                <div className="flex gap-2 mb-2">
                  <button onClick={() => handleBulkToggle(true)} className="flex-1 px-3 py-2 bg-green-600 text-white rounded font-bold text-sm hover:bg-green-700 transition-colors shadow-sm">
                    Assign {selectedQuestions.length} Selected
                  </button>
                  <button onClick={() => handleBulkToggle(false)} className="flex-1 px-3 py-2 bg-red-600 text-white rounded font-bold text-sm hover:bg-red-700 transition-colors shadow-sm">
                    Remove {selectedQuestions.length} Selected
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {paginatedQuestions.map(q => {
                  const isAssigned = selectedModule.question_ids?.some(id => String(id) === String(q.qid)) || (q.assigned_modules || []).some(id => String(id) === String(selectedModule.id))
                  const assignedCount = (q.assigned_modules || []).length
                  return (
                    <div key={q.qid} className="flex items-center justify-between p-3 border rounded bg-gray-50">
                      <div className="flex items-center gap-3 w-3/4">
                        <div className="pt-0.5 shrink-0">
                          <input
                            type="checkbox"
                            checked={selectedQuestions.some(id => String(id) === String(q.qid))}
                            onChange={(e) => {
                              e.stopPropagation();
                              const checked = e.target.checked;
                              setSelectedQuestions(prev => checked ? [...prev, q.qid] : prev.filter(id => String(id) !== String(q.qid)));
                            }}
                            className="w-4 h-4 cursor-pointer text-blue-600 rounded border-gray-300"
                          />
                        </div>
                        <div className="flex flex-col gap-1 overflow-hidden">
                          <div className="text-sm truncate font-bold flex items-center gap-2">
                            {q.qid}
                            {assignedCount > 0 && (
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded border border-green-200 font-medium text-[10px] uppercase">
                                Assigned to {assignedCount} Module{assignedCount !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 font-normal truncate">({q.topic_tag} - {q.subject_tag} - {q.difficulty})</div>
                        </div>
                      </div>
                      <button onClick={() => toggleQuestion(selectedModule, q.qid)} className={`px-3 py-1 text-xs rounded font-medium shrink-0 ${isAssigned ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {isAssigned ? 'Remove' : 'Assign'}
                      </button>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between items-center pt-4 border-t mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Show:</span>
                  <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="p-1 border rounded bg-gray-50">
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50 transition-colors">Prev</button>
                  {Array.from({ length: totalPages || 1 }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(currentPage - p) <= 1)
                    .map((p, i, arr) => (
                      <div key={p} className="flex items-center">
                        {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-gray-400 text-xs">...</span>}
                        <button
                          onClick={() => setCurrentPage(p)}
                          className={`px-2 py-1 border rounded text-xs transition-colors ${currentPage === p ? 'bg-blue-600 text-white font-bold border-blue-600' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
                        >
                          {p}
                        </button>
                      </div>
                    ))}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages || totalPages === 0} className="px-2 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50 transition-colors">Next</button>
                </div>
              </div>
            </>
          ) : (
              /* Box showing all questions assigned to this module */
              <div className="pt-2">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-black text-md text-gray-800 flex items-center gap-2">
                    <span>Assigned Questions inside "{selectedModule.module_name}"</span>
                    <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                      {selectedModule.question_ids?.length || 0} Total
                    </span>
                  </h4>
                  {selectedModule.question_ids && selectedModule.question_ids.length > 0 && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Clear all ${selectedModule.question_ids.length} questions from "${selectedModule.module_name}"?`)) return;
                        await handleClearAllAssigned(selectedModule);
                      }}
                      className="text-xs font-bold text-red-600 hover:text-red-800 transition-colors"
                    >
                      Clear All Assigned
                    </button>
                  )}
                </div>

                {!selectedModule.question_ids || selectedModule.question_ids.length === 0 ? (
                  <div className="p-8 border-2 border-dashed border-gray-200 rounded-lg text-center text-gray-400 text-sm font-medium">
                    No questions assigned to this module yet. Use the question bank above to assign some!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto pr-1 border border-gray-200 rounded-lg p-2 bg-gray-50">
                    {selectedModule.question_ids.map((qid, index) => {
                      const assignedQ = questions.find(q => String(q.qid) === String(qid));
                      return (
                        <div key={qid} className="p-3 bg-white border border-gray-200 rounded shadow-sm flex items-center justify-between gap-4 hover:border-blue-300 transition-colors">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="w-7 h-7 shrink-0 bg-blue-600 text-white font-bold text-xs rounded-full flex items-center justify-center">
                              #{index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-xs text-gray-900 truncate">{assignedQ ? assignedQ.qid : qid}</span>
                                {assignedQ && (
                                  <>
                                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">{assignedQ.subject_tag || 'N/A'}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">{assignedQ.difficulty || 'Mixed'}</span>
                                  </>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 truncate font-normal">
                                {assignedQ ? (assignedQ.question || assignedQ.context || 'No question text preview') : '⚠️ Question details not found in loaded question bank'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {assignedQ && (
                              <button
                                onClick={() => setPreviewQuestion(assignedQ)}
                                className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded transition-colors"
                              >
                                Preview
                              </button>
                            )}
                            <button
                              onClick={() => toggleQuestion(selectedModule, qid)}
                              className="px-2.5 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded transition-colors flex items-center gap-1"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">Select "Edit" or "Reorder" on a module to manage its questions.</div>
        )}
        </div>
      </div>
    </div>
  )
}

export function BulkUploader({ 
  onUploadComplete, 
  supabase,
  customActions = {},
  customTitle = "Bulk Uploader",
  customSubtitle = "Staging & Validation Engine"
}) {
  const checkExistingQids = customActions.checkExistingQidsAction || checkExistingQidsAction;
  const deleteQuestion = customActions.deleteQuestionAction || deleteQuestionAction;
  const checkDuplicates = customActions.checkDuplicatesAction || checkDuplicatesAction;
  const fetchQuestionByQid = customActions.fetchQuestionByQidAction || fetchQuestionByQidAction;
  const processBulkUpload = customActions.processBulkUploadAction || processBulkUploadAction;
  const [jsonFile, setJsonFile] = useState(null)
  const [secondaryJsonFile, setSecondaryJsonFile] = useState(null)
  const [imageFiles, setImageFiles] = useState([])
  const [logs, setLogs] = useState([])
  const [isValidated, setIsValidated] = useState(false)
  const [redundancyPassed, setRedundancyPassed] = useState(false)
  const [summary, setSummary] = useState(null)
  const [serverImageHashes, setServerImageHashes] = useState({})
  const [parsedJsonData, setParsedJsonData] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [currentConflict, setCurrentConflict] = useState(null)
  const [resolvedConflicts, setResolvedConflicts] = useState({ db: 0, json: 0 })
  const [excludedQids, setExcludedQids] = useState(new Set())
  const [restructuredQids, setRestructuredQids] = useState(new Set())
  const [deletedDbQids, setDeletedDbQids] = useState(new Set())

  const handlePrimaryJsonDrop = (e) => {
    const file = e.target.files[0];
    if (file) {
      setJsonFile(file);
      resetValidation();
    }
  }

  const handleSecondaryJsonDrop = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSecondaryJsonFile(file);
      resetValidation();
    }
  }

  const handleImagesAdd = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles(prev => [...prev, ...files]);
    resetValidation();
  }

  const removeImage = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    resetValidation();
  }

  const resetValidation = () => {
    setLogs([]);
    setIsValidated(false);
    setRedundancyPassed(false);
    setSummary(null);
    setParsedJsonData(null);
    setIsValidating(false);
    setReviewMode(false);
    setCurrentConflict(null);
    setResolvedConflicts({ db: 0, json: 0 });
    setExcludedQids(new Set());
    setRestructuredQids(new Set());
    setDeletedDbQids(new Set());
  }

  const runRedundancyCheck = () => {
    if (!jsonFile || !secondaryJsonFile) {
      setLogs([{ type: 'error', msg: 'Both Primary and Secondary JSON files must be staged.' }]);
      return;
    }

    setIsValidating(true);
    setLogs([{ type: 'info', msg: 'Starting Redundancy Check: Phase 0 (Sequential QID Checker)...' }]);

    const readPrimary = new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(jsonFile);
    });

    const readSecondary = new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(secondaryJsonFile);
    });

    Promise.all([readPrimary, readSecondary]).then(async ([primaryText, secondaryText]) => {
      try {
        const sanitizedPrimary = primaryText.replace(/(?<!\\)\\(?!["\\/bfnrt])/g, '\\\\');
        const sanitizedSecondary = secondaryText.replace(/(?<!\\)\\(?!["\\/bfnrt])/g, '\\\\');

        const primaryData = JSON.parse(sanitizedPrimary);
        const secondaryData = JSON.parse(sanitizedSecondary);

        if (!Array.isArray(primaryData) || !Array.isArray(secondaryData)) {
          throw new Error("Both JSON files must be arrays of questions.");
        }

        // Phase 0: Sequential QID Checker
        let sequenceWarnings = [];
        const validQids = [];
        let hasPatternWarning = false;

        for (let q of primaryData) {
          const qidStr = q.qid || '';
          if (/q\d+$/i.test(qidStr)) {
            validQids.push(qidStr);
          } else if (!hasPatternWarning) {
            sequenceWarnings.push({ type: 'warning', msg: `[WARNING] Some questions do not follow the 'qXXXX' suffix pattern. Sequence checks may be incomplete.` });
            hasPatternWarning = true;
          }
        }

        if (validQids.length > 0) {
          let maxPadding = 4; // default to 4
          const nums = validQids.map(qid => {
            const match = qid.match(/q(\d+)$/i);
            const numStr = match[1];
            if (numStr.length > maxPadding) maxPadding = numStr.length;
            return parseInt(numStr, 10);
          }).sort((a, b) => a - b);

          if (nums.length > 0) {
            if (nums[0] !== 1) {
              sequenceWarnings.push({ type: 'warning', msg: `[WARNING] The sequence does not start with q${String(1).padStart(maxPadding, '0')}. Did you miss the beginning of the set?` });
            }

            for (let i = 0; i < nums.length - 1; i++) {
              let current = nums[i];
              let next = nums[i + 1];
              if (next > current + 1) {
                for (let missing = current + 1; missing < next; missing++) {
                  sequenceWarnings.push({ type: 'warning', msg: `[WARNING] Hey, did you miss q${String(missing).padStart(maxPadding, '0')}?` });
                }
              }
            }
          }
        }

        if (sequenceWarnings.length > 0) {
          setLogs(prev => [...prev, ...sequenceWarnings]);
        }

        // Fatal DB QID Existence Check
        setLogs(prev => [...prev, { type: 'info', msg: 'Checking database for existing QIDs...' }]);
        const allPrimaryQids = primaryData.map(q => {
          let newQid = q.qid || '';
          const qidRegex = /(.*?[^_])(q\d+)$/i;
          if (qidRegex.test(newQid)) {
            newQid = newQid.replace(qidRegex, '$1_$2');
          }
          return newQid;
        }).filter(Boolean);

        const qidCheckRes = await checkExistingQids(allPrimaryQids);
        if (qidCheckRes.error) {
          setLogs(prev => [...prev, { type: 'error', msg: `DB QID Check Error: ${qidCheckRes.error}` }]);
          setIsValidating(false);
          return;
        }

        if (qidCheckRes.existingQids && qidCheckRes.existingQids.length > 0) {
          const qidErrors = qidCheckRes.existingQids.map(qid => ({ type: 'error', msg: `[FATAL ERROR] QID Overwrite Prevented: The QID [${qid}] already exists in the database. You must fix this QID or manually delete the DB version before proceeding.` }));
          setLogs(prev => [...prev, ...qidErrors]);
          setIsValidating(false);
          return;
        }

        // Phase 1A - Absolute First Step (Batch Asset Validation)
        setLogs(prev => [...prev, { type: 'info', msg: 'Starting Phase 1A (Batch Asset Validation)...' }]);
        let imageErrors = [];
        const stagedImageNames = imageFiles.map(f => f.name);

        const getOptionImages = (opt) => {
          if (!opt || typeof opt !== 'string') return [];
          const cleanOpt = opt.trim();
          if (cleanOpt.includes('||')) {
            return cleanOpt.split('||').slice(1).map(s => s.trim()).filter(Boolean);
          } else if (cleanOpt.match(/\.(png|svg|jpg|jpeg)(\?.*)?$/i) && !cleanOpt.includes(' ')) {
            return [cleanOpt];
          }
          return [];
        };

        for (let q of primaryData) {
          const reqImages = [];
          if (q.image_url) reqImages.push(q.image_url);
          ['a','b','c','d'].forEach(l => {
             const imgs = getOptionImages(q[`option_${l}`] || q[`option_${l.toUpperCase()}`]);
             reqImages.push(...imgs);
          });
          const expImgs = getOptionImages(q.correct_answer_explanation);
          reqImages.push(...expImgs);
          
          for (let img of reqImages) {
            if (!stagedImageNames.includes(img)) {
              imageErrors.push({ type: 'error', msg: `Missing Image: QID [${q.qid}] requires "${img}".` });
            }
          }
        }

        const jsonImages = primaryData.flatMap(q => {
          const imgs = [];
          if (q.image_url) imgs.push(q.image_url);
          ['a','b','c','d'].forEach(l => {
             const optionImgs = getOptionImages(q[`option_${l}`] || q[`option_${l.toUpperCase()}`]);
             optionImgs.forEach(i => imgs.push(i));
          });
          const expImgs = getOptionImages(q.correct_answer_explanation);
          expImgs.forEach(i => imgs.push(i));
          return imgs;
        }).filter(Boolean);

        for (let imgName of stagedImageNames) {
          if (!jsonImages.includes(imgName)) {
            imageErrors.push({ type: 'error', msg: `Orphaned Image: "${imgName}" was uploaded but is not required.` });
          }
        }

        if (imageErrors.length > 0) {
          setLogs(prev => [...prev, ...imageErrors]);
          setIsValidating(false);
          return;
        }

        setLogs(prev => [...prev, { type: 'info', msg: 'Phase 1A Passed. Starting Phase 1B (Primary Sanity Check)...' }]);

        // Phase 1B: Primary Sanity Check
        for (let q of primaryData) {
          if (q.correct_answer_explanation === "PENDING") {
            setLogs(prev => [...prev, { type: 'error', msg: `Phase 1B Error: QID [${q.qid}]: Explanation is PENDING.` }]);
            setIsValidating(false);
            return;
          }

          const qType = q.question_type ? q.question_type.toUpperCase() : 'MCQ'; // default MCQ

          if (qType === 'MCQ') {
            if (!['A', 'B', 'C', 'D'].includes(q.correct_answer)) {
              setLogs(prev => [...prev, { type: 'error', msg: `Phase 1B Error: QID [${q.qid}]: correct_answer must be A, B, C, or D for MCQ.` }]);
              setIsValidating(false);
              return;
            }
            if (q.option_a === "" || q.option_b === "" || q.option_c === "" || q.option_d === "") {
              setLogs(prev => [...prev, { type: 'error', msg: `Phase 1B Error: QID [${q.qid}]: MCQ options cannot be empty strings.` }]);
              setIsValidating(false);
              return;
            }
          } else if (qType === 'SPR') {
            // Note: correct_answer can be empty ("") if pending, or a string like "3.5" or "7/2"
            if ((q.option_a && q.option_a !== "") || (q.option_b && q.option_b !== "") || (q.option_c && q.option_c !== "") || (q.option_d && q.option_d !== "")) {
              setLogs(prev => [...prev, { type: 'error', msg: `Phase 1B Error: QID [${q.qid}]: All options must be empty strings or null for SPR.` }]);
              setIsValidating(false);
              return;
            }
          }
        }

        setLogs(prev => [...prev, { type: 'info', msg: 'Phase 1B Passed. Starting Phase 2 (Cross-Validation)...' }]);

        // Phase 2: Cross-Validation
        let phase2Errors = [];
        for (let pQ of primaryData) {
          const sQ = secondaryData.find(s => s.qid === pQ.qid);
          if (!sQ) {
            phase2Errors.push({ type: 'error', msg: `Phase 2 Error: QID [${pQ.qid}] found in Primary but missing in Secondary JSON.` });
            continue;
          }

          const fieldsToCompare = ['context', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer'];

          for (let field of fieldsToCompare) {
            const pVal = pQ[field] || '';
            const sVal = sQ[field] || '';
            if (pVal !== sVal) {
              phase2Errors.push({ type: 'error', msg: `Redundancy Mismatch for QID [${pQ.qid}]: The field [${field}] says "${pVal}" in Primary but says "${sVal}" in Secondary.` });
            }
          }
        }

        if (phase2Errors.length > 0) {
          setLogs(prev => [...prev, ...phase2Errors]);
          setIsValidating(false);
          return;
        }

        setLogs(prev => [
          ...prev,
          { type: 'success', msg: 'Redundancy Check Passed! You may now proceed to Check Validity.' },
          { type: 'info', msg: `[INFO] Total ${primaryData.length} questions loaded for next check.` }
        ]);
        setRedundancyPassed(true);
        setIsValidating(false);

      } catch (err) {
        setLogs(prev => [...prev, { type: 'error', msg: `Redundancy Check Failed: ${err.message}` }]);
        setIsValidating(false);
      }
    }).catch(err => {
      setLogs(prev => [...prev, { type: 'error', msg: `File Read Error: ${err.message}` }]);
      setIsValidating(false);
    });
  }

  const handleDiscard = (qidToDiscard, conflictType) => {
    const newExcluded = new Set(excludedQids);
    newExcluded.add(qidToDiscard);
    setExcludedQids(newExcluded);

    const newResolved = {
      ...resolvedConflicts,
      [conflictType === 'DB' ? 'db' : 'json']: resolvedConflicts[conflictType === 'DB' ? 'db' : 'json'] + 1
    };
    setResolvedConflicts(newResolved);

    setReviewMode(false);
    setCurrentConflict(null);

    // Auto-resume validation
    setTimeout(() => {
      runValidation(newExcluded, newResolved, restructuredQids, deletedDbQids);
    }, 100);
  }

  const handleDeleteDbQuestion = async (dbQuestionQid) => {
    setIsValidating(true); // temporary loading state

    const res = await deleteQuestion(dbQuestionQid);
    if (res.error) {
      setLogs(prev => [...prev, { type: 'error', msg: `[FATAL ERROR] Failed to delete existing database question: ${res.error}` }]);
      setIsValidating(false);
      setReviewMode(false);
      setCurrentConflict(null);
      return;
    }

    setLogs(prev => [...prev, { type: 'success', msg: `[SUCCESS] Deleted old QID ${dbQuestionQid} from database to make room for new upload.` }]);

    const newDeletedDb = new Set(deletedDbQids);
    newDeletedDb.add(dbQuestionQid);
    setDeletedDbQids(newDeletedDb);

    const newResolved = {
      ...resolvedConflicts,
      db: resolvedConflicts.db + 1
    };
    setResolvedConflicts(newResolved);

    setReviewMode(false);
    setCurrentConflict(null);

    // Auto-resume validation
    setTimeout(() => {
      runValidation(excludedQids, newResolved, restructuredQids, newDeletedDb);
    }, 100);
  }

  const handleRestructureHash = async (q) => {
    const newRestructured = new Set(restructuredQids);
    newRestructured.add(q.qid);
    setRestructuredQids(newRestructured);

    setLogs(prev => [...prev, { type: 'info', msg: `[INFO] Restructured Hash for QID ${q.qid} using Extended Formula.` }]);

    // Increment the appropriate counter based on conflict type
    const newResolved = {
      ...resolvedConflicts,
      [currentConflict.type === 'DB' ? 'db' : 'json']: resolvedConflicts[currentConflict.type === 'DB' ? 'db' : 'json'] + 1
    };
    setResolvedConflicts(newResolved);

    setReviewMode(false);
    setCurrentConflict(null);

    // Auto-resume validation to re-check the new hash
    setTimeout(() => {
      runValidation(excludedQids, newResolved, newRestructured, deletedDbQids);
    }, 100);
  }

  const runValidation = (latestExcluded = excludedQids, latestResolved = resolvedConflicts, latestRestructured = restructuredQids, latestDeletedDb = deletedDbQids) => {
    if (!jsonFile) {
      setLogs([{ type: 'error', msg: 'No JSON file staged.' }]);
      return;
    }

    setIsValidating(true);
    setLogs([{ type: 'info', msg: 'Starting validation...' }]);

    const reader = new FileReader();
    reader.onerror = () => {
      setLogs(prev => [...prev, { type: 'error', msg: 'FileReader Error: Could not read the file from disk. Please re-select the file.' }]);
      setIsValidated(false);
      setIsValidating(false);
    };

    reader.onload = async (e) => {
      try {
        setLogs(prev => [...prev, { type: 'info', msg: 'File loaded in memory. Parsing and sanitizing JSON...' }]);

        const rawText = e.target.result;
        const sanitizedText = rawText.replace(/(?<!\\)\\(?!["\\/bfnrt])/g, '\\\\');
        const rawData = JSON.parse(sanitizedText);
        if (!Array.isArray(rawData)) throw new Error("JSON must be an array of questions.");

        let newLogs = [];
        let hasError = false;

        setLogs(prev => [...prev, { type: 'info', msg: `JSON parsed (${rawData.length} items). Verifying formatting & generating hashes...` }]);

        let newImageFiles = [...imageFiles];
        let currentImageHashes = serverImageHashes;

        if (Object.keys(currentImageHashes).length === 0 && newImageFiles.length > 0) {
          setLogs(prev => [...prev, { type: 'info', msg: 'Uploading images to server for pixel-level hash generation...' }]);
          const formData = new FormData();
          newImageFiles.forEach(file => formData.append('images', file));
          const res = await calculateImageHashesAction(formData);
          if (res.error) {
             setLogs(prev => [...prev, { type: 'error', msg: `Failed to calculate image hashes: ${res.error}` }]);
             setIsValidated(false);
             setIsValidating(false);
             return;
          }
          currentImageHashes = res.imageHashes || {};
          setServerImageHashes(currentImageHashes);
        }

        const seenQids = new Set();
        let data = [];

        for (let q of rawData) {
          let newQid = q.qid;
          const qidRegex = /(.*?[^_])(q\d+)$/i;
          if (qidRegex.test(newQid)) {
            newQid = newQid.replace(qidRegex, '$1_$2');
          }

          if (latestExcluded.has(newQid)) continue;

          if (seenQids.has(newQid)) {
            setLogs(prev => [...prev, { type: 'error', msg: `Duplicate QID found in JSON: The QID [${newQid}] appears multiple times in this file. This will cause a batch-overwrite collision.` }]);
            setIsValidated(false);
            setIsValidating(false);
            return;
          }
          seenQids.add(newQid);

          let newImageUrl = q.image_url;
          if (q.image_url) {
            if (qidRegex.test(newImageUrl)) {
              const correctedImageUrl = newImageUrl.replace(qidRegex, '$1_$2');
              const fileIndex = newImageFiles.findIndex(f => f.name === newImageUrl);
              if (fileIndex !== -1) {
                const oldFile = newImageFiles[fileIndex];
                const renamedFile = new File([oldFile], correctedImageUrl, { type: oldFile.type });
                newImageFiles[fileIndex] = renamedFile;
              }
              newImageUrl = correctedImageUrl;
            }
          }

          if (latestRestructured.has(newQid)) {
            q.is_restructured_hash = true;
          }
          
          const oldImageUrl = q.image_url; // capture original before renaming
          
          // Determine the image_hash
          let currentImageHash = null;
          if (oldImageUrl && currentImageHashes[oldImageUrl]) {
            currentImageHash = currentImageHashes[oldImageUrl];
          }

          // Always calculate basic hash
          const basicFingerprint = getQuestionHashString(q, currentImageHashes, false);
          const basicPrefix = getHashPrefix(q, false);
          const basicOptionsHash = basicFingerprint !== '|||' && basicFingerprint !== '|' ? basicPrefix + (await generateHash(basicFingerprint)) : null;
          
          let allOptionsHashes = [basicOptionsHash].filter(Boolean);
          let finalBasicOptionsHash = basicOptionsHash;
          if ((q.question_type ? q.question_type.toUpperCase() : 'MCQ') === 'SPR' && !q.is_restructured_hash) {
            const sprHashes = await getSprAnswerHashes(q, false);
            if (sprHashes.length > 0) {
              allOptionsHashes = sprHashes;
              finalBasicOptionsHash = sprHashes[0];
            }
          }
          
          let restructuredOptionsHash = null;
          if (q.is_restructured_hash) {
            const restFingerprint = getQuestionHashString(q, currentImageHashes, true);
            const restPrefix = getHashPrefix(q, true);
            restructuredOptionsHash = restFingerprint !== '|||' && restFingerprint !== '|' ? restPrefix + (await generateHash(restFingerprint)) : null;
          }

          if (currentImageHash) currentImageHash = basicPrefix + currentImageHash;

          data.push({
            ...q,
            qid: newQid,
            image_url: newImageUrl,
            options_hash: finalBasicOptionsHash,
            all_options_hashes: allOptionsHashes,
            restructured_hash: restructuredOptionsHash,
            image_hash: currentImageHash
          });
        }

        setImageFiles(newImageFiles);

        // 2. Internal JSON Duplicate Check (Hash)
        const optionsHashMap = {};
        const restructuredHashMap = {};
        const imageHashMap = {};
        
        for (let q of data) {
          let matchedQid = null;
          let conflictReason = null;
          
          if (!q.is_restructured_hash && (q.all_options_hashes?.length > 0 || q.options_hash)) {
             const hashesToCheck = q.all_options_hashes?.length > 0 ? q.all_options_hashes : [q.options_hash];
             let matchFound = false;
             for (const h of hashesToCheck) {
               if (optionsHashMap[h]) {
                   matchedQid = optionsHashMap[h];
                   conflictReason = 'OPTIONS_HASH';
                   matchFound = true;
                   break;
               }
             }
             if (!matchFound) {
               for (const h of hashesToCheck) {
                 optionsHashMap[h] = q.qid;
               }
             }
          }

          if (q.is_restructured_hash && q.restructured_hash) {
             if (restructuredHashMap[q.restructured_hash]) {
                 matchedQid = restructuredHashMap[q.restructured_hash];
                 conflictReason = 'RESTRUCTURED_HASH';
             }
             else restructuredHashMap[q.restructured_hash] = q.qid;
          }
          
          if (q.image_hash && !matchedQid) {
             if (imageHashMap[q.image_hash]) {
                 matchedQid = imageHashMap[q.image_hash];
                 conflictReason = 'IMAGE_HASH';
             }
             else imageHashMap[q.image_hash] = q.qid;
          }
          
          if (matchedQid) {
            setCurrentConflict({
              type: 'JSON',
              reason: conflictReason,
              q1: data.find(d => d.qid === matchedQid),
              q2: q
            });
            setReviewMode(true);
            setIsValidated(false);
            setIsValidating(false);
            return;
          }
        }

        if (hasError) {
          setLogs(prev => [...prev, ...newLogs]);
          setIsValidated(false);
          setIsValidating(false);
          return;
        }

        // 5. Database Duplicate Check
        setLogs(prev => [...prev, { type: 'info', msg: 'Checking database for duplicates...' }]);
        const payloadToCheck = data.map(q => ({ 
          qid: q.qid, 
          options_hash: q.options_hash, 
          all_options_hashes: q.all_options_hashes,
          image_hash: q.image_hash,
          subject_tag: q.subject_tag, 
          topic_tag: q.topic_tag,
          question_type: q.question_type,
          is_restructured_hash: q.is_restructured_hash || false
        }));

        const dbCheck = await checkDuplicates(payloadToCheck);
        if (dbCheck.error) {
          setLogs(prev => [...prev, { type: 'error', msg: `DB Check Error: ${dbCheck.error}` }]);
          setIsValidated(false);
          setIsValidating(false);
          return;
        }

        if (dbCheck.duplicates && dbCheck.duplicates.length > 0) {
          const firstDup = dbCheck.duplicates[0];
          const { data: dbQ } = await fetchQuestionByQid(firstDup.dbQid);

          if (dbQ) {
            setCurrentConflict({
              type: 'DB',
              reason: firstDup.reason,
              q1: data.find(d => d.qid === firstDup.uploadQid),
              q2: dbQ
            });
            setReviewMode(true);
            setIsValidated(false);
            setIsValidating(false);
            return;
          } else {
            setLogs(prev => [...prev, { type: 'error', msg: `Failed to fetch DB conflict details for QID ${firstDup.dbQid}` }]);
            setIsValidated(false);
            setIsValidating(false);
            return;
          }
        }

        // Success Summary
        const totalSolved = latestResolved.db + latestResolved.json;
        const qidRegex = /(.*?[^_])(q\d+)$/i;
        const excludedWithImages = rawData.filter(q => {
          let checkQid = q.qid;
          if (qidRegex.test(checkQid)) checkQid = checkQid.replace(qidRegex, '$1_$2');
          return latestExcluded.has(checkQid) && q.image_url;
        }).length;

        let extraLogs = [];

        if (latestDeletedDb && latestDeletedDb.size > 0) {
          latestDeletedDb.forEach(dbQid => {
            extraLogs.push({ type: 'warning', msg: `[WARNING] Database Deletion Executed: ${dbQid}` });
          });
        }

        const allMatchPattern = rawData.every(q => /q\d+$/i.test(q.qid || ''));
        if (allMatchPattern && latestExcluded && latestExcluded.size > 0) {
          const formattedExcluded = Array.from(latestExcluded).map(qid => {
            const match = qid.match(/(q\d+)$/i);
            return match ? match[1] : qid;
          });
          extraLogs.push({ type: 'warning', msg: `[WARNING] JSON Ignored List: ${formattedExcluded.join(', ')}` });
        }

        if (totalSolved > 0) {
          setLogs(prev => [
            ...prev,
            ...extraLogs,
            { type: 'success', msg: `${totalSolved} duplication conflicts solved \n(${excludedWithImages} discarded questions had images attached) \n|| ${latestResolved.db} DataBase conflicts ||\n|| ${latestResolved.json} JSON conflicts     || \n             \n${data.length} questions ready for upload.` }
          ]);
        } else {
          setLogs(prev => [
            ...prev,
            ...extraLogs,
            { type: 'success', msg: 'Validation Passed. No errors, orphans, or duplicates.' }
          ]);
        }

        let mathCount = 0;
        let englishCount = 0;
        let imagesCount = 0;
        let topics = {};

        data.forEach(q => {
          if (q.subject_tag?.toLowerCase() === 'math') mathCount++;
          if (q.subject_tag?.toLowerCase() === 'english') englishCount++;
          if (q.image_url) imagesCount++;
          if (q.topic_tag) {
            topics[q.topic_tag] = (topics[q.topic_tag] || 0) + 1;
          }
        });

        setSummary({
          total: data.length,
          english: englishCount,
          math: mathCount,
          imagesCount: imagesCount,
          topics: topics
        });
        setParsedJsonData(data);
        setIsValidated(true);
      } catch (err) {
        setLogs(prev => [...prev, { type: 'error', msg: `JSON Parse Error: The file is structurally corrupted beyond LaTeX auto-repair. Details: ${err.message}` }]);
        setIsValidated(false);
      }
      setIsValidating(false);
    };

    try {
      reader.readAsText(jsonFile);
    } catch (e) {
      setLogs(prev => [...prev, { type: 'error', msg: `Execution Error: ${e.message}` }]);
      setIsValidating(false);
    }
  }

  const handleUpload = async () => {
    if (!isValidated || !parsedJsonData) return;
    setIsUploading(true);
    setLogs(prev => [...prev, { type: 'info', msg: 'Initiating atomic upload...' }]);

    const formData = new FormData();

    // Convert the massive JSON string to a Blob so Next.js parses it as a file to bypass the 1MB field limit!
    const jsonBlob = new Blob([JSON.stringify(parsedJsonData)], { type: 'application/json' });
    formData.append('json_file', jsonBlob, 'payload.json');

    // Only upload images that are actively used by the final, validated JSON data
    const getOptionImage = (opt) => {
      if (!opt || typeof opt !== 'string') return null;
      const cleanOpt = opt.trim();
      if (cleanOpt.includes('||')) {
        return cleanOpt.split('||')[1].trim();
      } else if (cleanOpt.match(/\.(png|svg|jpg|jpeg)(\?.*)?$/i) && !cleanOpt.includes(' ')) {
        return cleanOpt;
      }
      return null;
    };

    const activeImageUrls = parsedJsonData.flatMap(q => {
      const imgs = [];
      if (q.image_url) imgs.push(q.image_url);
      ['a','b','c','d'].forEach(l => {
         const img = getOptionImage(q[`option_${l}`] || q[`option_${l.toUpperCase()}`]);
         if (img) imgs.push(img);
      });
      return imgs;
    }).filter(Boolean);

    imageFiles.forEach(file => {
      if (activeImageUrls.includes(file.name)) {
        formData.append('images', file);
      }
    });

    try {
      const res = await processBulkUpload(formData);
      if (res.error) {
        setLogs(prev => [...prev, { type: 'error', msg: `Upload Failed: ${res.error}` }]);
      } else {
        setLogs(prev => [...prev, { type: 'success', msg: `Upload Complete! ${res.count} questions inserted.` }]);
        // Reset UI
        setJsonFile(null);
        setImageFiles([]);
        setIsValidated(false);
        setSummary(null);
        onUploadComplete();
      }
    } catch (err) {
      setLogs(prev => [...prev, { type: 'error', msg: `Exception: ${err.message}` }]);
    }
    setIsUploading(false);
  }

  const renderQuestionAndOptions = (q) => (
    <>
      <div className="prose prose-2xl max-w-none text-black font-medium mb-10 leading-relaxed">
        <RichText content={q.question} />
      </div>
      <div className="space-y-3 w-full">
        {['a', 'b', 'c', 'd'].map((letter) => {
          const opt = q[`option_${letter}`] || q[`option_${letter.toUpperCase()}`]
          if (!opt) return null
          const cleanOpt = stripOptionLetter(opt)
          return (
            <div key={letter} className="relative flex items-center gap-4 w-full group">
              <div className="flex-1 text-left pr-12 pl-4 py-2 rounded-lg border-2 transition-all flex items-center text-2xl font-medium border-gray-400 bg-white shadow-sm">
                <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full border-2 mr-4 font-bold border-gray-500 text-gray-700 uppercase">
                  {letter}
                </div>
                <div className="flex-1 text-black prose prose-xl max-w-none [&_p]:mb-0">
                  <RichText content={cleanOpt} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )

  const renderConflictPreview = (q, conflictSource, label, actionConfig, secondaryActionConfig, warningMessage) => {
    const hasLeftSide = !!(q.context || q.image_url)

    let displayImageUrl = q.image_url;
    if (q.image_url && !q.image_url.startsWith('http') && !q.image_url.startsWith('data:')) {
      const file = imageFiles.find(f => f.name === q.image_url);
      if (file) {
        displayImageUrl = URL.createObjectURL(file);
      }
    }

    return (
      <div className="flex gap-4 w-full h-[600px] shrink-0">
        {/* Left Card: 80% Width - Question Preview */}
        <div className="w-4/5 flex flex-col bg-[#aaaaaa] text-gray-900 overflow-hidden font-sans border border-gray-400 rounded-lg shadow-xl shrink-0">
          <header className="flex justify-between items-center px-8 py-3 border-b border-gray-300 bg-[#162444] text-white z-10 relative shadow-sm shrink-0">
            <div className="flex-1 font-bold text-lg text-white">
              {label}
            </div>
            <div className="flex flex-col items-center flex-1">
              <div className="text-xl font-black tracking-widest text-white">
                {conflictSource}: {q.qid}
              </div>
            </div>
            <div className="flex-1 flex justify-end gap-3">
              {secondaryActionConfig && (
                <button
                  onClick={secondaryActionConfig.onClick}
                  className={secondaryActionConfig.className || "px-6 py-2 bg-blue-600 border border-blue-700 rounded-full font-bold hover:bg-blue-700 transition text-sm text-white shadow-sm"}
                >
                  {secondaryActionConfig.text}
                </button>
              )}
              {actionConfig ? (
                <button
                  onClick={actionConfig.onClick}
                  className={actionConfig.className || "px-8 py-2 bg-[#747474] border border-gray-400 rounded-full font-bold hover:bg-red-600 hover:border-red-600 transition text-sm text-white shadow-sm"}
                >
                  {actionConfig.text}
                </button>
              ) : (
                <div className="px-8 py-2 opacity-0 text-sm font-bold border border-transparent">Remove</div>
              )}
            </div>
          </header>

          {warningMessage && (
            <div className="bg-yellow-100 border-b border-yellow-300 text-yellow-800 p-3 text-sm font-bold text-center z-10 shrink-0">
              {warningMessage}
            </div>
          )}

          <main className="flex-1 flex overflow-hidden relative bg-white">
            {hasLeftSide ? (
              <>
                <div className="w-1/2 h-full overflow-y-auto bg-white p-10 lg:p-14 border-r border-gray-300">
                  <div className="prose prose-2xl max-w-none text-black leading-relaxed font-medium">
                    {displayImageUrl && (
                      <div className="mb-8 flex justify-center w-full">
                        <img src={displayImageUrl} alt="Reference figure" className="max-w-full h-auto object-contain rounded-lg shadow-sm border border-gray-300" style={{ maxHeight: '60vh' }} />
                      </div>
                    )}
                    {q.context && <RichText content={q.context} />}
                  </div>
                </div>
                <div className="w-4 bg-gray-300 flex flex-col justify-center items-center z-10 border-l border-r border-gray-200 flex-shrink-0">
                  <div className="w-1 h-12 bg-gray-500 rounded-full"></div>
                </div>
                <div className="w-1/2 h-full overflow-y-auto bg-white p-10 lg:p-14 flex flex-col relative">
                  {renderQuestionAndOptions(q)}
                </div>
              </>
            ) : (
              <div className="w-full h-full overflow-y-auto bg-white p-10 lg:p-14 flex flex-col relative max-w-5xl mx-auto">
                {renderQuestionAndOptions(q)}
              </div>
            )}
          </main>
        </div>

        {/* Right Card: 20% Width - Solution Explanation */}
        <div className="w-1/5 flex flex-col bg-white overflow-hidden font-sans border border-gray-400 rounded-lg shadow-xl shrink-0">
          <header className="px-6 py-4 border-b border-gray-300 bg-gray-100 text-gray-800 font-bold text-sm uppercase tracking-wider shrink-0 shadow-sm">
            Solution Explanation
          </header>
          <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Correct Answer</h4>
              <div className="text-lg font-black text-green-700 bg-green-100 border border-green-300 rounded px-4 py-2 inline-block">
                {q.correct_answer || 'N/A'}
              </div>
            </div>
            {q.correct_answer_explanation && (
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Explanation</h4>
                <div className="prose prose-sm max-w-none text-gray-800">
                  <RichText content={q.correct_answer_explanation} />
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    )
  }
  return (
    <div className="flex-1 overflow-y-auto p-8 w-full bg-gray-50/50">
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
      <div className="text-center mb-8">
        <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-800">{customTitle}</h2>
        <p className="text-sm text-gray-500">{customSubtitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* JSON Section */}
        <div className="flex flex-col gap-6">
          <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col h-full">
            <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">1. Upload Primary JSON</h3>
            {jsonFile ? (
              <div className="flex items-center justify-between bg-white p-3 border rounded shadow-sm flex-1">
                <span className="text-sm font-medium text-gray-800 truncate" title={jsonFile.name}>{jsonFile.name}</span>
                <label className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer whitespace-nowrap ml-2">
                  Replace JSON
                  <input type="file" accept=".json" onClick={(e) => { e.target.value = null }} onChange={handlePrimaryJsonDrop} className="hidden" />
                </label>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-300 rounded bg-white">
                <label className="cursor-pointer text-sm font-bold text-blue-600 hover:text-blue-800 py-6 px-4 w-full text-center">
                  Select .json file
                  <input type="file" accept=".json" onClick={(e) => { e.target.value = null }} onChange={handlePrimaryJsonDrop} className="hidden" />
                </label>
              </div>
            )}
          </div>

          <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col h-full">
            <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">2. Upload Secondary JSON</h3>
            {secondaryJsonFile ? (
              <div className="flex items-center justify-between bg-white p-3 border rounded shadow-sm flex-1">
                <span className="text-sm font-medium text-gray-800 truncate" title={secondaryJsonFile.name}>{secondaryJsonFile.name}</span>
                <label className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer whitespace-nowrap ml-2">
                  Replace JSON
                  <input type="file" accept=".json" onClick={(e) => { e.target.value = null }} onChange={handleSecondaryJsonDrop} className="hidden" />
                </label>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-300 rounded bg-white">
                <label className="cursor-pointer text-sm font-bold text-blue-600 hover:text-blue-800 py-6 px-4 w-full text-center">
                  Select .json file
                  <input type="file" accept=".json" onClick={(e) => { e.target.value = null }} onChange={handleSecondaryJsonDrop} className="hidden" />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Images Section */}
        <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col h-full">
          <h3 className="font-bold text-gray-700 mb-4 border-b pb-2 flex justify-between items-center">
            3. Staged Images
            <span className="text-xs text-gray-500 font-normal">{imageFiles.length} files</span>
          </h3>
          <div className="overflow-y-auto flex-1 space-y-2 mb-3 bg-white p-2 rounded border border-gray-200" style={{ maxHeight: '200px' }}>
            {imageFiles.length === 0 && <div className="text-sm text-gray-400 text-center py-4">No images staged.</div>}
            {imageFiles.map((file, idx) => (
              <div key={idx} className="flex justify-between items-center bg-gray-50 p-1.5 rounded border text-xs">
                <span className="truncate flex-1 mr-2">{file.name}</span>
                <button onClick={() => removeImage(idx)} className="text-red-500 hover:text-red-700 font-bold p-1"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
          <label className="cursor-pointer text-center text-sm font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 py-2 rounded transition-colors">
            Add more images
            <input type="file" multiple accept="image/*" onClick={(e) => { e.target.value = null }} onChange={handleImagesAdd} className="hidden" />
          </label>
        </div>
      </div>

      {/* Validation Engine */}
      <div className="mb-6 flex gap-4">
        <button onClick={() => runRedundancyCheck()} disabled={!jsonFile || !secondaryJsonFile || isUploading || isValidating || reviewMode} className="w-1/2 py-3 bg-blue-800 text-white rounded-lg font-bold disabled:bg-blue-300 hover:bg-blue-900 transition-colors">
          Run Redundancy Check
        </button>
        <button onClick={() => runValidation()} disabled={!redundancyPassed || !jsonFile || isUploading || isValidating || reviewMode} className="w-1/2 py-3 bg-gray-800 text-white rounded-lg font-bold disabled:bg-gray-400 hover:bg-gray-900 transition-colors">
          {isValidating ? 'Validating...' : 'Check Validity'}
        </button>
      </div>

      {/* Conflict Resolver Panel */}
      {reviewMode && currentConflict && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto p-4 sm:p-8 flex flex-col gap-8 backdrop-blur-sm">
          <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-md border border-gray-200 shrink-0 max-w-4xl mx-auto w-full">
            <div>
              <h3 className="text-2xl font-black text-red-800 flex items-center gap-2 mb-2">
                ⚠️ Duplication Conflict Detected
              </h3>
              <p className="text-base text-gray-700 font-medium">Please review the two conflicting questions below and discard the incorrect one to continue validation.</p>
            </div>
          </div>

          <div className="flex flex-col gap-8 w-full max-w-[1600px] mx-auto pb-16">
            {renderConflictPreview(
              currentConflict.q1,
              'json',
              `Duplication Error: ${currentConflict.type.toLowerCase()} (${currentConflict.reason || 'UNKNOWN'})`,
              { text: 'Remove', onClick: () => handleDiscard(currentConflict.q1.qid, currentConflict.type) },
              currentConflict.type === 'JSON'
                ? { text: `Restructure ${currentConflict.q1.qid}`, onClick: () => handleRestructureHash(currentConflict.q1) }
                : (currentConflict.type === 'DB' && !currentConflict.q1.is_restructured_hash)
                  ? { text: 'Restructure Incoming Question', onClick: () => handleRestructureHash(currentConflict.q1) }
                  : null,
              (currentConflict.type === 'DB' && currentConflict.q1.is_restructured_hash)
                ? "Restructure Failed: This question is still 100% identical to the database version. Please remove/discard this question."
                : null
            )}

            {renderConflictPreview(
              currentConflict.q2,
              currentConflict.type === 'DB' ? 'db' : 'json',
              `Duplication Error: ${currentConflict.type.toLowerCase()} (${currentConflict.reason || 'UNKNOWN'})`,
              currentConflict.type === 'JSON'
                ? { text: 'Remove', onClick: () => handleDiscard(currentConflict.q2.qid, currentConflict.type) }
                : {
                  text: 'Delete Database Version & Keep New',
                  onClick: () => handleDeleteDbQuestion(currentConflict.q2.qid),
                  className: "px-6 py-2 bg-red-600 border border-red-700 rounded-full font-bold hover:bg-red-700 transition text-sm text-white shadow-sm"
                },
              currentConflict.type === 'JSON'
                ? { text: `Restructure ${currentConflict.q2.qid}`, onClick: () => handleRestructureHash(currentConflict.q2) }
                : null
            )}
          </div>
        </div>
      )}

      {/* Log Window */}
      {logs.length > 0 && (
        <div className="mb-6 bg-black rounded-lg p-4 font-mono text-sm max-h-60 overflow-y-auto shadow-inner">
          {logs.map((log, idx) => {
            let colorClass = 'text-blue-300';
            let prefix = '[INFO]';
            if (log.type === 'error') { colorClass = 'text-red-500'; prefix = '[ERROR]'; }
            else if (log.type === 'success') { colorClass = 'text-green-400'; prefix = '[SUCCESS]'; }
            else if (log.type === 'warning') { colorClass = 'text-yellow-400'; prefix = '[WARNING]'; }
            return (
              <div key={idx} className={`mb-1 ${colorClass} whitespace-pre-wrap`}>
                {prefix} {log.msg}
              </div>
            )
          })}
        </div>
      )}

      {/* Summary & Confirm Gate */}
      {isValidated && summary && (
        <div className="mt-6 border-t pt-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h4 className="font-bold text-green-800 mb-2">Data Summary</h4>
            <div className="grid grid-cols-4 gap-4 text-sm text-green-900 mb-4">
              <div><span className="font-bold">Total Questions:</span> {summary.total}</div>
              <div><span className="font-bold">English:</span> {summary.english}</div>
              <div><span className="font-bold">Math:</span> {summary.math}</div>
              <div><span className="font-bold">Total questions with images:</span> {summary.imagesCount}</div>
            </div>
            <div className="text-sm text-green-900">
              <span className="font-bold">Topics:</span> {Object.entries(summary.topics).map(([topic, count]) => `[${topic}: ${count}]`).join(', ')}
            </div>
          </div>

          <button onClick={handleUpload} disabled={isUploading} className="w-full py-4 bg-blue-600 text-white rounded-lg font-black text-lg shadow-[0_0_15px_rgba(37,99,235,0.5)] hover:bg-blue-700 hover:shadow-[0_0_20px_rgba(37,99,235,0.7)] transition-all disabled:opacity-50 disabled:shadow-none">
            {isUploading ? 'Uploading & Inserting...' : 'Confirm & Upload Now'}
          </button>
        </div>
      )}
      </div>
    </div>
  )
}

export function UserManagement({ initialUsers }) {
  const [users, setUsers] = useState(initialUsers)
  const [currentAdminLevel, setCurrentAdminLevel] = useState(1)
  const [currentUserId, setCurrentUserId] = useState(null)

  useEffect(() => {
    async function getCallerLevel() {
      try {
        const uClient = createUserClient()
        const { data: { user } } = await uClient.auth.getUser()
        if (user) {
          setCurrentUserId(user.id)
          const { data: profile } = await uClient.from('profiles').select('admin_level').eq('id', user.id).single()
          if (profile) setCurrentAdminLevel(profile.admin_level || 0)
        }
      } catch (e) {
        console.error(e)
      }
    }
    getCallerLevel()
  }, [])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [activity, setActivity] = useState([])
  const [loadingActivity, setLoadingActivity] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetStatus, setResetStatus] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [togglingPlan, setTogglingPlan] = useState(false)

  const adminTitles = { 9: 'Owner (9)', 8: 'Administrator (8)', 7: 'Moderator (7)', 1: 'Registered (1)', 0: 'Guest (0)' }
  const userTitles = { 7: 'Master Tester (7)', 6: 'Master (6)', 5: 'Flash Tester (5)', 4: 'Flash (4)', 3: 'Practice Tester (3)', 2: 'Practice (2)', 1: 'Basic Free (1)', 0: 'Guest (0)' }

  const filteredUsers = users.filter(u =>
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleRefreshUsers = async () => {
    setRefreshing(true)
    const { data } = await getLightweightUsers()
    if (data) setUsers(data)
    setRefreshing(false)
  }

  const handleSelectUser = async (user) => {
    setSelectedUser(user)
    setActivity([])
    setNewPassword('')
    setConfirmPassword('')
    setResetStatus('')
    setLoadingActivity(true)

    const { data: details } = await getUserDetails(user.id)
    if (details) {
      setSelectedUser(prev => ({ ...prev, ...details }))
      // Sync the fresh data (like an auto-downgraded user_level status) back to the left-hand list
      setUsers(prevUsers => prevUsers.map(u => u.id === user.id ? { ...u, ...details } : u))
    }

    const { data, error } = await getUserActivity(user.id)
    if (data) {
      setActivity(data)
    }
    setLoadingActivity(false)
  }

  const handlePasswordReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      setResetStatus('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setResetStatus('Error: Passwords do not match.')
      return
    }
    setResetStatus('Resetting...')
    const result = await forceChangePassword(selectedUser.id, newPassword)
    if (result.error) {
      setResetStatus(`Error: ${result.error}`)
    } else {
      setResetStatus('Password successfully updated!')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  const handleDeleteUser = async () => {
    if (!confirm(`⚠️ Are you sure you want to permanently delete ${selectedUser.full_name || selectedUser.email}? This cannot be undone.`)) {
      return
    }
    setResetStatus('Deleting user...')
    const res = await deleteUserAction(selectedUser.id)
    if (res.error) {
      setResetStatus(`Error deleting: ${res.error}`)
    } else {
      alert('User successfully deleted!')
      setSelectedUser(null)
      handleRefreshUsers()
    }
  }

  const handleEditExpiry = async () => {
    const currentExpiryStr = selectedUser.premium_expires_at
      ? new Date(selectedUser.premium_expires_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]

    const dateInput = window.prompt(`Update the exact expiration date (YYYY-MM-DD) for ${selectedUser.full_name}:`, currentExpiryStr)
    if (dateInput === null) return // cancelled

    const parsedDate = new Date(dateInput)
    if (isNaN(parsedDate.getTime())) {
      alert("Invalid date format. Please use YYYY-MM-DD.")
      return
    }

    const expiresAt = parsedDate.toISOString()

    setTogglingPlan(true)
    const uLevel = selectedUser.user_level ?? 2
    const aLevel = selectedUser.admin_level ?? 1
    const result = await updateUserLevelsAction(selectedUser.id, aLevel, uLevel, expiresAt)

    if (result.success) {
      setSelectedUser(prev => ({ ...prev, user_level: uLevel, premium_expires_at: expiresAt }))
      setUsers(prevUsers => prevUsers.map(u => u.id === selectedUser.id ? { ...u, user_level: uLevel, premium_expires_at: expiresAt } : u))
    } else {
      alert("Failed to update expiry: " + result.error)
    }
    setTogglingPlan(false)
  }

  return (
    <div className="flex flex-1 h-full bg-white overflow-hidden">
      <div className="w-1/3 flex flex-col bg-gray-50/50 border-r border-gray-200 p-4">
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 p-2 border rounded text-sm"
          />
          <button
            onClick={handleRefreshUsers}
            disabled={refreshing}
            className="p-2 border rounded hover:bg-gray-50 text-gray-600 transition-colors"
            title="Refresh Users"
          >
            {refreshing ? <span className="animate-spin block">↻</span> : <RefreshCw className="w-5 h-5" />}
          </button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-2">
          {filteredUsers.map(u => (
            <div
              key={u.id}
              onClick={() => handleSelectUser(u)}
              className={`p-3 border rounded cursor-pointer text-sm ${selectedUser?.id === u.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
            >
              <div className="font-bold text-gray-900">{u.full_name || 'No Name'}</div>
              <div className="text-xs text-gray-500">{u.email}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className="px-1.5 py-0.5 text-xs rounded bg-purple-100 text-purple-700 font-bold">
                  {userTitles[u.user_level ?? 1] || `User Level ${u.user_level}`}
                </span>
                {(u.admin_level >= 7) && (
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-bold">
                    {adminTitles[u.admin_level ?? 8] || `Admin Level ${u.admin_level}`}
                  </span>
                )}
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 && <div className="text-center text-sm text-gray-500 mt-4">No users found.</div>}
        </div>
      </div>

      <div className="w-2/3 bg-white p-6 flex flex-col overflow-y-auto">
        {selectedUser ? (
          <div className="space-y-6">
            <div className="flex flex-col xl:flex-row justify-between items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  {selectedUser.full_name || 'Unknown User'}
                </h2>
                <p className="text-gray-500 text-sm">{selectedUser.email}</p>
              </div>

              <div className="flex flex-wrap items-end gap-3 w-full xl:w-auto">

                <div className="flex flex-col gap-1 flex-1 sm:flex-initial">
                  <label className="text-xs font-bold text-gray-600">User Access Level</label>
                  <select
                    value={selectedUser.user_level ?? 1}
                    onChange={(e) => setSelectedUser(prev => ({ ...prev, user_level: parseInt(e.target.value, 10) }))}
                    className="p-2 border rounded text-sm bg-white font-bold text-purple-800"
                  >
                    <option value={1}>1 - Basic Free Tier</option>
                    <option value={2}>2 - Practice</option>
                    <option value={3}>3 - Practice Tester</option>
                    <option value={4}>4 - Flash</option>
                    <option value={5}>5 - Flash Tester</option>
                    <option value={6}>6 - Master</option>
                    <option value={7}>7 - Master Tester</option>
                  </select>
                </div>

                <button
                  onClick={async () => {
                    setTogglingPlan(true)
                    const aLevel = selectedUser.admin_level ?? 1
                    const uLevel = selectedUser.user_level ?? 1
                    const exp = selectedUser.premium_expires_at || (uLevel >= 2 ? new Date(Date.now() + 30*24*3600*1000).toISOString() : null)
                    const res = await updateUserLevelsAction(selectedUser.id, aLevel, uLevel, exp)
                    if (res.success) {
                      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, admin_level: aLevel, user_level: uLevel, premium_expires_at: exp } : u))
                      alert("User levels successfully updated!")
                    } else {
                      alert("Error updating user levels: " + res.error)
                    }
                    setTogglingPlan(false)
                  }}
                  disabled={togglingPlan}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm shadow transition disabled:opacity-50 h-9"
                >
                  {togglingPlan ? 'Saving...' : 'Save Levels'}
                </button>
              </div>
            </div>

            <div>
              {selectedUser.created_at ? (
                (() => {
                  let quotaText = 'Loading...'
                  if (selectedUser.practice_config) {
                    const uLevel = selectedUser.user_level ?? 1
                    let limit = 10
                    if (uLevel === 1) limit = selectedUser.practice_config.level_1_limit ?? 10
                    else if (uLevel === 2) limit = selectedUser.practice_config.level_2_limit ?? 100
                    else if (uLevel === 3) limit = selectedUser.practice_config.level_3_limit ?? -1
                    else if (uLevel === 4) limit = selectedUser.practice_config.level_4_limit ?? -1
                    else if (uLevel === 5) limit = selectedUser.practice_config.level_5_limit ?? -1
                    else if (uLevel >= 6) limit = selectedUser.practice_config.level_6_limit ?? -1

                    if (limit === -1) {
                      quotaText = 'Unlimited'
                    } else {
                      let todaySubmitted = selectedUser.today_submitted || 0
                      const now = new Date()
                      const utcNow = now.getTime() + (now.getTimezoneOffset() * 60000)
                      const bstNow = new Date(utcNow + (3600000 * 6))
                      const bstTodayString = bstNow.toDateString()
                      
                      let lastDateString = null
                      if (selectedUser.last_submission_date) {
                        const lastDate = new Date(selectedUser.last_submission_date)
                        const utcLast = lastDate.getTime() + (lastDate.getTimezoneOffset() * 60000)
                        const bstLast = new Date(utcLast + (3600000 * 6))
                        lastDateString = bstLast.toDateString()
                      }
                      if (lastDateString !== bstTodayString) todaySubmitted = 0
                      
                      const remaining = Math.max(0, limit - todaySubmitted)
                      quotaText = `${remaining} left (Used ${todaySubmitted} of ${limit})`
                    }
                  }

                  return (
                    <div className="mt-2 text-sm text-gray-700 grid grid-cols-2 gap-2">
                      <div><strong>Institution:</strong> {selectedUser.institution || 'N/A'}</div>
                      <div><strong>Year:</strong> {selectedUser.academic_year || 'N/A'}</div>
                      <div><strong>WhatsApp:</strong> {selectedUser.whatsapp_number || 'N/A'}</div>
                      <div><strong>Joined:</strong> {new Date(selectedUser.created_at).toLocaleDateString()}</div>
                      <div className="col-span-2"><strong>Daily Practice Quota:</strong> <span className="text-purple-700 font-bold">{quotaText}</span></div>
                      {(selectedUser.user_level >= 2) && (
                        <div className="col-span-2 mt-1 flex items-center gap-2">
                          <strong className="text-purple-700">Level {selectedUser.user_level} Expires:</strong>
                          <span>{selectedUser.premium_expires_at ? new Date(selectedUser.premium_expires_at).toLocaleDateString() : 'Lifetime / Unknown'}</span>
                          <button
                            onClick={handleEditExpiry}
                            disabled={togglingPlan}
                            className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                          >
                            (Edit)
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()
              ) : (
                <div className="mt-2 text-sm text-gray-400">Loading details...</div>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-bold mb-3 text-red-600">Security: Manual Password Reset</h3>
              {((selectedUser?.admin_level ?? 1) >= currentAdminLevel && selectedUser?.id !== currentUserId) ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold text-amber-800">
                  🔒 Permission Denied: You cannot reset the password of a user with an equal or higher administrative tier (Level {selectedUser?.admin_level ?? 1}).
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    placeholder="New password..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="password"
                    placeholder="Confirm password..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded text-sm"
                  />
                  <button
                    onClick={handlePasswordReset}
                    className="px-4 py-2 bg-red-600 text-white rounded font-bold text-sm hover:bg-red-700 transition shrink-0"
                  >
                    Force Reset
                  </button>
                </div>
              )}
              {resetStatus && <div className={`mt-2 text-sm font-medium ${resetStatus.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>{resetStatus}</div>}

              {/* Danger Zone: Delete User Account */}
              <div className="mt-6 pt-4 border-t border-red-200 bg-red-50 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-red-800">Danger Zone</h4>
                  <p className="text-xs text-red-600">Permanently remove this user account and all submissions.</p>
                </div>
                <button
                  onClick={handleDeleteUser}
                  disabled={((selectedUser?.admin_level ?? 1) >= currentAdminLevel) || selectedUser?.id === currentUserId}
                  title={selectedUser?.id === currentUserId ? "Cannot delete your own account" : ((selectedUser?.admin_level ?? 1) >= currentAdminLevel) ? `Cannot delete an equal or higher tier admin (Level ${selectedUser?.admin_level ?? 1})` : ""}
                  className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-lg text-xs shadow transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete User
                </button>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-bold mb-3">Activity Log</h3>
              {loadingActivity ? (
                <div className="text-sm text-gray-500">Loading activity...</div>
              ) : activity.length > 0 ? (
                <div className="space-y-3">
                  {activity.map(act => (
                    <div key={act.id} className="p-4 border rounded bg-gray-50 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-gray-900 flex items-center gap-2">
                          {act.title}
                          {act.type === 'test' && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] uppercase font-black tracking-wider">Full Test</span>}
                        </div>
                        <div className="text-xs text-gray-500">{new Date(act.submitted_at).toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-blue-600 text-lg">{act.score_estimate} / {act.type === 'test' ? (act.score_estimate > 800 ? 1600 : 800) : 800}</div>
                        <div className="text-xs text-gray-500">
                          {act.correct_count !== null ? `${act.correct_count} of ${act.total_questions} correct` : `${act.total_questions} questions total`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded border text-center">No submissions found for this user.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">Select a user to view details and manage security</div>
        )}
      </div>
    </div>
  )
}

export function TestBuilder({ modules, setModules, questions, setQuestions, tests, setTests, onUpdate, supabase }) {
  const [newTest, setNewTest] = useState({ test_name: '', test_type: 'BOTH', required_level: 6, parent_directory: '/root/practice-tests' })
  const [selectedTestId, setSelectedTestId] = useState(null)
  const [editingModuleId, setEditingModuleId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const existingDirectories = []

  const selectedTest = tests.find(t => t.id === selectedTestId) || null

  const [config, setConfig] = useState({
    rw_base_module_id: '', rw_easier_module_id: '', rw_harder_module_id: '', rw_threshold: 15,
    math_base_module_id: '', math_easier_module_id: '', math_harder_module_id: '', math_threshold: 15,
    subject_order: ['READING_WRITING', 'MATH'], required_level: 6, test_name: ''
  })

  useEffect(() => {
    if (selectedTest) {
      setConfig({
        rw_base_module_id: selectedTest.rw_base_module_id || '',
        rw_easier_module_id: selectedTest.rw_easier_module_id || '',
        rw_harder_module_id: selectedTest.rw_harder_module_id || '',
        rw_threshold: selectedTest.rw_threshold ?? 15,
        math_base_module_id: selectedTest.math_base_module_id || '',
        math_easier_module_id: selectedTest.math_easier_module_id || '',
        math_harder_module_id: selectedTest.math_harder_module_id || '',
        math_threshold: selectedTest.math_threshold ?? 15,
        subject_order: selectedTest.subject_order || ['READING_WRITING', 'MATH'],
        required_level: selectedTest.required_level ?? 1,
        test_name: selectedTest.test_name || ''
      })
    }
  }, [selectedTest])

  const handleCreate = async () => {
    if (!newTest.test_name) { alert('Enter a test name'); return }
    setSaving(true)
    
    // Create the required modules
    const modulesToCreate = [];
    if (newTest.test_type === 'READING_WRITING' || newTest.test_type === 'BOTH') {
      modulesToCreate.push({ module_name: `${newTest.test_name} - R&W Base`, time_limit_minutes: 32 })
      modulesToCreate.push({ module_name: `${newTest.test_name} - R&W Easier`, time_limit_minutes: 32 })
      modulesToCreate.push({ module_name: `${newTest.test_name} - R&W Harder`, time_limit_minutes: 32 })
    }
    if (newTest.test_type === 'MATH' || newTest.test_type === 'BOTH') {
      modulesToCreate.push({ module_name: `${newTest.test_name} - Math Base`, time_limit_minutes: 35 })
      modulesToCreate.push({ module_name: `${newTest.test_name} - Math Easier`, time_limit_minutes: 35 })
      modulesToCreate.push({ module_name: `${newTest.test_name} - Math Harder`, time_limit_minutes: 35 })
    }
    
    const { data: insertedModules, error: modError } = await supabase.from('modules').insert(modulesToCreate).select()
    
    if (modError) { alert('Error creating test modules: ' + modError.message); setSaving(false); return }
    
    const getModId = (suffix) => insertedModules.find(m => m.module_name.endsWith(suffix))?.id || null;

    const { data: insertedTests, error } = await supabase.from('practice_tests').insert([{
      test_name: newTest.test_name,
      test_type: newTest.test_type,
      required_level: newTest.required_level,
      subject_order: newTest.test_type === 'BOTH' ? ['READING_WRITING', 'MATH'] : [newTest.test_type],
      rw_base_module_id: getModId('R&W Base'),
      rw_easier_module_id: getModId('R&W Easier'),
      rw_harder_module_id: getModId('R&W Harder'),
      rw_threshold: 15,
      math_base_module_id: getModId('Math Base'),
      math_easier_module_id: getModId('Math Easier'),
      math_harder_module_id: getModId('Math Harder'),
      math_threshold: 15
    }]).select()
    
    if (!error && insertedTests?.length > 0) {
      const fileInserts = [
        {
          name: newTest.test_name,
          type: 'test',
          parent_directory: newTest.parent_directory.trim() || '/root/practice-tests',
          reference_id: insertedTests[0].id
        },
        ...(insertedModules || []).map(m => ({
          name: m.module_name,
          type: 'module',
          parent_directory: newTest.parent_directory.trim() || '/root/practice-tests',
          reference_id: m.id
        }))
      ];
      await supabase.from('files').insert(fileInserts);
      setNewTest({ test_name: '', test_type: 'BOTH', required_level: 6, parent_directory: '/root/practice-tests' })
      onUpdate()
    } else {
      alert('Error: ' + error.message)
    }
    setSaving(false)
  }

  const handleSaveConfig = async () => {
    if (!selectedTest) return
    setSaving(true)
    const update = {
      test_name: config.test_name,
      required_level: config.required_level,
      subject_order: config.subject_order,
      rw_base_module_id: config.rw_base_module_id || null,
      rw_easier_module_id: config.rw_easier_module_id || null,
      rw_harder_module_id: config.rw_harder_module_id || null,
      rw_threshold: config.rw_threshold,
      math_base_module_id: config.math_base_module_id || null,
      math_easier_module_id: config.math_easier_module_id || null,
      math_harder_module_id: config.math_harder_module_id || null,
      math_threshold: config.math_threshold,
    }
    await supabase.from('practice_tests').update(update).eq('id', selectedTest.id)
    if (config.test_name && config.test_name !== selectedTest.test_name) {
      await supabase.from('files').update({ name: config.test_name }).eq('type', 'test').eq('reference_id', selectedTest.id)
    }

    // Cascade rename to underlying auto-generated modules to ensure they stay in sync
    if (config.test_name) {
      const modUpdates = [
        { id: config.rw_base_module_id, suffix: 'R&W Base' },
        { id: config.rw_easier_module_id, suffix: 'R&W Easier' },
        { id: config.rw_harder_module_id, suffix: 'R&W Harder' },
        { id: config.math_base_module_id, suffix: 'Math Base' },
        { id: config.math_easier_module_id, suffix: 'Math Easier' },
        { id: config.math_harder_module_id, suffix: 'Math Harder' }
      ];

      for (const mod of modUpdates) {
        if (mod.id) {
          const m = modules.find(x => x.id === mod.id);
          if (m && m.module_name.endsWith(`- ${mod.suffix}`)) {
            const newModName = `${config.test_name} - ${mod.suffix}`;
            if (m.module_name !== newModName) {
              await supabase.from('modules').update({ module_name: newModName }).eq('id', m.id);
              await supabase.from('files').update({ name: newModName }).eq('type', 'module').eq('reference_id', m.id);
            }
          }
        }
      }
    }

    // Optimistically update the tests state so UI reflects instantly
    setTests(tests.map(t => t.id === selectedTest.id ? { ...t, ...update } : t));

    onUpdate()
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!selectedTest) return
    if (deleteConfirmName !== selectedTest.test_name) {
      alert('Name does not match. Deletion cancelled.');
      return;
    }
    
    setSaving(true)
    
    // Auto-delete the associated test modules if they have the TEST_INTERNAL flag (we can check by suffix)
    const modulesToDelete = modules.filter(m => m.module_name.startsWith(selectedTest.test_name + ' - '));
    if (modulesToDelete.length > 0) {
       const modIds = modulesToDelete.map(m => m.id);
       await supabase.from('modules').delete().in('id', modIds);
       await supabase.from('files').delete().in('reference_id', modIds);
       await cleanupDeletedModulesFromDb(modIds, supabase);
    }

    await supabase.from('practice_tests').delete().eq('id', selectedTest.id)
    await supabase.from('files').delete().eq('reference_id', selectedTest.id)
    
    setSelectedTestId(null)
    setShowDeleteModal(false)
    setDeleteConfirmName('')
    onUpdate()
    setSaving(false)
  }

  const handleSortTestModules = async (direction) => {
    if (!selectedTest) return;
    setSaving(true);
    const modIds = [
      config.rw_base_module_id,
      config.rw_easier_module_id,
      config.rw_harder_module_id,
      config.math_base_module_id,
      config.math_easier_module_id,
      config.math_harder_module_id
    ].filter(Boolean);

    let updatedCount = 0;
    for (const modId of modIds) {
      const mod = modules.find(m => m.id === modId);
      if (mod && mod.question_ids && mod.question_ids.length > 0) {
        let sortedQIds = [...mod.question_ids].sort((a, b) => {
          if (direction === 'asc') return a.localeCompare(b);
          if (direction === 'desc') return b.localeCompare(a);
          return 0;
        });
        await supabase.from('modules').update({ question_ids: sortedQIds }).eq('id', mod.id);
        updatedCount++;
      }
    }
    await onUpdate();
    setSaving(false);
    alert(`Successfully sorted questions in ${updatedCount} modules (${direction === 'asc' ? 'A → Z (Lexicographically Small)' : 'Z → A (Lexicographically Large)'})!`);
  };

  const ModuleSlot = ({ moduleId, label }) => {
    const mod = modules.find(m => m.id === moduleId);
    let missingQids = [];
    if (mod && mod.question_ids) {
      missingQids = mod.question_ids.filter(id => !questions.some(q => q.qid === id));
    }
    return (
      <div className="flex flex-col gap-1 border p-3 rounded bg-white shadow-sm">
        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">{label}</label>
        {mod ? (
          <div className="flex flex-col mt-1">
             <div className="flex justify-between items-center">
               <div className="text-sm font-medium text-gray-700">{mod.question_ids?.length || 0} Questions • {mod.time_limit_minutes} Mins</div>
               <button onClick={() => setEditingModuleId(mod.id)} className="px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-xs font-bold transition-colors">Edit Content</button>
             </div>
             {missingQids.length > 0 && (
               <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs font-bold text-red-600">
                 <div className="mb-1">Warning: QIDs assigned but missing from DB:</div>
                 <ul className="list-disc pl-4 font-mono font-normal">
                   {missingQids.map(id => <li key={id}>{id}</li>)}
                 </ul>
                 <button
                   onClick={async (e) => {
                     e.stopPropagation();
                     const cleaned = (mod.question_ids || []).filter(id => !missingQids.includes(id));
                     await supabase.from('modules').update({ question_ids: cleaned }).eq('id', mod.id);
                     onUpdate();
                   }}
                   className="mt-2 px-3 py-1.5 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 transition-colors"
                 >
                   Re-adjust Module ({missingQids.length} removed)
                 </button>
               </div>
             )}
          </div>
        ) : (
          <div className="text-sm text-gray-400 mt-1">Slot empty (Module not found)</div>
        )}
      </div>
    )
  }

  const SubjectConfig = ({ prefix, label }) => {
    const baseKey = `${prefix}_base_module_id`
    const easierKey = `${prefix}_easier_module_id`
    const harderKey = `${prefix}_harder_module_id`
    const thresholdKey = `${prefix}_threshold`
    
    const baseMod = modules.find(m => m.id === config[baseKey])
    const maxQ = baseMod?.question_ids?.length || 0
    const prevMaxQ = useRef(maxQ)

    useEffect(() => {
      if (maxQ !== prevMaxQ.current) {
        if (maxQ > 0) {
          setConfig(p => ({ ...p, [thresholdKey]: Math.round(maxQ * (2/3)) }))
        }
        prevMaxQ.current = maxQ
      }
    }, [maxQ, thresholdKey])

    return (
      <div className="p-4 bg-gray-50 rounded-lg border">
        <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${prefix === 'rw' ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
          {label}
        </h4>
        <div className="space-y-3">
          <ModuleSlot label="Module 1 (Base)" moduleId={config[baseKey]} />
          <div className="border-t pt-3 mt-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-gray-600">THRESHOLD:</span>
              <input type="number" min="0" max={maxQ} value={config[thresholdKey]} onChange={e => {
                let val = parseInt(e.target.value) || 0
                if (val > maxQ) val = maxQ
                if (val < 0) val = 0
                setConfig(p => ({ ...p, [thresholdKey]: val }))
              }} className="w-20 p-1.5 border rounded text-sm text-center" />
              <span className="text-xs text-gray-500">≥ {config[thresholdKey]} correct (out of {maxQ}) → Harder path</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ModuleSlot label="Module 2 — Easier Path" moduleId={config[easierKey]} />
              <ModuleSlot label="Module 2 — Harder Path" moduleId={config[harderKey]} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const typeBadge = (type) => {
    const colors = { BOTH: 'bg-purple-100 text-purple-700', READING_WRITING: 'bg-emerald-100 text-emerald-700', MATH: 'bg-blue-100 text-blue-700' }
    const labels = { BOTH: 'Both', READING_WRITING: 'R&W', MATH: 'Math' }
    return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${colors[type] || ''}`}>{labels[type] || type}</span>
  }

  if (editingModuleId) {
    return (
      <ModuleBuilder 
        modules={modules} setModules={setModules} 
        questions={questions} setQuestions={setQuestions} 
        onUpdate={onUpdate} supabase={supabase} 
        forceSelectedModuleId={editingModuleId} 
        onBack={() => setEditingModuleId(null)} 
        test={selectedTest}
        setEditingModuleId={setEditingModuleId}
      />
    )
  }

  return (
    <div className="flex flex-1 h-full bg-white overflow-hidden">
      <div className="w-1/3 bg-gray-50/50 border-r border-gray-200 p-4 flex flex-col overflow-y-auto">
        <div className="mb-6 p-4 bg-gray-50 rounded border">
          <h4 className="text-sm font-bold mb-3">Create Practice Test</h4>
          <input placeholder="Test Name" value={newTest.test_name} onChange={e => setNewTest({ ...newTest, test_name: e.target.value })} className="w-full mb-2 p-2 text-sm border rounded" />
          <select value={newTest.test_type} onChange={e => setNewTest({ ...newTest, test_type: e.target.value })} className="w-full mb-2 p-2 text-sm border rounded">
            <option value="BOTH">Both (R&W + Math)</option>
            <option value="READING_WRITING">Reading & Writing Only</option>
            <option value="MATH">Math Only</option>
          </select>
          <div className="mb-2">
            <label className="block text-xs font-bold text-gray-700 mb-1">Required Access Level:</label>
            <select value={newTest.required_level} onChange={e => setNewTest({ ...newTest, required_level: parseInt(e.target.value, 10) })} className="w-full p-2 text-sm border rounded font-bold">
              <option value={1}>Level 1 — Basic Free Tier</option>
              <option value={2}>Level 2 — Practice Plan</option>
              <option value={4}>Level 4 — Flash Plan</option>
              <option value={6}>Level 6 — Master Plan</option>
            </select>
          </div>
          <div className="relative mb-3">
            <input
              list="test-dir-autocomplete"
              placeholder="Parent Directory (default: /root/practice-tests)"
              value={newTest.parent_directory}
              onChange={e => setNewTest({ ...newTest, parent_directory: e.target.value })}
              className="w-full p-2 text-sm border rounded"
            />
            <datalist id="test-dir-autocomplete">
              <option value="/root/practice-tests" />
            </datalist>
          </div>
          <button onClick={handleCreate} disabled={saving} className="w-full bg-blue-600 text-white p-2 rounded text-sm font-medium disabled:opacity-50"><Plus className="inline w-4 h-4 mr-1" /> {saving ? 'Creating...' : 'Create'}</button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-2">
          {tests.map(t => (
            <div
              key={t.id}
              onClick={() => setSelectedTestId(t.id)}
              className={`p-3 border rounded cursor-pointer transition-colors ${selectedTest?.id === t.id ? 'border-blue-500 bg-blue-50' : 'bg-gray-50 hover:border-gray-300'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="font-bold text-sm truncate">{t.test_name}</div>
                {typeBadge(t.test_type)}
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full">Level {t.required_level ?? 1}</span>
              </div>
              <div className="text-xs text-gray-500">
                {t.test_type === 'BOTH' ? 'R&W + Math' : t.test_type === 'READING_WRITING' ? 'Reading & Writing' : 'Math'}
              </div>
            </div>
          ))}
          {tests.length === 0 && <div className="text-sm text-gray-400 text-center py-8">No practice tests yet.</div>}
        </div>
      </div>

      <div className="w-2/3 bg-white p-4 overflow-y-auto">
        {selectedTest ? (
          <div>
            <div className="flex items-center justify-between mb-6 border-b pb-4">
              <h3 className="font-bold text-lg">Configuring: {selectedTest.test_name}</h3>
              <div className="flex gap-2">
                <button onClick={() => handleSortTestModules('asc')} disabled={saving} className="px-3 py-1.5 text-xs bg-indigo-100 text-indigo-700 rounded font-bold hover:bg-indigo-200 transition-colors">Sort Modules (A → Z)</button>
                <button onClick={() => handleSortTestModules('desc')} disabled={saving} className="px-3 py-1.5 text-xs bg-indigo-100 text-indigo-700 rounded font-bold hover:bg-indigo-200 transition-colors">Sort Modules (Z → A)</button>
                <a href={`/test/${selectedTest.id}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300 transition-colors">Preview</a>
                <button onClick={() => setShowDeleteModal(true)} className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded font-bold hover:bg-red-200 transition-colors">Delete</button>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex gap-3 items-center">
                <span className="text-sm font-bold text-gray-700 w-20">Name:</span>
                <input type="text" value={config.test_name} onChange={e => setConfig(p => ({ ...p, test_name: e.target.value }))} className="flex-1 p-2 border rounded text-sm" />
              </div>
              <div className="flex gap-3 items-center">
                <span className="text-sm font-bold text-gray-700 w-20">Access:</span>
                <select value={config.required_level} onChange={e => setConfig(p => ({ ...p, required_level: parseInt(e.target.value, 10) }))} className="p-2 border rounded text-sm font-bold">
                  <option value={1}>Level 1 (Free)</option>
                  <option value={2}>Level 2 (Practice)</option>
                  <option value={4}>Level 4 (Flash)</option>
                  <option value={6}>Level 6 (Master)</option>
                </select>
              </div>
              {selectedTest.test_type === 'BOTH' && (
                <div className="flex gap-3 items-center">
                  <span className="text-sm font-bold text-gray-700 w-20">Order:</span>
                  <select
                    value={config.subject_order[0]}
                    onChange={e => setConfig(p => ({
                      ...p,
                      subject_order: e.target.value === 'READING_WRITING' ? ['READING_WRITING', 'MATH'] : ['MATH', 'READING_WRITING']
                    }))}
                    className="p-2 border rounded text-sm"
                  >
                    <option value="READING_WRITING">Reading & Writing first</option>
                    <option value="MATH">Math first</option>
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {(selectedTest.test_type === 'READING_WRITING' || selectedTest.test_type === 'BOTH') && (
                <SubjectConfig prefix="rw" label="Reading & Writing" />
              )}
              {(selectedTest.test_type === 'MATH' || selectedTest.test_type === 'BOTH') && (
                <SubjectConfig prefix="math" label="Math" />
              )}
            </div>

            <div className="mt-6 pt-4 border-t">
              <button onClick={handleSaveConfig} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">Select a practice test to configure its adaptive modules.</div>
        )}
      </div>

      {showDeleteModal && selectedTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-center mb-2">Delete Practice Test</h3>
            <p className="text-gray-600 text-center mb-6 text-sm">
              This action is permanent and cannot be undone. All associated modules will also be deleted.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg border mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Type <span className="text-red-600 select-all font-mono bg-red-50 px-1">{selectedTest.test_name}</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={e => setDeleteConfirmName(e.target.value)}
                className="w-full border rounded p-2 focus:ring-2 focus:ring-red-500 focus:outline-none"
                placeholder="Test name"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmName(''); }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded font-bold hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmName !== selectedTest.test_name || saving}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function DirectoryManager({ modules, tests, files = [], questions = [], setQuestions, setModules, onUpdate, supabase }) {
  const [activeDirectory, setActiveDirectory] = useState('/root')
  const [addressBar, setAddressBar] = useState('/root')
  const [selectedItems, setSelectedItems] = useState([])
  const [draggedItems, setDraggedItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [editingFileId, setEditingFileId] = useState(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    setAddressBar(activeDirectory || '')
    setSelectedItems([])
  }, [activeDirectory])

  // Navigate to parent directory on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input (e.g., renaming a file or typing in address bar)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        setActiveDirectory(prev => {
          if (!prev || prev === '/root') return '/root';
          const parts = prev.split('/').filter(Boolean);
          if (parts.length <= 1) return '/root';
          parts.pop();
          return '/' + parts.join('/');
        });
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Normalize path to ensure no trailing slashes unless it's root
  const normDir = (d) => {
    if (!d) return '/root';
    const clean = d.replace(/\/+$/g, '');
    if (!clean.startsWith('/')) return '/' + clean;
    return clean;
  };

  const activeDirNorm = normDir(activeDirectory);
  
  // Folders are rows in files table with type='folder'
  const allFolders = files.filter(f => f.type === 'folder');
  
  // Items in current directory
  const activeItems = files.filter(f => f.parent_directory === activeDirNorm);
  const activeChildFolders = activeItems.filter(f => f.type === 'folder').sort((a,b) => a.name.localeCompare(b.name));
  const activeTestsFiles = activeItems.filter(f => f.type === 'test');
  const activeModulesFiles = activeItems.filter(f => f.type === 'module');

  // Map to underlying data
  const testMap = {}; tests.forEach(t => testMap[t.id] = t);
  const moduleMap = {}; modules.forEach(m => moduleMap[m.id] = m);

  const handleDragStart = (e, file) => {
    if (selectedItems.includes(file.id)) {
       const itemsToDrag = files.filter(f => selectedItems.includes(f.id));
       setDraggedItems(itemsToDrag)
    } else {
       setDraggedItems([file])
    }
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDropOnFolder = async (e, targetDir) => {
    e.preventDefault()
    if (draggedItems.length === 0) return
    const targetNorm = normDir(targetDir)
    
    // Check if dragging a folder into itself or its own children
    const invalidDrop = draggedItems.some(item => {
       if (item.type === 'folder') {
         const itemPath = `${item.parent_directory}/${item.name}`;
         return targetNorm === itemPath || targetNorm.startsWith(itemPath + '/');
       }
       return false;
    });
    
    if (invalidDrop) {
      alert("Cannot move a folder into itself.");
      return;
    }

    const itemsToMove = draggedItems.filter(i => i.parent_directory !== targetNorm)
    if (itemsToMove.length === 0) return
    
    setSaving(true)
    for (const item of itemsToMove) {
       await supabase.from('files').update({ parent_directory: targetNorm }).eq('id', item.id)
    }
    onUpdate()
    setSaving(false)
    setDraggedItems([])
    setSelectedItems([])
  }

  const handleCreateFolder = async () => {
    const name = prompt("New folder name:");
    if (!name || !name.trim()) return;
    
    setSaving(true);
    await supabase.from('files').insert({
      name: name.trim(),
      type: 'folder',
      parent_directory: activeDirNorm
    });
    onUpdate();
    setSaving(false);
  }

  const handleDeleteFolder = async (folderFile) => {
    if (!confirm(`Are you sure you want to delete the folder "${folderFile.name}"? All items inside will be moved up to "${folderFile.parent_directory}".`)) return;
    
    setSaving(true);
    const folderPath = `${folderFile.parent_directory}/${folderFile.name}`;
    
    // Shift children up
    await supabase.from('files').update({ parent_directory: folderFile.parent_directory }).eq('parent_directory', folderPath);
    
    // Delete the folder itself
    await supabase.from('files').delete().eq('id', folderFile.id);
    
    onUpdate();
    setSaving(false);
  }

  const saveItemRename = async (file) => {
    if (!editName || editName === file.name) {
      setEditingFileId(null)
      return
    }
    setSaving(true)
    
    await supabase.from('files').update({ name: editName }).eq('id', file.id);
    
    // If it's a folder, we MUST update the parent_directory of all children
    if (file.type === 'folder') {
      const oldPath = `${file.parent_directory}/${file.name}`;
      const newPath = `${file.parent_directory}/${editName}`;
      
      // Fetch all files that start with the old path
      const { data: childrenToUpdate } = await supabase.from('files').select('id, parent_directory').like('parent_directory', `${oldPath}%`);
      
      if (childrenToUpdate && childrenToUpdate.length > 0) {
         for (const child of childrenToUpdate) {
            const newChildParent = child.parent_directory.replace(oldPath, newPath);
            await supabase.from('files').update({ parent_directory: newChildParent }).eq('id', child.id);
         }
      }
    }
    
    onUpdate()
    setEditingFileId(null)
    setSaving(false)
  }

  const buildTree = (folders) => {
    const root = {};
    folders.forEach(f => {
      const pathParts = f.parent_directory.split('/').filter(Boolean);
      let current = root;
      let currentPath = '';
      pathParts.forEach((part) => {
        currentPath += '/' + part;
        if (!current[part]) current[part] = { name: part, path: currentPath, children: {} };
        current = current[part].children;
      });
      // Add the folder itself
      const thisPath = `${f.parent_directory}/${f.name}`;
      if (!current[f.name]) current[f.name] = { name: f.name, path: thisPath, children: {} };
    });
    return root;
  };

  const tree = buildTree(allFolders);

  const FolderNode = ({ node, level }) => {
    const [expanded, setExpanded] = useState(true);
    const isActive = activeDirectory === node.path;
    const hasChildren = Object.keys(node.children).length > 0;
    
    return (
      <div className="w-full">
        <div 
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => { e.stopPropagation(); handleDropOnFolder(e, node.path); }}
          onClick={(e) => { e.stopPropagation(); setActiveDirectory(node.path); }}
          className={`group py-1.5 pr-3 rounded cursor-pointer transition-colors flex justify-between items-center ${isActive ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50 border border-transparent'}`}
          style={{ paddingLeft: `${(level * 16) + 12}px` }}
        >
          <div className="flex items-center gap-2 truncate">
            {hasChildren ? (
              <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }} className="p-0.5 hover:bg-gray-200 rounded text-gray-500 shrink-0 transition-colors">
                {expanded ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
              </button>
            ) : (
              <div className="w-5 h-5 shrink-0" />
            )}
            <FolderTree className={`w-4 h-4 shrink-0 ${node.path.startsWith('/[TEST_INTERNAL]') ? 'text-red-400' : isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
            <span className={`font-bold truncate text-sm ${node.path.startsWith('/[TEST_INTERNAL]') ? 'text-red-700' : isActive ? 'text-indigo-900' : 'text-gray-700'}`}>{node.name}</span>
          </div>
        </div>
        {expanded && hasChildren && (
          <div className="flex flex-col mt-0.5">
            {Object.values(node.children).sort((a,b) => a.name.localeCompare(b.name)).map(child => (
              <FolderNode key={child.path} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-1 h-full bg-white overflow-hidden">
      <div className="w-1/3 bg-gray-50/50 border-r border-gray-200 p-4 flex flex-col relative">
        {saving && <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-20" />}
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2"><FolderTree className="w-5 h-5"/> Directory</h2>
        </div>
        <div className="flex-1 overflow-y-auto pr-2 pb-8">
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDropOnFolder(e, '/root')}
            onClick={() => setActiveDirectory('/root')}
            className={`p-3 rounded cursor-pointer transition-colors flex items-center gap-3 mb-2 ${activeDirNorm === '/root' ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50 border border-transparent'}`}
          >
            <FolderTree className={`w-5 h-5 ${activeDirNorm === '/root' ? 'text-indigo-600' : 'text-gray-400'}`} />
            <span className={`font-bold ${activeDirNorm === '/root' ? 'text-indigo-900' : 'text-gray-700'}`}>/root</span>
          </div>

          <div className="flex flex-col gap-0.5">
            {tree['root'] && Object.values(tree['root'].children).sort((a,b) => a.name.localeCompare(b.name)).map(node => (
              <FolderNode key={node.path} node={node} level={0} />
            ))}
            {/* Edge case: folders not under /root */}
            {Object.keys(tree).filter(k => k !== 'root').map(k => (
              <FolderNode key={tree[k].path} node={tree[k]} level={0} />
            ))}
          </div>
        </div>
      </div>

      <div className="w-2/3 bg-white p-6 flex flex-col relative">
        {saving && <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-20" />}
        <div className="flex items-center gap-2 mb-4 border-b pb-4 shrink-0">
          <input 
            value={addressBar} 
            onChange={e => setAddressBar(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                 setActiveDirectory(normDir(addressBar.trim()));
              }
            }}
            placeholder="e.g. /root/math"
            className="font-black text-2xl text-gray-800 w-full outline-none bg-transparent placeholder-gray-300" 
          />
          <button 
            onClick={handleCreateFolder}
            className="px-4 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded font-bold transition shrink-0 whitespace-nowrap"
          >
            + New Folder
          </button>
        </div>

        {activeItems.length > 0 ? (
          <div className="flex justify-between items-center mb-3">
            <div className="flex gap-2">
              <button onClick={() => setSelectedItems(activeItems.map(x => x.id))} className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition">Select All</button>
              <button onClick={() => setSelectedItems([])} className="text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition">Clear</button>
              <button
                onClick={async () => {
                  if (!confirm(`Are you sure you want to permanently delete ${selectedItems.length} selected items? Any deleted modules or tests will also be wiped from assigned questions.`)) return;
                  setSaving(true);
                  const itemsToDelete = files.filter(f => selectedItems.includes(f.id));
                  const modIdsToDelete = [];
                  const testIdsToDelete = [];

                  for (const item of itemsToDelete) {
                    if (item.type === 'module' && item.reference_id) {
                      modIdsToDelete.push(item.reference_id);
                    } else if (item.type === 'test' && item.reference_id) {
                      testIdsToDelete.push(item.reference_id);
                    } else if (item.type === 'folder') {
                      const folderPath = `${item.parent_directory}/${item.name}`;
                      await supabase.from('files').update({ parent_directory: item.parent_directory }).eq('parent_directory', folderPath);
                    }
                  }

                  if (testIdsToDelete.length > 0) {
                    for (const testId of testIdsToDelete) {
                      const tFile = files.find(f => f.reference_id === testId && f.type === 'test');
                      if (tFile) {
                        const { data: subMods } = await supabase.from('modules').select('id').like('module_name', `${tFile.name} - %`);
                        if (subMods && subMods.length > 0) {
                          subMods.forEach(sm => modIdsToDelete.push(sm.id));
                        }
                      }
                    }
                    await supabase.from('practice_tests').delete().in('id', testIdsToDelete);
                  }

                  if (modIdsToDelete.length > 0) {
                    await supabase.from('modules').delete().in('id', modIdsToDelete);
                    await cleanupDeletedModulesFromDb(modIdsToDelete, supabase);
                  }

                  await supabase.from('files').delete().in('id', selectedItems);
                  if (modIdsToDelete.length > 0) {
                    await supabase.from('files').delete().in('reference_id', modIdsToDelete);
                  }

                  setSelectedItems([]);
                  onUpdate();
                  setSaving(false);
                }}
                disabled={saving}
                className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded transition flex items-center gap-1 disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" /> Delete {selectedItems.length} Selected
              </button>
            </div>
            <span className="text-xs font-bold text-gray-500">{selectedItems.length} selected</span>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto pr-2 pb-4">
          
          {activeItems.length === 0 ? (
            <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
              <FolderTree className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>This folder is empty.</p>
              <p className="text-xs">Drag items here from other folders.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              
              {activeChildFolders.map(f => (
                <div 
                  key={f.id} 
                  draggable 
                  onDragStart={(e) => handleDragStart(e, f)}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => { e.stopPropagation(); handleDropOnFolder(e, `${f.parent_directory}/${f.name}`); }}
                  onClick={() => setSelectedItems(p => p.includes(f.id) ? p.filter(x => x !== f.id) : [...p, f.id])}
                  onDoubleClick={() => setActiveDirectory(`${f.parent_directory}/${f.name}`)}
                  className={`p-4 border rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm hover:shadow-md transition cursor-grab active:cursor-grabbing relative group ${selectedItems.includes(f.id) ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-400' : 'bg-white border-gray-200 hover:border-indigo-300'}`}
                >
                  <input type="checkbox" checked={selectedItems.includes(f.id)} readOnly className="absolute top-3 left-3 w-4 h-4 cursor-pointer rounded border-gray-300" />
                  
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition">
                    <button onClick={(e) => { e.stopPropagation(); setEditingFileId(f.id); setEditName(f.name); }} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded bg-white/80 shadow-sm border border-gray-100"><Edit2 className="w-3.5 h-3.5"/></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f); }} className="p-1.5 text-red-400 hover:text-red-600 rounded bg-white/80 shadow-sm border border-gray-100"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>

                  <Folder className="w-16 h-16 text-indigo-500 fill-indigo-100 mt-2" strokeWidth={1.5} />
                  
                  <div className="w-full">
                    {editingFileId === f.id ? (
                      <input 
                        autoFocus 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)} 
                        onBlur={() => saveItemRename(f)}
                        onKeyDown={e => e.key === 'Enter' && saveItemRename(f)}
                        className="font-bold text-sm text-center text-gray-900 bg-white border border-indigo-400 rounded px-1 w-full outline-none shadow-sm"
                      />
                    ) : (
                      <h3 className="font-bold text-sm text-center text-gray-800 truncate w-full px-1" title={f.name}>{f.name}</h3>
                    )}
                  </div>
                </div>
              ))}

              {activeTestsFiles.map(f => {
                const t = testMap[f.reference_id];
                return (
                  <div 
                    key={f.id} 
                    draggable 
                    onDragStart={(e) => handleDragStart(e, f)}
                    onClick={() => setSelectedItems(p => p.includes(f.id) ? p.filter(x => x !== f.id) : [...p, f.id])}
                    className={`p-4 border rounded-xl flex flex-col items-center justify-center gap-2 shadow-sm hover:shadow-md transition cursor-grab active:cursor-grabbing relative group ${selectedItems.includes(f.id) ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-400' : 'bg-white border-gray-200 hover:border-purple-300'}`}
                  >
                    <input type="checkbox" checked={selectedItems.includes(f.id)} readOnly className="absolute top-3 left-3 w-4 h-4 cursor-pointer rounded border-gray-300" />
                    
                    <FileCheck className="w-16 h-16 text-purple-500 fill-purple-100 mt-2" strokeWidth={1.5} />
                    
                    <div className="w-full flex flex-col items-center gap-1">
                      <h3 className="font-bold text-sm text-center text-gray-800 truncate w-full px-1" title={f.name}>{f.name}</h3>
                      <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full max-w-full truncate" title={t ? `${t.test_type} • Level ${t.required_level ?? 1}` : 'Missing Data'}>Test</span>
                    </div>
                  </div>
                )
              })}

              {activeModulesFiles.map(f => {
                const m = moduleMap[f.reference_id];
                return (
                  <div 
                    key={f.id} 
                    draggable 
                    onDragStart={(e) => handleDragStart(e, f)}
                    onClick={() => setSelectedItems(p => p.includes(f.id) ? p.filter(x => x !== f.id) : [...p, f.id])}
                    className={`p-4 border rounded-xl flex flex-col items-center justify-center gap-2 shadow-sm hover:shadow-md transition cursor-grab active:cursor-grabbing relative group ${selectedItems.includes(f.id) ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-400' : 'bg-white border-gray-200 hover:border-blue-300'}`}
                  >
                    <input type="checkbox" checked={selectedItems.includes(f.id)} readOnly className="absolute top-3 left-3 w-4 h-4 cursor-pointer rounded border-gray-300" />
                    
                    <FileText className="w-16 h-16 text-blue-500 fill-blue-100 mt-2" strokeWidth={1.5} />
                    
                    <div className="w-full flex flex-col items-center gap-1">
                      <h3 className="font-bold text-sm text-center text-gray-800 truncate w-full px-1" title={f.name}>{f.name}</h3>
                      <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full max-w-full truncate" title={m ? `${m.question_ids?.length || 0} Questions • Level ${m.required_level ?? 1}` : 'Missing Data'}>Module</span>
                    </div>
                  </div>
                )
              })}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
