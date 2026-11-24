'use client'

import { useState, useEffect, useRef } from 'react'
import { getQuestionHashString, generateHash, getHashPrefix, getSprAnswerHashes } from '@/app/admin/AdminClient'
import RichText, { stripOptionLetter } from '@/components/RichText'
import { 
  fetchTotalQuestionsCountAction, 
  fetchQuestionsBatchAction, 
  fetchLatestQuestionsAction,
  fetchRestructuredQuestionsAction,
  calculateSingleImageHashAction,
  resolveDuplicateAction,
  bulkUpdateHashesAction 
} from '@/app/actions/rehashActions'
import { verifyToolAccessAction } from '@/app/actions/adminUserActions'

export default function HashRehashPage() {
  const [access, setAccess] = useState({ checked: false, authorized: false, level: 0, minReq: 9 })

  useEffect(() => {
    async function checkAccess() {
      const res = await verifyToolAccessAction('hash-rehash')
      setAccess({ checked: true, authorized: res.authorized, level: res.level, minReq: res.minReq })
    }
    checkAccess()
  }, [])

  const [status, setStatus] = useState('IDLE') // IDLE, SCANNING, RESOLVING, DONE
  const [logs, setLogs] = useState([])
  const [progress, setProgress] = useState({ current: 0, total: 0, imagesProcessed: 0 })
  
  const [currentConflict, setCurrentConflict] = useState(null)
  const resolvePromiseRef = useRef(null)
  
  // Hash Maps
  const optionsHashMapRef = useRef({})
  const restructuredHashMapRef = useRef({})
  const imageHashMapRef = useRef({})

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, {
      time: new Date().toLocaleTimeString(),
      msg,
      type
    }])
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Helper to process a single array of questions sequentially
  const processQuestionsArray = async (questionsArray) => {
    let pendingUpdates = [];

    const flushPendingUpdates = async () => {
      if (pendingUpdates.length === 0) return;
      addLog(`Uploading batch of ${pendingUpdates.length} hashes to DB...`);
      await bulkUpdateHashesAction(pendingUpdates);
      pendingUpdates = [];
    };

    for (const q of questionsArray) {
        // PRESERVE existing database state instead of forcing to false!
        const isRestructured = !!q.is_restructured_hash;

        // 1. Keep existing options_hash as is (for backward compatibility), or calculate if missing
        const basicFingerprint = getQuestionHashString(q, {}, false);
        const basicPrefix = getHashPrefix(q, false);
        let basicOptHash = q.options_hash || null;
        if (!basicOptHash && basicFingerprint !== '|||' && basicFingerprint !== '|') {
          basicOptHash = basicPrefix + (await generateHash(basicFingerprint));
        }
        q.new_options_hash = basicOptHash;

        // 2. Calculate all_options_hashes (new array column)
        let allOptHashes = [basicOptHash].filter(Boolean);
        const qType = (q.question_type || 'MCQ').toUpperCase();
        if (qType === 'SPR' && !isRestructured) {
          const sprHashes = await getSprAnswerHashes(q, false);
          if (sprHashes.length > 0) {
            allOptHashes = sprHashes;
          }
        }
        q.new_all_options_hashes = allOptHashes;

        // 2. ONLY calculate the restructured_hash if it has been restructured
        let restOptHash = null;
        if (isRestructured) {
          const restFingerprint = getQuestionHashString(q, {}, true);
          const restPrefix = getHashPrefix(q, true);
          if (restFingerprint !== '|||' && restFingerprint !== '|') {
            restOptHash = restPrefix + (await generateHash(restFingerprint));
          }
        }
        q.new_restructured_hash = restOptHash;

        let imgHash = null;
        if (q.image_url) {
          addLog(`Fetching image for QID: ${q.qid}...`)
          const { hash, error: hashError } = await calculateSingleImageHashAction(q.image_url)
          if (hashError) {
            addLog(`Failed to hash image for ${q.qid}: ${hashError}`, 'error')
          } else {
            imgHash = getHashPrefix(q, false) + hash;
          }
          setProgress(p => ({ ...p, imagesProcessed: p.imagesProcessed + 1 }))
          await sleep(1000); 
        }
        q.new_image_hash = imgHash;

        let isDuplicate = false;
        let duplicateOf = null;
        let conflictType = null;

        if (!isRestructured && allOptHashes.length > 0) {
          for (const h of allOptHashes) {
            if (optionsHashMapRef.current[h] && optionsHashMapRef.current[h].qid !== q.qid) {
              isDuplicate = true;
              duplicateOf = optionsHashMapRef.current[h];
              conflictType = 'OPTIONS';
              break;
            }
          }
        } else if (isRestructured && restOptHash && restructuredHashMapRef.current[restOptHash] && restructuredHashMapRef.current[restOptHash].qid !== q.qid) {
            isDuplicate = true;
            duplicateOf = restructuredHashMapRef.current[restOptHash];
            conflictType = 'RESTRUCTURED_OPTIONS';
        } else if (imgHash && imageHashMapRef.current[imgHash] && imageHashMapRef.current[imgHash].qid !== q.qid) {
            isDuplicate = true;
            duplicateOf = imageHashMapRef.current[imgHash];
            conflictType = 'IMAGE';
        }

        if (isDuplicate) {
          // Flush any pending updates before stopping for a conflict
          await flushPendingUpdates();

          addLog(`Duplicate found! ${q.qid} matches ${duplicateOf.qid} (${conflictType})`, 'warning')
          setCurrentConflict({ q1: duplicateOf, q2: q, type: conflictType })
          setStatus('RESOLVING')
          
          const result = await new Promise(resolve => {
            resolvePromiseRef.current = resolve;
          });
          
          setStatus('SCANNING')
          setCurrentConflict(null)
          
          if (result.action === 'DELETE' && result.modifiedQid === q.qid) {
             setProgress(p => ({ ...p, current: p.current + 1 }))
             continue; // q was deleted, skip saving it
          }
          
          if (result.action === 'RESTRUCTURE' && result.modifiedQid === q.qid) {
             // result.newOptHash is the new extended hash. Put it in restructured_hash.
             q.new_restructured_hash = result.newOptHash;
             q.new_image_hash = result.newImgHash;
             q.is_restructured_hash = true; // Update local state
             setProgress(p => ({ ...p, current: p.current + 1 }))
             continue;
          }
          
          if (!isRestructured && q.new_all_options_hashes?.length > 0) {
            q.new_all_options_hashes.forEach(h => {
              if (h) optionsHashMapRef.current[h] = q;
            });
          }
          if (isRestructured && q.new_restructured_hash) restructuredHashMapRef.current[q.new_restructured_hash] = q;
          if (q.new_image_hash) imageHashMapRef.current[q.new_image_hash] = q;
          
          pendingUpdates.push({
            qid: q.qid,
            options_hash: q.new_options_hash,
            all_options_hashes: q.new_all_options_hashes,
            restructured_hash: q.new_restructured_hash,
            image_hash: q.new_image_hash,
            is_restructured_hash: isRestructured
          });
        } else {
          if (!isRestructured && q.new_all_options_hashes?.length > 0) {
            q.new_all_options_hashes.forEach(h => {
              if (h) optionsHashMapRef.current[h] = q;
            });
          }
          if (isRestructured && q.new_restructured_hash) restructuredHashMapRef.current[q.new_restructured_hash] = q;
          if (q.new_image_hash) imageHashMapRef.current[q.new_image_hash] = q;
          
          pendingUpdates.push({
            qid: q.qid,
            options_hash: q.new_options_hash,
            all_options_hashes: q.new_all_options_hashes,
            restructured_hash: q.new_restructured_hash,
            image_hash: q.new_image_hash,
            is_restructured_hash: isRestructured
          });
        }

        if (pendingUpdates.length >= 50) {
          await flushPendingUpdates();
        }

        setProgress(p => ({ ...p, current: p.current + 1 }))
    }

    // Flush any remaining updates
    await flushPendingUpdates();

    addLog(`Scan complete.`, 'success')
    setStatus('DONE')
  }

  const startScan = async () => {
    setStatus('SCANNING')
    setLogs([])
    setCurrentConflict(null)
    optionsHashMapRef.current = {}
    restructuredHashMapRef.current = {}
    imageHashMapRef.current = {}

    addLog('Counting total questions in database...')
    const { count, error } = await fetchTotalQuestionsCountAction()
    
    if (error) {
      addLog(`Error fetching count: ${error}`, 'error')
      setStatus('IDLE')
      return
    }

    setProgress({ current: 0, total: count, imagesProcessed: 0 })
    addLog(`Total questions: ${count}. Downloading to memory to prevent DB shifts...`)

    let allQuestions = [];
    const fetchBatchSize = 20;
    let offset = 0;
    while(offset < count) {
      addLog(`Downloading ${offset} to ${offset + fetchBatchSize}...`);
      const { data: batch, error: batchError } = await fetchQuestionsBatchAction(offset, fetchBatchSize);
      if (batchError) {
        addLog(`Error downloading: ${batchError}`, 'error');
        setStatus('IDLE');
        return;
      }
      if (!batch || batch.length === 0) break;
      allQuestions = allQuestions.concat(batch);
      offset += fetchBatchSize;
    }

    addLog(`Downloaded ${allQuestions.length} questions. Starting local hash processing...`)

    // Process from local memory sequentially. No more batch fetching overlaps.
    await processQuestionsArray(allQuestions);
  }

  const startTestScan = async () => {
    setStatus('SCANNING')
    setLogs([])
    setCurrentConflict(null)
    optionsHashMapRef.current = {}
    restructuredHashMapRef.current = {}
    imageHashMapRef.current = {}

    addLog('Fetching latest 15 junk questions for testing...')
    const { data: batch, error: batchError } = await fetchLatestQuestionsAction(15)
    
    if (batchError) {
      addLog(`Error fetching test batch: ${batchError}`, 'error')
      setStatus('IDLE')
      return
    }

    if (!batch || batch.length === 0) {
      addLog(`No questions found.`, 'warning')
      setStatus('IDLE')
      return;
    }

    setProgress({ current: 0, total: batch.length, imagesProcessed: 0 })
    addLog(`Total test questions to process: ${batch.length}`)

    await processQuestionsArray(batch);
  }

  const startHealScan = async () => {
    setStatus('SCANNING')
    setLogs([])
    setCurrentConflict(null)
    optionsHashMapRef.current = {}
    restructuredHashMapRef.current = {}
    imageHashMapRef.current = {}

    addLog('Fetching ALL restructured questions from database to heal them...')
    const { data: batch, error: batchError } = await fetchRestructuredQuestionsAction()
    
    if (batchError) {
      addLog(`Error fetching restructured questions: ${batchError}`, 'error')
      setStatus('IDLE')
      return
    }

    if (!batch || batch.length === 0) {
      addLog(`No restructured questions found. Database is healthy!`, 'success')
      setStatus('IDLE')
      return;
    }

    setProgress({ current: 0, total: batch.length, imagesProcessed: 0 })
    addLog(`Total restructured questions to heal: ${batch.length}`)

    await processQuestionsArray(batch);
  }

  const startSprMigrationScan = async () => {
    setStatus('SCANNING')
    setLogs([])
    setCurrentConflict(null)
    optionsHashMapRef.current = {}
    restructuredHashMapRef.current = {}
    imageHashMapRef.current = {}

    addLog('Starting dedicated SPR Multi-Hash Migration Scan...')
    addLog('Counting total questions in database...')
    const { count, error } = await fetchTotalQuestionsCountAction()
    
    if (error) {
      addLog(`Error fetching count: ${error}`, 'error')
      setStatus('IDLE')
      return
    }

    setProgress({ current: 0, total: count, imagesProcessed: 0 })
    addLog(`Total questions: ${count}. Downloading to memory...`)

    let allQuestions = [];
    const fetchBatchSize = 20;
    let offset = 0;
    while(offset < count) {
      addLog(`Downloading ${offset} to ${offset + fetchBatchSize}...`);
      const { data: batch, error: batchError } = await fetchQuestionsBatchAction(offset, fetchBatchSize);
      if (batchError) {
        addLog(`Error downloading: ${batchError}`, 'error');
        setStatus('IDLE');
        return;
      }
      if (!batch || batch.length === 0) break;
      allQuestions = allQuestions.concat(batch);
      offset += fetchBatchSize;
    }

    addLog(`Downloaded ${allQuestions.length} questions. Populating all_options_hashes array while keeping legacy options_hash untouched...`)

    await processQuestionsArray(allQuestions);
  }

  const handleResolveRealtime = async (actionType, qToModify) => {
    addLog(`Real-time saving: ${actionType} on ${qToModify.qid}...`)
    
    const oldOptHash = qToModify.new_options_hash;
    const oldImgHash = qToModify.new_image_hash;

    let newOptionsHash = oldOptHash;
    let newImageHash = oldImgHash;
    
    if (actionType === 'RESTRUCTURE') {
      const fingerprintString = getQuestionHashString(qToModify, {}, true); 
      const prefix = getHashPrefix(qToModify, true);
      if (fingerprintString !== '|||' && fingerprintString !== '|') {
        newOptionsHash = prefix + (await generateHash(fingerprintString));
      } else {
        newOptionsHash = null;
      }
      if (newImageHash) {
        newImageHash = getHashPrefix(qToModify, true) + newImageHash.split('_')[1];
      }
    }

    const { error } = await resolveDuplicateAction(
      actionType, 
      qToModify.qid, 
      newOptionsHash, 
      newImageHash
    );

    if (error) {
      addLog(`Failed to save resolution: ${error}`, 'error')
      alert(`Failed to save: ${error}`)
      return;
    }

    addLog(`Successfully applied ${actionType} to ${qToModify.qid}!`, 'success')
    
    if (optionsHashMapRef.current[oldOptHash]?.qid === qToModify.qid) {
        // Technically oldOptHash was the options_hash, which we keep, so no need to delete it.
        // But if we generated a new options_hash (which we didn't, we generated a new restructured_hash)
        // Wait, the oldOptHash passed here was qToModify.new_options_hash.
        // If it was a basic hash, it stays. We don't delete basic hashes when restructuring.
    }
    // Note: oldImgHash should be deleted if the image actually changed, but for now we leave it alone.

    if (actionType === 'RESTRUCTURE') {
       if (newOptionsHash) restructuredHashMapRef.current[newOptionsHash] = qToModify;
       if (newImageHash) imageHashMapRef.current[newImageHash] = qToModify;
    }

    // Resume the scan loop!
    if (resolvePromiseRef.current) {
        resolvePromiseRef.current({
           action: actionType,
           modifiedQid: qToModify.qid,
           newOptHash: newOptionsHash,
           newImgHash: newImageHash
        });
    }
  }

  // Large Preview Render Logic
  const renderPreviewBox = (q, label) => {
    const hasLeftSide = !!(q.context || q.image_url);
    const displayImageUrl = q.image_url ? (q.image_url.startsWith('http') ? q.image_url : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/question_images/public/${q.image_url}`) : null;

    return (
      <div className="w-1/2 flex flex-col bg-[#aaaaaa] border border-gray-400 rounded-lg shadow-xl shrink-0 overflow-hidden" style={{ minHeight: '600px' }}>
        <header className="flex justify-between items-center px-4 py-3 bg-[#162444] text-white shadow-sm shrink-0">
          <div className="font-bold text-sm tracking-wider">
            {label}: {q.qid}
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleResolveRealtime('RESTRUCTURE', q)} className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs">
              Restructure
            </button>
            <button onClick={() => handleResolveRealtime('DELETE', q)} className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs">
              Delete
            </button>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden relative bg-white">
          {hasLeftSide ? (
            <>
              <div className="w-1/2 h-full overflow-y-auto bg-white p-6 border-r border-gray-300 text-sm">
                {displayImageUrl && (
                  <div className="mb-4 flex justify-center w-full">
                    <img src={displayImageUrl} alt="Reference figure" className="max-w-full h-auto object-contain rounded border border-gray-300" style={{ maxHeight: '30vh' }} />
                  </div>
                )}
                {q.context && <div className="prose prose-sm max-w-none text-black"><RichText content={q.context} /></div>}
              </div>
              <div className="w-1 bg-gray-300 flex-shrink-0"></div>
              <div className="w-1/2 h-full overflow-y-auto bg-white p-6 text-sm flex flex-col">
                <div className="prose prose-sm max-w-none text-black mb-6">
                  <RichText content={q.question} />
                </div>
                <div className="space-y-3 w-full">
                  {['a', 'b', 'c', 'd'].map((letter) => {
                    const opt = q[`option_${letter}`] || q[`option_${letter.toUpperCase()}`]
                    if (!opt) return null
                    const cleanOpt = stripOptionLetter(opt)
                    return (
                      <div key={letter} className="flex items-center gap-3 w-full bg-gray-50 border border-gray-200 rounded p-2">
                        <div className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-400 font-bold text-gray-600 uppercase text-xs">
                          {letter}
                        </div>
                        <div className="flex-1 text-black prose prose-sm max-w-none [&_p]:mb-0">
                          <RichText content={cleanOpt} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full overflow-y-auto bg-white p-6 flex flex-col max-w-3xl mx-auto">
                <div className="prose prose-sm max-w-none text-black mb-6">
                  <RichText content={q.question} />
                </div>
                <div className="space-y-3 w-full">
                  {['a', 'b', 'c', 'd'].map((letter) => {
                    const opt = q[`option_${letter}`] || q[`option_${letter.toUpperCase()}`]
                    if (!opt) return null
                    const cleanOpt = stripOptionLetter(opt)
                    return (
                      <div key={letter} className="flex items-center gap-3 w-full bg-gray-50 border border-gray-200 rounded p-3">
                        <div className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-gray-400 font-bold text-gray-600 uppercase text-sm">
                          {letter}
                        </div>
                        <div className="flex-1 text-black prose prose-sm max-w-none [&_p]:mb-0">
                          <RichText content={cleanOpt} />
                        </div>
                      </div>
                    )
                  })}
                </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  if (!access.checked) {
    return <div className="flex items-center justify-center h-full p-12 font-bold text-gray-500">Checking authorization clearance...</div>
  }

  if (!access.authorized) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center bg-gray-50 flex-1 min-h-[600px]">
        <div className="w-20 h-20 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-red-600 text-3xl font-black mb-6 shadow-sm">🔒</div>
        <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Access Restricted</h2>
        <p className="text-gray-600 max-w-md mb-6">This administrative tool strictly requires <span className="font-bold text-gray-900">Level {access.minReq}</span> clearance as configured in the Owner Control Room. Your current role tier is <span className="font-bold text-red-600">Level {access.level}</span>.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900 flex flex-col h-screen">
      <div className="w-full mx-auto space-y-6 flex flex-col h-full max-w-[1600px]">
        
        <header className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Database Hash Rehasher & Duplicate Finder</h1>
            <p className="text-sm text-gray-500 mt-1">Populates multi-hash array (<code>all_options_hashes</code>) for SPR questions while keeping legacy <code>options_hash</code> untouched!</p>
          </div>
          <div>
            {status === 'IDLE' && (
              <div className="flex gap-4">
                <button onClick={startSprMigrationScan} className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold shadow-md hover:bg-emerald-700 transition">
                  Migrate SPR Multi-Hashes (New Column)
                </button>
                <button onClick={startHealScan} className="px-6 py-3 bg-amber-500 text-white rounded-lg font-bold shadow-md hover:bg-amber-600 transition">
                  Heal Restructured Hashes
                </button>
                <button onClick={startTestScan} className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 transition">
                  Test Scan (Latest 15)
                </button>
                <button onClick={startScan} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700 transition">
                  Start Full Database Scan
                </button>
              </div>
            )}
            {status === 'SCANNING' && (
              <div className="px-6 py-3 bg-blue-100 text-blue-800 rounded-lg font-bold animate-pulse">
                Scanning in progress...
              </div>
            )}
            {status === 'RESOLVING' && (
              <div className="px-6 py-3 bg-red-100 text-red-800 rounded-lg font-bold animate-pulse">
                Paused for Collision
              </div>
            )}
            {status === 'DONE' && (
              <div className="px-6 py-3 bg-green-100 text-green-800 rounded-lg font-bold">
                Process Complete!
              </div>
            )}
          </div>
        </header>

        {/* Progress Card */}
        {(status !== 'IDLE') && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 shrink-0">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Scan Progress</h2>
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold">{progress.current} / {progress.total} questions processed & updated</span>
              <span className="text-sm text-gray-500">{progress.imagesProcessed} images hashed</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${(progress.current / Math.max(1, progress.total)) * 100}%` }}></div>
            </div>
          </div>
        )}

        <div className="flex gap-6 flex-1 min-h-0">
          
          <div className="flex-1 flex flex-col min-w-0 h-full">
            {/* Duplicates Review */}
            {status === 'RESOLVING' && currentConflict ? (
              <div className="bg-white p-6 rounded-xl shadow-sm border-2 border-red-400 flex flex-col h-full min-h-0">
                <div className="flex justify-between items-center mb-4 shrink-0">
                  <h2 className="text-lg font-black text-red-600 flex items-center gap-2">
                    Action Required: {currentConflict.type} Collision Detected!
                  </h2>
                  <span className="text-xs font-bold text-gray-500">Scan is paused. You must resolve this conflict to continue.</span>
                </div>
                
                <div className="flex gap-6 flex-1 min-h-0">
                   {renderPreviewBox(currentConflict.q1, 'Existing DB Match')}
                   {renderPreviewBox(currentConflict.q2, 'Current Question')}
                </div>
              </div>
            ) : (
              <div className="bg-gray-100 rounded-xl border border-gray-200 flex-1 flex items-center justify-center text-gray-400 font-bold text-lg">
                 {status === 'DONE' ? 'All questions processed successfully!' : 'Scan running... Waiting for conflicts.'}
              </div>
            )}
          </div>

          <div className="w-96 shrink-0">
            <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800 p-4 h-full flex flex-col">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 shrink-0 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> Live Logs
              </h2>
              <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className={`${
                    log.type === 'error' ? 'text-red-400' : 
                    log.type === 'warning' ? 'text-amber-400' : 
                    log.type === 'success' ? 'text-green-400' : 'text-gray-300'
                  }`}>
                    <span className="text-gray-600">[{log.time}]</span> {log.msg}
                  </div>
                ))}
                {logs.length === 0 && <div className="text-gray-600 italic">No logs yet...</div>}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
