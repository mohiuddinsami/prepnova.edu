'use client'

import React, { useState, useEffect } from 'react'
import { Clock, CheckCircle2, Loader2, RefreshCw, Sliders } from 'lucide-react'
import { getUniversalUpdateScheduleAction, updateUniversalUpdateScheduleAction } from '@/app/actions/telemetryActions'

const PRESET_TIMES = [
  { label: '6:00 AM Bangladeshi Time (Midnight UTC)', hourUtc: 0, minuteUtc: 0 },
  { label: '9:00 AM Bangladeshi Time (3:00 AM UTC)', hourUtc: 3, minuteUtc: 0 },
  { label: '12:00 PM Bangladeshi Time (6:00 AM UTC)', hourUtc: 6, minuteUtc: 0 },
  { label: '6:00 PM Bangladeshi Time (12:00 PM UTC)', hourUtc: 12, minuteUtc: 0 },
  { label: 'Midnight Bangladeshi Time (6:00 PM UTC)', hourUtc: 18, minuteUtc: 0 }
]

export default function UniversalScheduleControl() {
  const [schedule, setSchedule] = useState(null)
  const [selectedPreset, setSelectedPreset] = useState('0') // string representation of hourUtc or 'custom'
  const [customBstHour, setCustomBstHour] = useState(6)
  const [customMinute, setCustomMinute] = useState(0)
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState(null)

  useEffect(() => {
    getUniversalUpdateScheduleAction().then(res => {
      if (res?.schedule) {
        setSchedule(res.schedule)
        const isPreset = PRESET_TIMES.some(pt => pt.hourUtc === res.schedule.hourUtc && pt.minuteUtc === res.schedule.minuteUtc)
        if (isPreset) {
          setSelectedPreset(res.schedule.hourUtc.toString())
        } else {
          setSelectedPreset('custom')
          setCustomBstHour(res.schedule.bstHour || 6)
          setCustomMinute(res.schedule.minuteUtc || 0)
        }
      }
    })
  }, [])

  // Live calculation for custom time preview
  const previewHourUtc = (customBstHour + 24 - 6) % 24
  const formatTime = (h, m) => {
    const period = h >= 12 ? 'PM' : 'AM'
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${displayH}:${m.toString().padStart(2, '0')} ${period}`
  }

  const handleUpdate = async () => {
    setLoading(true)
    setStatusMsg(null)
    
    let hourUtc = 0
    let minuteUtc = 0
    if (selectedPreset === 'custom') {
      hourUtc = previewHourUtc
      minuteUtc = parseInt(customMinute, 10) || 0
    } else {
      hourUtc = parseInt(selectedPreset, 10) || 0
      minuteUtc = 0
    }

    const res = await updateUniversalUpdateScheduleAction({ hourUtc, minuteUtc })
    setLoading(false)
    if (res?.success && res.schedule) {
      setSchedule(res.schedule)
      setStatusMsg({ type: 'success', text: `Universal Update Time successfully locked to: ${res.schedule.label} [pg_cron: ${res.schedule.cronExpr}]` })
    } else {
      setStatusMsg({ type: 'error', text: res?.error || 'Failed to update schedule' })
    }
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 via-[#18202f] to-gray-900 border border-blue-500/30 rounded-2xl p-6 mb-8 shadow-xl text-white">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 mb-5 border-b border-gray-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 border border-blue-400/30 rounded-xl text-blue-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              Universal Update Schedule Control
              <span className="text-[10px] font-mono uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                Active: pg_cron
              </span>
            </h3>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              Configures when the sliding windows (_7d, _14d, _30d) automatically prune historical deltas across User DB & Content DB.
            </p>
          </div>
        </div>

        {schedule && (
          <div className="bg-black/40 border border-gray-700 px-4 py-2 rounded-xl text-right">
            <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Current Active Schedule</div>
            <div className="text-sm font-mono font-bold text-emerald-400">{schedule.label}</div>
            <div className="text-[11px] font-mono text-gray-500">Cron Expression: `{schedule.cronExpr}`</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        <div className="md:col-span-8">
          <label className="block text-xs font-mono font-bold text-gray-300 uppercase mb-2">
            Select Universal Update Schedule Time:
          </label>
          <select
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-blue-500 shadow-inner cursor-pointer"
          >
            {PRESET_TIMES.map((pt) => (
              <option key={pt.hourUtc} value={pt.hourUtc}>
                {pt.label} (Cron: `0 {pt.hourUtc} * * *`)
              </option>
            ))}
            <option value="custom">⚙️ Custom Time (Specify exact Bangladeshi Hour & Minute)...</option>
          </select>
        </div>

        <div className="md:col-span-4 flex flex-col justify-end">
          <button
            onClick={handleUpdate}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-bold font-mono text-xs tracking-wider uppercase bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Set Universal Schedule
          </button>
        </div>
      </div>

      {/* Custom Time Selector Panel */}
      {selectedPreset === 'custom' && (
        <div className="mt-4 p-5 bg-black/50 border border-blue-500/40 rounded-xl space-y-4 animate-fadeIn">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-blue-400 uppercase">
            <Sliders className="w-4 h-4" /> Custom Time Configuration (Bangladeshi Standard Time / UTC+6)
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-gray-400 mb-1">Bangladeshi Hour (0 - 23):</label>
              <select
                value={customBstHour}
                onChange={(e) => setCustomBstHour(parseInt(e.target.value, 10))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:border-blue-500 outline-none"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i.toString().padStart(2, '0')}:00 BST ({formatTime(i, 0)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-gray-400 mb-1">Minute (0 - 59):</label>
              <select
                value={customMinute}
                onChange={(e) => setCustomMinute(parseInt(e.target.value, 10))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:border-blue-500 outline-none"
              >
                {Array.from({ length: 60 }, (_, i) => (
                  <option key={i} value={i}>
                    :{i.toString().padStart(2, '0')} min
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
            <div>
              <span className="text-gray-400">Live Preview:</span>{' '}
              <span className="text-amber-300 font-bold">{formatTime(customBstHour, customMinute)} BST</span>
              <span className="text-gray-500 mx-2">➔</span>
              <span className="text-cyan-300 font-bold">{formatTime(previewHourUtc, customMinute)} UTC</span>
            </div>
            <div className="text-emerald-400 font-bold bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-500/30">
              pg_cron: `{customMinute} {previewHourUtc} * * *`
            </div>
          </div>
        </div>
      )}

      {statusMsg && (
        <div className={`mt-4 p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
          statusMsg.type === 'success' ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300' : 'bg-red-950/50 border-red-500/40 text-red-300'
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg.text}</span>
        </div>
      )}
    </div>
  )
}
