'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Edit2, FolderTree, Folder, Video, FileText, ExternalLink, ArrowLeft, ChevronRight, Check, Sparkles, X, Loader2 } from 'lucide-react'
import { addClassPackageAction, updateClassPackageAction, deleteClassPackageAction, createFolderAction, deleteFolderAction, fetchYouTubeMetadataAction, fetchResourceTitleAction } from './actions'

export default function ClassesClient({ initialClasses = [], initialFiles = [] }) {
  const router = useRouter()
  const [activeFolder, setActiveFolder] = useState('/root/classes')
  const [classesList, setClassesList] = useState(initialClasses)
  const [filesList, setFilesList] = useState(initialFiles)

  useEffect(() => {
    setClassesList(initialClasses)
  }, [initialClasses])

  useEffect(() => {
    setFilesList(initialFiles)
  }, [initialFiles])

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Form state (start empty)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('General')
  const [requiredLevel, setRequiredLevel] = useState(1)
  const [recordings, setRecordings] = useState([])
  const [resources, setResources] = useState([])
  const [editingId, setEditingId] = useState(null)

  // Video Popup Modal State
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [videoModalUrl, setVideoModalUrl] = useState('')
  const [videoModalTitle, setVideoModalTitle] = useState('')
  const [videoModalDuration, setVideoModalDuration] = useState('45m')
  const [videoModalThumb, setVideoModalThumb] = useState('')
  const [videoModalDesc, setVideoModalDesc] = useState('')
  const [fetchingVideo, setFetchingVideo] = useState(false)
  const [videoFetchError, setVideoFetchError] = useState('')
  const [fetchedSuccess, setFetchedSuccess] = useState(false)

  // Resource Popup Modal State
  const [showResModal, setShowResModal] = useState(false)
  const [resModalType, setResModalType] = useState('slide')
  const [resModalTitle, setResModalTitle] = useState('')
  const [resModalUrl, setResModalUrl] = useState('')
  const [fetchingRes, setFetchingRes] = useState(false)

  // Normalize active folder
  const normFolder = activeFolder.replace(/\/+$/, '') || '/root/classes'

  // Map class reference IDs to class data
  const classMap = {}
  classesList.forEach(c => { classMap[c.id] = c })

  // Get items in current active folder
  const activeItems = filesList.filter(f => f.parent_directory === normFolder)
  const subFolders = activeItems.filter(f => f.type === 'folder')
  const classFiles = activeItems.filter(f => f.type === 'class').sort((a, b) => {
    const timeA = new Date(classMap[a.reference_id]?.created_at || a.created_at || 0).getTime()
    const timeB = new Date(classMap[b.reference_id]?.created_at || b.created_at || 0).getTime()
    return timeB - timeA
  })

  // Also include any classes that might not have a files pointer yet (legacy backward compatibility)
  const unassignedClasses = classesList.filter(c => !filesList.some(f => f.reference_id === c.id)).sort((a, b) => {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  })

  // Open Video Modal
  const handleOpenVideoModal = () => {
    setVideoModalUrl('')
    setVideoModalTitle('')
    setVideoModalDuration('45m')
    setVideoModalThumb('')
    setVideoModalDesc('')
    setVideoFetchError('')
    setFetchedSuccess(false)
    setShowVideoModal(true)
  }

  // Fetch YouTube Metadata inside Modal
  const handleFetchVideoInfo = async (urlToFetch) => {
    const targetUrl = urlToFetch || videoModalUrl
    if (!targetUrl.trim()) {
      setVideoFetchError('Please paste a YouTube link or Video ID.')
      return
    }
    setFetchingVideo(true)
    setVideoFetchError('')
    setFetchedSuccess(false)
    const res = await fetchYouTubeMetadataAction(targetUrl.trim())
    setFetchingVideo(false)
    if (res.error) {
      setVideoFetchError(res.error)
    } else {
      setVideoModalTitle(res.title || `Part ${recordings.length + 1}`)
      if (res.duration) setVideoModalDuration(res.duration)
      if (res.thumbnail_url) setVideoModalThumb(res.thumbnail_url)
      if (res.description) {
        setVideoModalDesc(res.description)
        if (!description) setDescription(res.description)
      }
      setFetchedSuccess(true)
    }
  }

  // Confirm Add Video Part from Modal
  const handleConfirmAddVideo = () => {
    if (!videoModalUrl.trim()) {
      setVideoFetchError('Please paste a YouTube link or Video ID.')
      return
    }
    const newPart = {
      id: crypto.randomUUID(),
      title: videoModalTitle.trim() || `Part ${recordings.length + 1}`,
      video_id: videoModalUrl.trim(),
      duration: videoModalDuration.trim() || '45m',
      thumbnail_url: videoModalThumb || null
    }
    setRecordings([...recordings, newPart])
    setShowVideoModal(false)
  }

  const handleRemoveRecordingRow = (index) => {
    setRecordings(recordings.filter((_, i) => i !== index))
  }

  const handleRecordingChange = (index, field, val) => {
    const updated = [...recordings]
    updated[index][field] = val
    setRecordings(updated)
  }

  // Open Resource Modal
  const handleOpenResModal = () => {
    setResModalTitle('')
    setResModalUrl('')
    setResModalType('slide')
    setShowResModal(true)
  }

  const formatDriveEmbedUrl = (url) => {
    if (!url) return ''
    const str = url.trim()
    const match = str.match(/(?:drive\.google\.com\/(?:file\/d\/|presentation\/d\/|open\?id=)|docs\.google\.com\/presentation\/d\/)([\w-]+)/i)
    if (match && match[1]) {
      return `https://drive.google.com/file/d/${match[1]}/preview`
    }
    return str
  }

  const handleFetchResourceInfo = async () => {
    if (!resModalUrl.trim()) {
      alert('Please enter a URL first.')
      return
    }
    setFetchingRes(true)
    const formatted = formatDriveEmbedUrl(resModalUrl)
    setResModalUrl(formatted)
    
    const res = await fetchResourceTitleAction(resModalUrl)
    setFetchingRes(false)
    if (res && res.title) {
      setResModalTitle(res.title)
      if (res.url) setResModalUrl(res.url)
    } else if (!resModalTitle.trim()) {
      if (formatted.includes('drive.google.com')) {
        setResModalTitle(resModalType === 'slide' ? 'Class Slide Deck & Notes' : resModalType === 'formula' ? 'Class PDF Formula Sheet' : 'Class PDF Worksheet')
      } else {
        setResModalTitle('Attached Class Resource')
      }
    }
  }

  // Confirm Add Resource from Modal
  const handleConfirmAddResource = () => {
    if (!resModalTitle.trim() || !resModalUrl.trim()) {
      alert('Please provide both Resource Title and URL.')
      return
    }
    const finalUrl = formatDriveEmbedUrl(resModalUrl)
    const newRes = {
      id: crypto.randomUUID(),
      title: resModalTitle.trim(),
      url: finalUrl,
      type: resModalType
    }
    setResources([...resources, newRes])
    setShowResModal(false)
  }

  const handleRemoveResourceRow = (index) => {
    setResources(resources.filter((_, i) => i !== index))
  }

  const handleResourceChange = (index, field, val) => {
    const updated = [...resources]
    updated[index][field] = val
    setResources(updated)
  }

  const handleCreateFolder = async () => {
    const name = prompt('Enter new folder name:')
    if (!name || !name.trim()) return
    setLoading(true)
    const res = await createFolderAction(name.trim(), normFolder)
    if (res.error) alert(res.error)
    else window.location.reload()
    setLoading(false)
  }

  const handleDeleteFolderItem = async (folder) => {
    if (!confirm(`Delete folder "${folder.name}"?`)) return
    setLoading(true)
    await deleteFolderAction(folder.id, `${folder.parent_directory}/${folder.name}`)
    window.location.reload()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    if (recordings.length === 0) {
      setErrorMsg('Please attach at least one Video Playlist Part before saving.')
      return
    }
    setLoading(true)

    // Sanitize recordings to plain serializable objects
    const cleanRecordings = recordings.map(rec => ({
      id: rec.id || '',
      title: rec.title || '',
      video_id: rec.video_id || '',
      duration: rec.duration || '45m',
      thumbnail_url: rec.thumbnail_url || null
    }))

    const cleanResources = resources.map(res => ({
      id: res.id || '',
      title: res.title || '',
      url: res.url || '',
      type: res.type || 'link'
    }))

    const payload = {
      title: title || '',
      description: description || '',
      subject: subject || 'General',
      required_level: requiredLevel,
      parent_directory: normFolder,
      recordings: cleanRecordings,
      resources: cleanResources
    }

    try {
      let res
      if (editingId) {
        res = await updateClassPackageAction(editingId, payload)
      } else {
        res = await addClassPackageAction(payload)
      }

      setLoading(false)
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setSuccessMsg(res.success || 'Saved!')
        if (res.classItem && !editingId) {
          setClassesList([res.classItem, ...classesList])
          setFilesList([...filesList, {
            id: crypto.randomUUID(),
            name: res.classItem.title,
            type: 'class',
            parent_directory: normFolder,
            reference_id: res.classItem.id
          }])
        } else if (editingId) {
          setClassesList(classesList.map(c => c.id === editingId ? { ...c, ...payload } : c))
          if (payload.title) {
            setFilesList(filesList.map(f => f.reference_id === editingId ? { ...f, name: payload.title } : f))
          }
        }
        resetForm()
        router.refresh()
      }
    } catch (err) {
      setLoading(false)
      setErrorMsg(`Action failed: ${err.message || String(err)}`)
    }
  }

  const startEdit = (cls) => {
    setEditingId(cls.id)
    setTitle(cls.title)
    setDescription(cls.description || '')
    setSubject(cls.subject || 'General')
    setRequiredLevel(cls.required_level ?? 1)
    
    // If legacy class had only video_id (or recordings array item has empty video_id), fall back to legacy video_id
    let loadedRecordings = cls.recordings || []
    if ((!loadedRecordings || loadedRecordings.length === 0 || !loadedRecordings[0]?.video_id) && cls.video_id) {
      loadedRecordings = [{ id: '1', title: 'Main Lecture', video_id: cls.video_id, duration: cls.duration || '1h 00m' }]
    }
    setRecordings(loadedRecordings)
    setResources(cls.resources || [])
  }

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setDescription('')
    setSubject('General')
    setRequiredLevel(1)
    setRecordings([])
    setResources([])
  }

  const handleDeleteClass = async (id) => {
    if (!confirm('Are you sure you want to delete this class package?')) return
    setLoading(true)
    await deleteClassPackageAction(id)
    window.location.reload()
  }

  const breadcrumbs = normFolder.split('/').filter(Boolean)

  return (
    <div className="flex flex-1 h-full bg-gray-100 overflow-hidden text-gray-900 font-sans relative">
      
      {/* Left Sidebar: Folder Browser & Class List (Compact Width: 400px) */}
      <div className="w-[400px] bg-white border-r border-gray-300 flex flex-col h-full shrink-0 shadow-sm">
        
        {/* Breadcrumbs & Action Buttons Header */}
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto text-xs font-bold text-gray-700">
              <button onClick={() => setActiveFolder('/root/classes')} className="hover:text-blue-600 transition flex items-center gap-1 shrink-0">
                <FolderTree className="w-3.5 h-3.5 text-blue-600" /> /root/classes
              </button>
              {breadcrumbs.slice(2).map((part, idx) => {
                const path = '/root/classes/' + breadcrumbs.slice(2, idx + 3).join('/')
                return (
                  <React.Fragment key={path}>
                    <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
                    <button onClick={() => setActiveFolder(path)} className="hover:text-blue-600 transition truncate max-w-[100px]">
                      {part}
                    </button>
                  </React.Fragment>
                )
              })}
            </div>
          </div>

          {/* Prominent Action Bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={resetForm}
              className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" /> New Package
            </button>
            <button
              onClick={handleCreateFolder}
              className="py-2 px-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shrink-0"
            >
              <Folder className="w-3.5 h-3.5 text-gray-600" /> + Folder
            </button>
          </div>
        </div>

        {/* Directory Explorer Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          
          {/* Subfolders Grid */}
          {subFolders.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Folders ({subFolders.length})</h4>
              <div className="grid grid-cols-2 gap-2">
                {subFolders.map(folder => (
                  <div key={folder.id} onClick={() => setActiveFolder(`${normFolder}/${folder.name}`)} className="p-2.5 border border-gray-200 rounded-lg bg-gray-50 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-between cursor-pointer transition group">
                    <div className="flex items-center gap-2 truncate">
                      <Folder className="w-4 h-4 text-blue-600 fill-blue-100 shrink-0" />
                      <span className="font-bold text-xs text-gray-800 truncate">{folder.name}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteFolderItem(folder) }} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-700 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Classes List */}
          <div>
            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Packages in this folder ({classFiles.length + unassignedClasses.length})</h4>
            
            <div className="space-y-2">
              {classFiles.map(file => {
                const cls = classMap[file.reference_id]
                if (!cls) return null
                const recCount = cls.recordings?.length || (cls.video_id ? 1 : 0)
                const resCount = cls.resources?.length || 0
                const isEditing = editingId === cls.id

                return (
                  <div
                    key={cls.id}
                    onClick={() => startEdit(cls)}
                    className={`p-3.5 border rounded-xl cursor-pointer transition flex items-center justify-between gap-3 ${
                      isEditing ? 'bg-blue-50 border-blue-500 shadow-sm ring-1 ring-blue-500' : 'bg-white hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold ${
                        isEditing ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <Video className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h5 className="font-bold text-xs text-gray-900 truncate">{cls.title}</h5>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 font-medium">
                          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-700 font-semibold">{cls.subject}</span>
                          <span>{recCount} {recCount === 1 ? 'Vid' : 'Vids'}</span>
                          {resCount > 0 && <span>• {resCount} {resCount === 1 ? 'Res' : 'Res'}</span>}
                          <span className="text-purple-600 font-bold bg-purple-100 px-1.5 py-0.5 rounded">Level {cls.required_level ?? 1}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); startEdit(cls); }} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded transition" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}

              {/* Unassigned backward compatible classes */}
              {unassignedClasses.map(cls => {
                const recCount = cls.recordings?.length || (cls.video_id ? 1 : 0)
                const resCount = cls.resources?.length || 0
                const isEditing = editingId === cls.id
                return (
                  <div
                    key={cls.id}
                    onClick={() => startEdit(cls)}
                    className={`p-3.5 border rounded-xl cursor-pointer transition flex items-center justify-between gap-3 ${
                      isEditing ? 'bg-amber-100 border-amber-600 ring-1 ring-amber-600' : 'bg-amber-50/50 border-amber-200 hover:border-amber-400'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                        <Video className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h5 className="font-bold text-xs text-gray-900 truncate">{cls.title} <span className="text-[9px] bg-amber-200 text-amber-800 px-1 py-0.5 rounded ml-1 font-extrabold">Root</span></h5>
                        <div className="text-[11px] text-gray-500 font-medium mt-0.5">{recCount} Vids • {resCount} Res</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); startEdit(cls); }} className="p-1.5 text-gray-600 hover:bg-amber-200 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )
              })}

              {classFiles.length === 0 && unassignedClasses.length === 0 && subFolders.length === 0 && (
                <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                  <Video className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs font-bold text-gray-500">No packages in this folder.</p>
                  <p className="text-[11px] mt-1 text-gray-400">Click "+ New Package" above to create one here.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Right Column: Wide Form Builder */}
      <div className="flex-1 bg-white flex flex-col h-full overflow-y-auto p-8">
        
        {/* Form Header / Editing Banner */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 shrink-0">
          <div>
            {editingId ? (
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-md text-xs font-black uppercase tracking-wider">Editing Package</span>
                <h3 className="font-black text-xl text-gray-900 truncate max-w-md">{title || 'Untitled'}</h3>
              </div>
            ) : (
              <div>
                <h3 className="font-black text-xl text-gray-900">Create New Class Package</h3>
                <p className="text-xs text-gray-500 mt-0.5">Adding to folder: <span className="font-mono font-bold text-blue-600">{normFolder}</span></p>
              </div>
            )}
          </div>

          {editingId && (
            <button
              onClick={resetForm}
              className="py-2 px-4 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Create New Package Instead
            </button>
          )}
        </div>

        {errorMsg && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-600">{errorMsg}</div>}
        {successMsg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-xs font-bold text-green-600 flex items-center gap-1.5"><Check className="w-4 h-4"/> {successMsg}</div>}

        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
          
          {/* General Metadata */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Package Title *</label>
              <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. SAT Math: Algebra Masterclass & Practice" className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Subject</label>
                <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold bg-white">
                  <option value="Evidence based reading & writing">Evidence based reading & writing</option>
                  <option value="Math">Math</option>
                  <option value="General">General</option>
                  <option value="Others">Others</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Required Access Level</label>
                <select value={requiredLevel} onChange={e => {
                  const val = parseInt(e.target.value, 10)
                  setRequiredLevel(val)
                }} className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold bg-white">
                  <option value={1}>🟢 Level 1 — Basic Free Tier</option>
                  <option value={2}>🔵 Level 2 — Practice Plan</option>
                  <option value={4}>🟡 Level 4 — Flash Plan</option>
                  <option value={6}>🟣 Level 6 — Master Plan</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Target Folder</label>
              <input disabled value={normFolder} className="w-full p-2.5 text-xs border rounded-lg bg-gray-100 font-mono text-gray-600 font-bold cursor-not-allowed" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Description (Optional)</label>
              <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief summary of what this package covers..." className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium resize-none" />
            </div>
          </div>

          {/* Recordings Playlist Section */}
          <div className="p-5 bg-blue-50/40 border border-blue-200 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-sm text-blue-950 flex items-center gap-2">
                <Video className="w-4 h-4 text-blue-600" /> Video Playlist Parts ({recordings.length})
              </h4>
              <button
                type="button"
                onClick={handleOpenVideoModal}
                className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" /> Add Video Part
              </button>
            </div>

            {recordings.length === 0 ? (
              <div className="text-center py-8 bg-white/70 border border-blue-100 rounded-lg text-gray-500">
                <Video className="w-6 h-6 mx-auto mb-1 text-blue-400" />
                <p className="text-xs font-bold text-gray-600">No video lectures added yet.</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Click "+ Add Video Part" above to fetch info from YouTube.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recordings.map((rec, idx) => (
                  <div key={rec.id} className="p-4 bg-white border border-blue-200 rounded-lg space-y-3 relative shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded uppercase tracking-wider">Part {idx + 1}</span>
                      <button type="button" onClick={() => handleRemoveRecordingRow(idx)} className="text-gray-400 hover:text-red-600 transition p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Video Title</label>
                        <input required placeholder="e.g. Part 1: Lecture Introduction" value={rec.title} onChange={e => handleRecordingChange(idx, 'title', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded font-medium outline-none focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Duration</label>
                        <input placeholder="e.g. 45m" value={rec.duration} onChange={e => handleRecordingChange(idx, 'duration', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded font-medium outline-none text-center focus:border-blue-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">YouTube Link or Video ID</label>
                      <input required placeholder="https://www.youtube.com/watch?v=... or 11-char ID" value={rec.video_id} onChange={e => handleRecordingChange(idx, 'video_id', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded font-mono text-gray-800 outline-none focus:border-blue-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resources Links Section (Drive Slides / PDFs) */}
          <div className="p-5 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-sm text-emerald-950 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" /> Attached Resources ({resources.length})
              </h4>
              <button
                type="button"
                onClick={handleOpenResModal}
                className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" /> Add Resource Link
              </button>
            </div>

            {resources.length === 0 ? (
              <p className="text-xs text-gray-500 italic text-center py-4 bg-white/60 rounded-lg border border-emerald-100">No slides or worksheets attached yet. Click above to add Google Drive links or PDFs.</p>
            ) : (
              <div className="space-y-3">
                {resources.map((res, idx) => (
                  <div key={res.id} className="p-4 bg-white border border-emerald-200 rounded-lg space-y-3 relative shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <select value={res.type} onChange={e => handleResourceChange(idx, 'type', e.target.value)} className="text-xs font-bold bg-emerald-100 text-emerald-900 p-1.5 rounded border border-emerald-300 outline-none">
                        <option value="slide">📊 Slide Deck (Google Drive / Canva)</option>
                        <option value="pdf">📄 PDF Worksheet</option>
                        <option value="formula">📐 PDF Formula Sheet</option>
                        <option value="link">🔗 External Link</option>
                      </select>
                      <button type="button" onClick={() => handleRemoveResourceRow(idx)} className="text-gray-400 hover:text-red-600 transition p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Resource Title</label>
                        <input required placeholder="e.g. Chapter 1 Practice Sheet" value={res.title} onChange={e => handleResourceChange(idx, 'title', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded font-medium outline-none focus:border-emerald-500" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Resource URL</label>
                        <input required type="url" placeholder="https://drive.google.com/..." value={res.url} onChange={e => handleResourceChange(idx, 'url', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded font-mono text-gray-800 outline-none focus:border-emerald-500" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4">
            <button type="submit" disabled={loading} className="w-full py-3.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-black text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? 'Saving Package...' : editingId ? 'Update Class Package' : 'Save New Class Package'}
            </button>
          </div>

        </form>
      </div>

      {/* Popup Modal: Add Video Part */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-black text-lg text-gray-900 flex items-center gap-2">
                <Video className="w-5 h-5 text-blue-600" /> Add YouTube Lecture
              </h3>
              <button onClick={() => setShowVideoModal(false)} className="text-gray-400 hover:text-gray-700 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {videoFetchError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-600">{videoFetchError}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">YouTube URL or Video ID *</label>
                <div className="flex gap-2">
                  <input
                    value={videoModalUrl}
                    onChange={e => setVideoModalUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="flex-1 p-2.5 text-xs border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleFetchVideoInfo()}
                    disabled={fetchingVideo || !videoModalUrl.trim()}
                    className="px-3 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-1 shrink-0"
                  >
                    {fetchingVideo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Fetch Info'}
                  </button>
                </div>
              </div>

              {videoModalThumb && (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 aspect-video bg-black/5">
                  <img src={videoModalThumb} alt="Video thumbnail" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-3">
                    <span className="text-white text-xs font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> YouTube Metadata Fetched
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Video Title</label>
                <input
                  value={videoModalTitle}
                  onChange={e => setVideoModalTitle(e.target.value)}
                  placeholder="Click Fetch Info or enter manually..."
                  className="w-full p-2.5 text-xs border border-gray-300 rounded-lg font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Duration</label>
                <input
                  value={videoModalDuration}
                  onChange={e => setVideoModalDuration(e.target.value)}
                  placeholder="e.g. 45m"
                  className="w-full p-2.5 text-xs border border-gray-300 rounded-lg font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {videoModalDesc && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Fetched Description</label>
                  <textarea
                    rows={2}
                    value={videoModalDesc}
                    onChange={e => setVideoModalDesc(e.target.value)}
                    className="w-full p-2.5 text-xs border border-gray-300 rounded-lg font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-gray-50"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowVideoModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAddVideo}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition shadow-sm"
              >
                Confirm Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup Modal: Add Resource Link */}
      {showResModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-black text-lg text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" /> Attach Class Resource
              </h3>
              <button onClick={() => setShowResModal(false)} className="text-gray-400 hover:text-gray-700 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Resource Type</label>
                <select
                  value={resModalType}
                  onChange={e => {
                    const val = e.target.value
                    setResModalType(val)
                    if (!resModalTitle || resModalTitle.startsWith('Class ') || resModalTitle === 'Attached Class Resource') {
                      setResModalTitle(val === 'slide' ? 'Class Slide Deck & Notes' : val === 'formula' ? 'Class PDF Formula Sheet' : val === 'pdf' ? 'Class PDF Worksheet' : 'Attached Class Resource')
                    }
                  }}
                  className="w-full p-2.5 text-xs font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                >
                  <option value="slide">📊 Slide Deck (Google Drive / Canva)</option>
                  <option value="pdf">📄 PDF Worksheet</option>
                  <option value="formula">📐 PDF Formula Sheet</option>
                  <option value="link">🔗 External Link</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Resource Title *</label>
                <input
                  value={resModalTitle}
                  onChange={e => setResModalTitle(e.target.value)}
                  placeholder="e.g. Lecture 1 Notes & Practice"
                  className="w-full p-2.5 text-xs border border-gray-300 rounded-lg font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">URL * (Google Drive or External)</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={resModalUrl}
                    onChange={e => setResModalUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full p-2.5 text-xs border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleFetchResourceInfo}
                    disabled={fetchingRes || !resModalUrl.trim()}
                    className="px-3.5 py-2.5 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition shrink-0 shadow-sm flex items-center gap-1.5"
                  >
                    {fetchingRes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Fetch Info'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowResModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAddResource}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-sm"
              >
                Attach Resource
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
