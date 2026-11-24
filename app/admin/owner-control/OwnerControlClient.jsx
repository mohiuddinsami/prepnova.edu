'use client'

import { useState } from 'react'
import { updateToolPermissionsAction, updateUserLevelsAction, updateSiteFeatureToggleAction } from '@/app/actions/adminUserActions'
import { ShieldAlert, Save, CheckCircle2, AlertCircle, Users, Settings, Search, UserCheck, Power } from 'lucide-react'
import UniversalScheduleControl from '../components/UniversalScheduleControl'

export default function OwnerControlClient({ initialPermissions = [], initialUsers = [], initialToggles = [] }) {
  const [permissions, setPermissions] = useState(initialPermissions)
  const [users, setUsers] = useState(initialUsers)
  const [toggles, setToggles] = useState(initialToggles)
  const [activeTab, setActiveTab] = useState('tools') // 'tools', 'roles', or 'toggles'
  const [userSearch, setUserSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })

  const handleLevelChange = (toolId, newLevel) => {
    setPermissions(prev => prev.map(p => p.tool_id === toolId ? { ...p, min_admin_level: parseInt(newLevel, 10) } : p))
  }

  const handleToggleFeature = async (featureId, currentStatus) => {
    const newStatus = !currentStatus
    setToggles(prev => prev.map(t => t.feature_id === featureId ? { ...t, is_enabled: newStatus } : t))
    setStatus({ type: '', message: 'Updating maintenance switch...' })
    const res = await updateSiteFeatureToggleAction(featureId, newStatus)
    if (res.error) {
      setStatus({ type: 'error', message: res.error })
      setToggles(prev => prev.map(t => t.feature_id === featureId ? { ...t, is_enabled: currentStatus } : t))
    } else {
      setStatus({ 
        type: 'success', 
        message: `🚧 Feature switch successfully updated! (${newStatus ? 'ENABLED for all students' : 'LOCKED DOWN under maintenance'})` 
      })
    }
  }

  const handleSavePermissions = async () => {
    setSaving(true)
    setStatus({ type: '', message: '' })
    const res = await updateToolPermissionsAction(permissions)
    setSaving(false)
    if (res.error) {
      setStatus({ type: 'error', message: res.error })
    } else {
      setStatus({ type: 'success', message: '👑 Owner control room permissions successfully saved & updated platform-wide!' })
    }
  }

  const handleUserRoleChange = async (user, newRole) => {
    setStatus({ type: '', message: 'Updating admin role...' })
    const roleNum = parseInt(newRole, 10)
    const res = await updateUserLevelsAction(user.id, roleNum, user.user_level ?? 1, user.premium_expires_at)
    if (res.error) {
      setStatus({ type: 'error', message: res.error })
    } else {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, admin_level: roleNum } : u))
      setStatus({ type: 'success', message: `👑 Successfully updated ${user.full_name || user.email}'s Admin Role to Level ${roleNum}!` })
    }
  }

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  )

  const adminTitles = {
    1: '1 - Registered User',
    7: '7 - Moderator',
    8: '8 - Administrator',
    9: '9 - Owner'
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-gray-50 text-gray-900">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#162444] to-[#1e325c] rounded-3xl p-8 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border border-white/10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-wider mb-3">
              <ShieldAlert className="w-4 h-4" /> Supreme Command Room
            </div>
            <h1 className="text-3xl font-black tracking-tight mb-2">Owner Control Panel</h1>
            <p className="text-gray-300 text-sm font-light max-w-xl">Configure administrative tool access thresholds, toggle website feature maintenance locks, and manage staff roles.</p>
          </div>
          {activeTab === 'tools' && (
            <button
              onClick={handleSavePermissions}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-[#162444] font-black rounded-xl shadow-lg transition transform active:scale-95 disabled:opacity-50 shrink-0"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Save Permissions'}
            </button>
          )}
        </div>

        <UniversalScheduleControl />

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 pb-2">
          <button
            onClick={() => { setActiveTab('tools'); setStatus({ type: '', message: '' }); }}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-sm transition-all ${activeTab === 'tools' ? 'bg-[#162444] text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
          >
            <Settings className="w-4 h-4" /> Tool Access Permissions
          </button>
          <button
            onClick={() => { setActiveTab('roles'); setStatus({ type: '', message: '' }); }}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-sm transition-all ${activeTab === 'roles' ? 'bg-[#162444] text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
          >
            <Users className="w-4 h-4" /> Staff Role Management
          </button>
          <button
            onClick={() => { setActiveTab('toggles'); setStatus({ type: '', message: '' }); }}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-sm transition-all ${activeTab === 'toggles' ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
          >
            <Power className="w-4 h-4" /> 🚧 Website Maintenance Switches
          </button>
        </div>

        {/* Status Alert */}
        {status.message && (
          <div className={`p-4 rounded-2xl border flex items-center gap-3 font-bold text-sm shadow-sm ${status.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
            {status.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
            {status.message}
          </div>
        )}

        {/* TAB 1: Tool Access Permissions */}
        {activeTab === 'tools' && (
          <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-800">CMS Tool Access Thresholds</h3>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Default Tier Configuration</span>
            </div>
            
            <div className="divide-y divide-gray-100">
              {permissions.length === 0 ? (
                <div className="p-12 text-center text-gray-400 font-medium">No tools registered in database. Run migration file first.</div>
              ) : (
                permissions.map(tool => (
                  <div key={tool.tool_id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                    <div>
                      <h4 className="text-base font-bold text-gray-900">{tool.tool_name}</h4>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">ID: {tool.tool_id}</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Required Level:</label>
                      <select
                        value={tool.min_admin_level}
                        onChange={(e) => handleLevelChange(tool.tool_id, e.target.value)}
                        className={`px-4 py-2.5 rounded-xl border text-sm font-black shadow-sm focus:ring-2 focus:ring-[#162444] transition cursor-pointer ${tool.min_admin_level === 9 ? 'bg-amber-50 border-amber-300 text-amber-900' : tool.min_admin_level === 8 ? 'bg-blue-50 border-blue-300 text-blue-900' : 'bg-gray-50 border-gray-200 text-gray-800'}`}
                      >
                        <option value={7}>Level 7 - Moderator</option>
                        <option value={8}>Level 8 - Administrator</option>
                        <option value={9}>Level 9 - Owner Only</option>
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Staff Role Management */}
        {activeTab === 'roles' && (
          <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-gray-800">Staff & Admin Role Escalation</h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">Exclusively assign or modify staff roles across the system.</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search staff by name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#162444] outline-none"
                />
              </div>
            </div>

            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <div className="p-12 text-center text-gray-400 font-medium">No matching staff or users found.</div>
              ) : (
                filteredUsers.map(u => {
                  const role = u.admin_level ?? 1
                  return (
                    <div key={u.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-inner ${role === 9 ? 'bg-amber-100 text-amber-700 border border-amber-300' : role === 8 ? 'bg-blue-100 text-blue-700 border border-blue-300' : role === 7 ? 'bg-purple-100 text-purple-700 border border-purple-300' : 'bg-gray-100 text-gray-600'}`}>
                          {role >= 7 ? <UserCheck className="w-5 h-5" /> : (u.email?.[0]?.toUpperCase() || 'U')}
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            {u.full_name || 'Unnamed User'}
                            {role === 9 && <span className="text-[10px] bg-amber-400/20 text-amber-800 font-black px-2 py-0.5 rounded-full uppercase border border-amber-300">Owner</span>}
                            {role === 8 && <span className="text-[10px] bg-blue-100 text-blue-800 font-black px-2 py-0.5 rounded-full uppercase border border-blue-200">Admin</span>}
                            {role === 7 && <span className="text-[10px] bg-purple-100 text-purple-800 font-black px-2 py-0.5 rounded-full uppercase border border-purple-200">Mod</span>}
                          </h4>
                          <p className="text-xs text-gray-500 font-medium">{u.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Admin Role:</label>
                        <select
                          value={role}
                          onChange={(e) => handleUserRoleChange(u, e.target.value)}
                          className={`px-4 py-2 rounded-xl border text-sm font-black shadow-sm focus:ring-2 focus:ring-[#162444] transition cursor-pointer ${role === 9 ? 'bg-amber-50 border-amber-300 text-amber-900' : role === 8 ? 'bg-blue-50 border-blue-300 text-blue-900' : role === 7 ? 'bg-purple-50 border-purple-300 text-purple-900' : 'bg-white border-gray-200 text-gray-700'}`}
                        >
                          <option value={1}>1 - Registered User</option>
                          <option value={7}>7 - Moderator</option>
                          <option value={8}>8 - Administrator</option>
                          <option value={9}>9 - Owner</option>
                        </select>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Website Maintenance Switches */}
        {activeTab === 'toggles' && (
          <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-amber-50/60 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  🚧 Student Portal Maintenance Lock Switches
                </h3>
                <p className="text-xs text-gray-600 font-medium mt-1">
                  Turning a section OFF locks regular users (Level 1-6) out with a maintenance screen while letting Admins (Level 7+) bypass freely.
                </p>
              </div>
              <span className="text-xs font-bold bg-amber-200/80 text-amber-900 px-3 py-1 rounded-full uppercase tracking-wider">
                Instant Effect
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {toggles.length === 0 ? (
                <div className="p-12 text-center text-gray-400 font-medium">No site feature toggles found. Run SQL migration file first.</div>
              ) : (
                toggles.map(toggle => (
                  <div key={toggle.feature_id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                    <div>
                      <div className="flex items-center gap-3">
                        <h4 className="text-base font-bold text-gray-900">{toggle.feature_name}</h4>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${toggle.is_enabled ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                          {toggle.is_enabled ? 'LIVE / ACTIVE' : 'LOCKED DOWN'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 max-w-xl">{toggle.maintenance_message}</p>
                    </div>

                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleToggleFeature(toggle.feature_id, toggle.is_enabled)}
                        className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#162444] focus:ring-offset-2 ${toggle.is_enabled ? 'bg-emerald-600' : 'bg-gray-300'}`}
                      >
                        <span className="sr-only">Use setting</span>
                        <span
                          className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${toggle.is_enabled ? 'translate-x-6' : 'translate-x-0'}`}
                        />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
