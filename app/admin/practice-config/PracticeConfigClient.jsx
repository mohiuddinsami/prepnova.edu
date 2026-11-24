'use client'

import React, { useState } from 'react'
import { Settings, Save, Check, Loader2 } from 'lucide-react'
import { updatePracticeConfigAction } from '@/app/actions/practiceActions'

export default function PracticeConfigClient({ allSources, initialConfig }) {
  const [allowedSources, setAllowedSources] = useState(new Set(initialConfig.allowed_sources || []))
  const [limits, setLimits] = useState({
    level_1_limit: initialConfig.level_1_limit ?? 10,
    level_2_limit: initialConfig.level_2_limit ?? 100,
    level_3_limit: initialConfig.level_3_limit ?? -1,
    level_4_limit: initialConfig.level_4_limit ?? -1,
    level_5_limit: initialConfig.level_5_limit ?? -1,
    level_6_limit: initialConfig.level_6_limit ?? -1,
  })
  const [isSaving, setIsSaving] = useState(false)

  const toggleSource = (src) => {
    setAllowedSources(prev => {
      const next = new Set(prev)
      if (next.has(src)) next.delete(src)
      else next.add(src)
      return next
    })
  }

  const selectAll = () => setAllowedSources(new Set(allSources))
  const selectNone = () => setAllowedSources(new Set())

  const handleSave = async () => {
    setIsSaving(true)
    const configData = {
      allowed_sources: Array.from(allowedSources),
      ...limits
    }
    const res = await updatePracticeConfigAction(configData)
    if (res.success) {
      alert('Practice configuration updated successfully!')
    } else {
      alert('Failed to update config: ' + res.error)
    }
    setIsSaving(false)
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f4f4f4] text-gray-900">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <h1 className="text-2xl font-black text-black flex items-center gap-2">
          <Settings className="w-6 h-6" /> Practice Engine Config
        </h1>
        <p className="text-gray-500 mt-1">Configure which question sources are exposed to students in the Practice Engine.</p>
      </div>

      <div className="p-8 max-w-4xl">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-lg">Allowed Question Sources</h2>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition">Select All</button>
              <span className="text-gray-300">|</span>
              <button onClick={selectNone} className="text-sm font-semibold text-gray-500 hover:text-gray-800 transition">Select None</button>
            </div>
          </div>
          
          <div className="p-6">
            {allSources.length === 0 ? (
              <div className="text-gray-500 italic">No question sources found in the database.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allSources.sort().map(src => {
                  const isAllowed = allowedSources.has(src)
                  return (
                    <button
                      key={src}
                      onClick={() => toggleSource(src)}
                      className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                        isAllowed ? 'border-green-500 bg-green-50 text-green-900' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className="font-bold font-mono text-sm">{src}</span>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isAllowed ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'
                      }`}>
                        {isAllowed && <Check className="w-4 h-4 stroke-[3]" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

        </div>

        {/* Daily View Limits Configuration */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-8">
          <div className="p-6 border-b border-gray-100">
            <h2 className="font-bold text-lg">Daily Practice View Limits</h2>
            <p className="text-gray-500 text-sm mt-1">
              Set the number of practice questions users can view per day based on their tier. Use -1 for unlimited.
            </p>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(level => (
              <div key={level} className="flex flex-col">
                <label className="text-sm font-bold text-gray-700 mb-2">Level {level} Limit</label>
                <input
                  type="number"
                  value={limits[`level_${level}_limit`]}
                  onChange={e => setLimits({ ...limits, [`level_${level}_limit`]: parseInt(e.target.value) || 0 })}
                  className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-gray-900"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center">
          <div>
            <h3 className="font-bold text-blue-900 mb-2">Note on Empty Configuration</h3>
            <p className="text-sm text-blue-800">
              If no sources are selected, the Practice Engine will not return any questions.
            </p>
          </div>
          <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap ml-4"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save All Settings
            </button>
        </div>
      </div>
    </div>
  )
}
