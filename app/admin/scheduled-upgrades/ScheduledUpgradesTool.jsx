'use client'

import React, { useState, useEffect } from 'react'
import { Upload, Sparkles, Trash2, CheckCircle2, AlertTriangle, Calendar, Award, Users, RefreshCw, UserPlus, Edit2, Check, X } from 'lucide-react'
import { createScheduledUpgradesAction, getScheduledUpgradesAction, deleteScheduledUpgradeAction, updateScheduledUpgradeAction } from '@/app/actions/adminScheduledUpgradeActions'

const PLAN_OPTIONS = [
  { level: 6, name: 'Level 6 - Master Plan (Unlimited Content & Tests)' },
  { level: 5, name: 'Level 5 - Advanced Plan' },
  { level: 4, name: 'Level 4 - Pro Plan' },
  { level: 3, name: 'Level 3 - Standard Plan' },
  { level: 2, name: 'Level 2 - Essential Plan' },
  { level: 1, name: 'Level 1 - Free Plan' },
]

export default function ScheduledUpgradesTool() {
  const [activeMode, setActiveMode] = useState('bulk') // 'bulk' or 'single'

  // Bulk mode states
  const [records, setRecords] = useState([])
  const [bulkLevel, setBulkLevel] = useState(6)
  const [bulkExpires, setBulkExpires] = useState('2027-01-03')

  // Single mode states
  const [singleEmail, setSingleEmail] = useState('')
  const [singleName, setSingleName] = useState('')
  const [singleLevel, setSingleLevel] = useState(6)
  const [singleExpires, setSingleExpires] = useState('2027-01-03')

  // General states
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  // List & inline editing states
  const [scheduledList, setScheduledList] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', target_level: 6, expires_at: '' })

  const fetchScheduled = async () => {
    setListLoading(true)
    const res = await getScheduledUpgradesAction()
    if (res.data) setScheduledList(res.data)
    setListLoading(false)
  }

  useEffect(() => {
    fetchScheduled()
  }, [])

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setMessage(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result
      if (typeof text !== 'string') return

      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      if (lines.length === 0) {
        setError('CSV file appears empty.')
        return
      }

      const parsed = []
      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim().replace(/^["']|["']$/g, ''))
        if (i === 0 && parts[0].toLowerCase().includes('email')) continue
        if (parts[0] && parts[0].includes('@')) {
          parsed.push({
            email: parts[0],
            name: parts[1] || parts[0].split('@')[0]
          })
        }
      }

      if (parsed.length === 0) {
        setError('Could not extract any valid email addresses from CSV.')
      } else {
        setRecords(parsed)
      }
    }
    reader.readAsText(file)
  }

  const handleBulkSubmit = async (e) => {
    e.preventDefault()
    if (records.length === 0) {
      setError('Please upload a CSV file with student records first.')
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    const res = await createScheduledUpgradesAction(records, bulkLevel, bulkExpires)
    setLoading(false)

    if (res.error) {
      setError(res.error)
    } else {
      setMessage(`Successfully scheduled auto-trigger upgrades for ${res.count} user(s)!`)
      setRecords([])
      fetchScheduled()
    }
  }

  const handleSingleSubmit = async (e) => {
    e.preventDefault()
    if (!singleEmail || !singleEmail.includes('@')) {
      setError('Please enter a valid student email address.')
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    const res = await createScheduledUpgradesAction(
      [{ email: singleEmail, name: singleName || singleEmail.split('@')[0] }],
      singleLevel,
      singleExpires
    )
    setLoading(false)

    if (res.error) {
      setError(res.error)
    } else {
      setMessage(`Successfully scheduled auto-trigger upgrade for ${singleEmail}!`)
      setSingleEmail('')
      setSingleName('')
      fetchScheduled()
    }
  }

  const handleDelete = async (id) => {
    const res = await deleteScheduledUpgradeAction(id)
    if (!res.error) {
      setScheduledList(prev => prev.filter(item => item.id !== id))
    }
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setEditForm({
      name: item.name || '',
      target_level: item.target_level || 6,
      expires_at: item.expires_at ? item.expires_at.split('T')[0] : '2027-01-03'
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async (id) => {
    const res = await updateScheduledUpgradeAction(id, editForm)
    if (!res.error) {
      setScheduledList(prev => prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            name: editForm.name,
            target_level: parseInt(editForm.target_level, 10),
            expires_at: new Date(editForm.expires_at).toISOString()
          }
        }
        return item
      }))
      setEditingId(null)
    } else {
      alert(`Failed to save edits: ${res.error}`)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-12">
      <div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
          <Sparkles className="w-9 h-9 text-purple-600" /> Scheduled Auto-Trigger Upgrades
        </h1>
        <p className="text-gray-600 mt-2 text-lg">
          Schedule pending plan upgrades in bulk via CSV or individually. Students receive a celebratory claim popup the next time they log in.
        </p>
      </div>

      {/* Top Mode Selector Tabs */}
      <div className="flex gap-4 border-b border-gray-200 pb-2">
        <button
          onClick={() => { setActiveMode('bulk'); setError(null); setMessage(null); }}
          className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-black text-sm sm:text-base transition-all ${
            activeMode === 'bulk'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Upload className="w-5 h-5" /> Bulk CSV Schedule
        </button>
        <button
          onClick={() => { setActiveMode('single'); setError(null); setMessage(null); }}
          className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-black text-sm sm:text-base transition-all ${
            activeMode === 'single'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <UserPlus className="w-5 h-5" /> Single Student Schedule
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 whitespace-pre-line font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {message && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3 text-green-800 font-bold">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
          {message}
        </div>
      )}

      {/* MODE 1: BULK CSV UPLOAD */}
      {activeMode === 'bulk' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Upload className="w-6 h-6 text-purple-600" /> Bulk Schedule Triggers
            </h2>

            <form onSubmit={handleBulkSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  1. Upload Student CSV File (<code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">Email,Name</code>)
                </label>
                <label className="border-2 border-dashed border-gray-200 hover:border-purple-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-gray-50/50 hover:bg-purple-50/20 transition group">
                  <Upload className="w-8 h-8 text-gray-400 group-hover:text-purple-600 mb-2 transition" />
                  <span className="text-sm font-bold text-gray-700 group-hover:text-purple-600">Select CSV File</span>
                  <span className="text-xs text-gray-400 mt-1">Supports bulk rows with headers</span>
                  <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                </label>

                {records.length > 0 && (
                  <div className="mt-3 p-3 bg-purple-50 border border-purple-100 rounded-xl flex items-center justify-between text-sm text-purple-900 font-medium">
                    <span className="flex items-center gap-2"><Users className="w-4 h-4 text-purple-600" /> Loaded {records.length} students</span>
                    <button type="button" onClick={() => setRecords([])} className="text-xs text-purple-600 underline hover:text-purple-800">Clear</button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Award className="w-4 h-4 text-purple-600" /> 2. Select Target Plan / Tier
                </label>
                <select
                  value={bulkLevel}
                  onChange={(e) => setBulkLevel(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 font-medium text-gray-800 transition"
                >
                  {PLAN_OPTIONS.map(opt => (
                    <option key={opt.level} value={opt.level}>{opt.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-600" /> 3. Select Expiration Date
                </label>
                <input
                  type="date"
                  value={bulkExpires}
                  onChange={(e) => setBulkExpires(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 font-medium text-gray-800 transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading || records.length === 0}
                className="w-full py-4 rounded-2xl font-black text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-600/20 transition flex items-center justify-center gap-2 text-base"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} Schedule Auto-Trigger for {records.length} Students
              </button>
            </form>
          </div>

          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-4 max-h-[550px] flex flex-col">
            <h3 className="text-xl font-bold text-gray-900 flex items-center justify-between">
              <span>CSV Preview</span>
              <span className="text-xs font-bold px-2.5 py-1 bg-gray-100 rounded-full text-gray-600">{records.length} records</span>
            </h3>

            {records.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-16 border border-dashed border-gray-200 rounded-2xl">
                <Users className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">No CSV loaded yet.</p>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 border border-gray-100 rounded-2xl divide-y divide-gray-100">
                {records.map((r, idx) => (
                  <div key={idx} className="p-3.5 flex items-center justify-between text-sm">
                    <div className="font-bold text-gray-800 truncate">{r.email}</div>
                    <div className="text-gray-500 text-xs shrink-0 bg-gray-50 px-2 py-1 rounded">{r.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* MODE 2: SINGLE STUDENT FORM */
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 sm:p-10 max-w-3xl animate-fade-in">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
            <UserPlus className="w-6 h-6 text-purple-600" /> Schedule Single Student Auto-Trigger
          </h2>

          <form onSubmit={handleSingleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Student Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="student@example.com"
                  value={singleEmail}
                  onChange={(e) => setSingleEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 font-medium text-gray-800 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Student Name (Optional)</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={singleName}
                  onChange={(e) => setSingleName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 font-medium text-gray-800 transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Award className="w-4 h-4 text-purple-600" /> Target Plan / Tier
                </label>
                <select
                  value={singleLevel}
                  onChange={(e) => setSingleLevel(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 font-medium text-gray-800 transition"
                >
                  {PLAN_OPTIONS.map(opt => (
                    <option key={opt.level} value={opt.level}>{opt.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-600" /> Expiration Date
                </label>
                <input
                  type="date"
                  required
                  value={singleExpires}
                  onChange={(e) => setSingleExpires(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 font-medium text-gray-800 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-black text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 shadow-lg shadow-purple-600/20 transition flex items-center justify-center gap-2 text-base"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} Schedule Auto-Trigger Upgrade
            </button>
          </form>
        </div>
      )}

      {/* ACTIVE PENDING TRIGGERS GRID WITH EDITING */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Active Pending Scheduled Triggers</h2>
            <p className="text-gray-500 text-sm mt-1">Users listed below will receive the celebratory claim popup when they next log in.</p>
          </div>
          <button onClick={fetchScheduled} className="p-2.5 rounded-xl hover:bg-gray-100 text-gray-600 transition flex items-center gap-2 text-sm font-bold">
            <RefreshCw className={`w-4 h-4 ${listLoading ? 'animate-spin' : ''}`} /> Refresh Table
          </button>
        </div>

        {listLoading ? (
          <div className="text-center py-12 text-gray-400 font-medium">Loading active pending triggers...</div>
        ) : scheduledList.length === 0 ? (
          <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-2xl">
            No active pending triggers currently scheduled.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-400 font-bold tracking-wider">
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Target Plan Tier</th>
                  <th className="py-3 px-4">Expires At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {scheduledList.map(item => {
                  const isEditing = editingId === item.id
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/80 transition">
                      {/* Name */}
                      <td className="py-3.5 px-4 font-bold text-gray-800">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="px-2.5 py-1.5 rounded-lg border border-purple-300 bg-purple-50/30 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-purple-500 outline-none w-full max-w-[160px]"
                          />
                        ) : (
                          item.name
                        )}
                      </td>

                      {/* Email (Read-Only identifier) */}
                      <td className="py-3.5 px-4 text-gray-600 font-mono text-xs sm:text-sm">{item.email}</td>

                      {/* Target Level */}
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <select
                            value={editForm.target_level}
                            onChange={(e) => setEditForm({ ...editForm, target_level: e.target.value })}
                            className="px-2.5 py-1.5 rounded-lg border border-purple-300 bg-purple-50/30 text-xs font-bold text-purple-900 focus:ring-2 focus:ring-purple-500 outline-none"
                          >
                            {PLAN_OPTIONS.map(opt => (
                              <option key={opt.level} value={opt.level}>Level {opt.level}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-700 border border-purple-200">
                            Level {item.target_level}
                          </span>
                        )}
                      </td>

                      {/* Expiration Date */}
                      <td className="py-3.5 px-4 text-gray-500">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editForm.expires_at}
                            onChange={(e) => setEditForm({ ...editForm, expires_at: e.target.value })}
                            className="px-2.5 py-1.5 rounded-lg border border-purple-300 bg-purple-50/30 text-xs font-medium text-gray-800 focus:ring-2 focus:ring-purple-500 outline-none"
                          />
                        ) : (
                          new Date(item.expires_at).toLocaleDateString()
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => saveEdit(item.id)}
                              className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition"
                              title="Save Changes"
                            >
                              <Check className="w-5 h-5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                              title="Cancel Edit"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => startEdit(item)}
                              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                              title="Edit Trigger"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Cancel Trigger"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
