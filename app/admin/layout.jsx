import Link from 'next/link'
import { User, Database, LayoutGrid, CloudUpload, FlaskConical, FolderTree, Hash, Video, Crown, Sparkles, Activity, Bug, Settings } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import TopBar from './TopBar'

export default async function AdminLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from('profiles').select('admin_level').eq('id', user?.id).single();
  const adminLevel = profile?.admin_level || 0;

  const { data: permsData } = await supabase.from('admin_tool_permissions').select('*');
  const perms = {};
  if (permsData) {
    permsData.forEach(p => { perms[p.tool_id] = p.min_admin_level; });
  }

  const canAccess = (toolId, defaultLevel = 7) => {
    const minReq = perms[toolId] ?? defaultLevel;
    return adminLevel >= minReq;
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      {/* Fixed Left Sidebar */}
      <aside className="w-64 bg-[#162444] text-white flex flex-col shrink-0 shadow-xl z-20 relative h-screen overflow-hidden">
        <div className="p-5 border-b border-gray-800 shrink-0">
          <h1 className="text-xl font-black tracking-wider text-white">ADMIN PANEL</h1>
        </div>
        
        <nav className="flex-1 px-3 py-4 space-y-1.5 min-h-0 overflow-y-auto">
          {adminLevel >= 9 && (
            <Link href="/admin/owner-control" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-300 hover:from-amber-500/30 hover:to-yellow-500/20 font-black border border-amber-400/30 transition-all mb-2 shadow">
              <Crown className="w-5 h-5 text-amber-400" /> Control Room
            </Link>
          )}

          {canAccess('analytics', 8) && (
            <Link href="/admin/analytics" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-300 hover:from-cyan-500/30 hover:to-blue-600/30 font-black border border-cyan-400/40 transition-all mb-4 shadow-[0_0_15px_rgba(0,240,255,0.15)] font-mono text-xs tracking-wider">
              <Activity className="w-5 h-5 text-cyan-400 animate-pulse" /> Cyberpunk Analytics
            </Link>
          )}

          {canAccess('users', 7) && (
            <Link href="/admin/users" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors font-medium text-gray-200 hover:text-white">
              <User className="w-5 h-5" /> User Management
            </Link>
          )}
          {canAccess('bug-reports', 7) && (
            <Link href="/admin/bug-reports" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-pink-500/20 to-purple-600/20 text-pink-300 hover:from-pink-500/30 hover:to-purple-600/30 font-bold border border-pink-500/30 transition-all mb-2 shadow-[0_0_15px_rgba(255,0,128,0.15)]">
              <Bug className="w-5 h-5 text-pink-400 animate-pulse" /> Bug Reports & Triage
            </Link>
          )}
          {canAccess('scheduled-upgrades', 7) && (
            <Link href="/admin/scheduled-upgrades" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors font-medium text-purple-300 hover:text-white">
              <Sparkles className="w-5 h-5 text-purple-400" /> Auto-Trigger Upgrades
            </Link>
          )}
          {canAccess('classes', 7) && (
            <Link href="/admin/classes" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors font-medium text-gray-200 hover:text-white">
              <Video className="w-5 h-5" /> Class Packages
            </Link>
          )}
          {canAccess('question-bank', 8) && (
            <Link href="/admin/question-bank" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors font-medium text-gray-200 hover:text-white">
              <Database className="w-5 h-5" /> Question Bank
            </Link>
          )}
          {canAccess('practice-config', 7) && (
            <Link href="/admin/practice-config" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors font-medium text-gray-200 hover:text-white">
              <Settings className="w-5 h-5" /> Practice Config
            </Link>
          )}
          {canAccess('module-builder', 7) && (
            <Link href="/admin/module-builder" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors font-medium text-gray-200 hover:text-white">
              <LayoutGrid className="w-5 h-5" /> Module Builder
            </Link>
          )}
          {canAccess('test-builder', 7) && (
            <Link href="/admin/test-builder" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors font-medium text-gray-200 hover:text-white">
              <FlaskConical className="w-5 h-5" /> Test Builder
            </Link>
          )}
          {canAccess('bulk-uploader', 8) && (
            <Link href="/admin/bulk-uploader" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors font-medium text-gray-200 hover:text-white">
              <CloudUpload className="w-5 h-5" /> Bulk Uploader
            </Link>
          )}
          {canAccess('bulk-uploader', 8) && (
            <Link href="/admin/bulk-tester" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors font-medium text-gray-200 hover:text-white">
              <FlaskConical className="w-5 h-5" /> Bulk Tester (Local)
            </Link>
          )}

          {canAccess('directory-manager', 7) && (
            <Link href="/admin/directory-manager" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors font-medium text-gray-200 hover:text-white">
              <FolderTree className="w-5 h-5" /> Directory Manager
            </Link>
          )}
          {canAccess('hash-rehash', 9) && (
            <Link href="/admin/hash-rehash" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors font-medium text-gray-200 hover:text-white">
              <Hash className="w-5 h-5" /> Hash Rehasher
            </Link>
          )}
        </nav>
        
        {/* User Profile Block */}
        <div className="p-4 bg-gray-900 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold shadow-inner">
              {user?.email?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate text-white">{user?.email}</p>
              <p className="text-xs text-gray-400 font-medium">{adminLevel === 9 ? '👑 Owner (Level 9)' : adminLevel === 8 ? '🛡️ Administrator (Level 8)' : '⚡ Moderator (Level 7)'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-[#0A0E17] overflow-hidden relative">
        <TopBar />
        <div className="flex-1 overflow-y-auto flex flex-col bg-[#0A0E17]">
          {children}
        </div>
      </main>
    </div>
  )
}
