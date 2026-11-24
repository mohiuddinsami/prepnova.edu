'use client'

import { useState, useRef } from 'react'
import { QuestionPreviewModal } from '../AdminClient'
import BulkTesterEngine from './BulkTesterEngine'
import { UploadCloud, CheckCircle, FileJson, Image as ImageIcon, X } from 'lucide-react'

export default function BulkTesterClient() {
  const [parsedQuestions, setParsedQuestions] = useState([])
  const [imageMap, setImageMap] = useState({})
  const [previewQuestion, setPreviewQuestion] = useState(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationQuestions, setSimulationQuestions] = useState([])
  
  const [jsonFile, setJsonFile] = useState(null)
  const [imageFiles, setImageFiles] = useState([])
  
  const jsonInputRef = useRef(null)
  const imageInputRef = useRef(null)

  const handleJsonUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setJsonFile(file)
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result)
        const qArray = Array.isArray(data) ? data : (data.questions || [])
        setParsedQuestions(qArray)
      } catch (err) {
        alert("Failed to parse JSON file.")
      }
    }
    reader.readAsText(file)
  }

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    
    setImageFiles(prev => [...prev, ...files])
    
    // Create object URLs mapping filename -> URL
    const newMap = { ...imageMap }
    files.forEach(f => {
      newMap[f.name] = URL.createObjectURL(f)
    })
    setImageMap(newMap)
  }

  const removeImage = (index) => {
    const newFiles = [...imageFiles]
    const file = newFiles[index]
    
    // Clean up URL object
    if (imageMap[file.name]) {
      URL.revokeObjectURL(imageMap[file.name])
      const newMap = { ...imageMap }
      delete newMap[file.name]
      setImageMap(newMap)
    }
    
    newFiles.splice(index, 1)
    setImageFiles(newFiles)
  }

  // Pre-process the question to inject local RAM image URLs before passing to preview
  const getProcessedQuestion = (q) => {
    // Deep copy to avoid mutating original
    const newQ = JSON.parse(JSON.stringify(q))

    // Normalize keys to lowercase for options
    if (newQ.option_A) { newQ.option_a = newQ.option_A; delete newQ.option_A; }
    if (newQ.option_B) { newQ.option_b = newQ.option_B; delete newQ.option_B; }
    if (newQ.option_C) { newQ.option_c = newQ.option_C; delete newQ.option_C; }
    if (newQ.option_D) { newQ.option_d = newQ.option_D; delete newQ.option_D; }
    
    // Helper to replace filename with object URL
    const injectObjectUrl = (str) => {
      if (typeof str !== 'string') return str
      
      let res = str
      Object.keys(imageMap).forEach(filename => {
        // Replace exact matches or references in options like "text || filename"
        
        // Exact match
        if (res === filename || res === `math/${filename}` || res === `rw/${filename}`) {
          res = imageMap[filename]
        }
        
        // Inside options (e.g., "|| filename")
        if (res.includes(filename)) {
          res = res.replace(filename, imageMap[filename])
        }
      })
      return res
    }

    newQ.image_url = injectObjectUrl(newQ.image_url)
    newQ.context = injectObjectUrl(newQ.context)
    newQ.question = injectObjectUrl(newQ.question)
    newQ.option_a = injectObjectUrl(newQ.option_a)
    newQ.option_b = injectObjectUrl(newQ.option_b)
    newQ.option_c = injectObjectUrl(newQ.option_c)
    newQ.option_d = injectObjectUrl(newQ.option_d)
    newQ.correct_answer = injectObjectUrl(newQ.correct_answer)
    newQ.correct_answer_explanation = injectObjectUrl(newQ.correct_answer_explanation)

    return newQ
  }

  return (
    <div className="flex flex-col h-full w-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-6 shrink-0 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <div className="flex items-center gap-3 font-black text-xl text-gray-800">
            <UploadCloud className="text-blue-500 w-6 h-6" />
            <span>Sanitized Bulk Tester (Local RAM)</span>
          </div>
          <p className="text-sm text-gray-600">
            Validate and preview your JSON question banks locally in the browser. <b>No data is uploaded to the production database.</b>
          </p>

          <div className="flex gap-6 mt-4">
            {/* JSON Uploader */}
            <div className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 flex flex-col items-center justify-center hover:bg-gray-100 transition-colors relative cursor-pointer" onClick={() => jsonInputRef.current?.click()}>
              <input type="file" accept=".json" className="hidden" ref={jsonInputRef} onChange={handleJsonUpload} />
              <FileJson className="w-8 h-8 text-blue-500 mb-2" />
              <span className="font-bold text-gray-700">{jsonFile ? jsonFile.name : 'Click to Upload JSON Array'}</span>
              {parsedQuestions.length > 0 && <span className="text-xs text-green-600 font-bold mt-2"><CheckCircle className="w-3 h-3 inline mr-1"/> Parsed {parsedQuestions.length} Questions</span>}
            </div>

            {/* Images Uploader */}
            <div className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 flex flex-col items-center justify-center hover:bg-gray-100 transition-colors relative cursor-pointer" onClick={() => imageInputRef.current?.click()}>
              <input type="file" accept="image/*" multiple className="hidden" ref={imageInputRef} onChange={handleImageUpload} />
              <ImageIcon className="w-8 h-8 text-pink-500 mb-2" />
              <span className="font-bold text-gray-700">Click to Upload Reference Images</span>
              {imageFiles.length > 0 && <span className="text-xs text-pink-600 font-bold mt-2"><CheckCircle className="w-3 h-3 inline mr-1"/> Loaded {imageFiles.length} Images to RAM</span>}
            </div>
          </div>
          
          {/* Image Thumbnail Track */}
          {imageFiles.length > 0 && (
            <div className="flex gap-2 overflow-x-auto py-2">
              {imageFiles.map((file, i) => (
                <div key={i} className="relative group shrink-0">
                  <img src={imageMap[file.name]} alt={file.name} className="h-12 w-12 object-cover rounded border border-gray-300" title={file.name} />
                  <button onClick={(e) => { e.stopPropagation(); removeImage(i); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {parsedQuestions.length > 0 && (
            <div className="mt-2 pt-4 border-t border-gray-200 flex justify-end">
              <button 
                onClick={() => {
                  const processed = parsedQuestions.map(getProcessedQuestion)
                  setSimulationQuestions(processed)
                  setIsSimulating(true)
                }}
                className="px-6 py-3 bg-[#162444] text-white rounded-lg font-bold text-sm hover:opacity-90 shadow-lg flex items-center gap-2 transition"
              >
                Simulate Full Test (Fullscreen)
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-6 max-w-7xl mx-auto w-full">
        {parsedQuestions.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600 font-bold border-b border-gray-200">
                <tr>
                  <th className="p-4">QID</th>
                  <th className="p-4">Subject</th>
                  <th className="p-4">Topic</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Diff</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsedQuestions.map((q, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-mono font-bold text-gray-800">{q.qid || `Unknown-${idx}`}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded bg-indigo-100 text-indigo-700 text-xs font-bold">{q.subject_tag || 'N/A'}</span>
                    </td>
                    <td className="p-4 text-gray-600 truncate max-w-[200px]" title={q.topic_tag}>{q.topic_tag || 'N/A'}</td>
                    <td className="p-4 font-bold text-gray-600">{q.question_type || 'MCQ'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        q.difficulty === 'Hard' ? 'bg-red-100 text-red-700' :
                        q.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>{q.difficulty || 'Easy'}</span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => setPreviewQuestion(getProcessedQuestion(q))}
                        className="px-4 py-1.5 bg-blue-600 text-white rounded-md font-bold text-xs hover:bg-blue-700 shadow-sm transition-colors"
                      >
                        Preview
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-400 font-bold border-2 border-dashed border-gray-200 rounded-lg">
            Upload a JSON file above to see the questions parsed in RAM.
          </div>
        )}
      </div>

      {previewQuestion && (
        <QuestionPreviewModal 
          question={previewQuestion} 
          onClose={() => setPreviewQuestion(null)} 
        />
      )}

      {isSimulating && (
        <BulkTesterEngine
          questions={simulationQuestions}
          onClose={() => setIsSimulating(false)}
        />
      )}
    </div>
  )
}
