import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/login/actions'
import { getEffectiveUserLevel } from '@/utils/getUserLevel'
import AdminViewLevelSwitcher from '@/app/components/AdminViewLevelSwitcher'
import ScheduledUpgradePopup from '@/app/components/ScheduledUpgradePopup'
import FloatingBugReportButton from '@/app/components/FloatingBugReportButton'
import DashboardSidebarNav from '@/app/components/DashboardSidebarNav'
import { TelemetrySync } from '@/app/components/telemetry/TelemetrySync'

export const revalidate = 0 // Disable Next.js caching to ensure live status updates

export default async function DashboardLayout({ children }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const { userLevel, isOverride } = await getEffectiveUserLevel(profile)

  return (
    <div className="relative min-h-screen flex bg-[#050805] overflow-hidden text-white">
      <TelemetrySync userLevel={userLevel} userId={user.id} />
      {/* Tilted Grid & Radial Lighting Background */}
      <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none">
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-[#D0F288] opacity-[0.05] rounded-full blur-[120px] mix-blend-screen translate-x-[-30%] translate-y-[-30%]"></div>
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[#D0F288] opacity-[0.03] rounded-full blur-[100px] mix-blend-screen translate-x-[20%] translate-y-[20%]"></div>
        <div 
          className="absolute inset-[-50%] z-0" 
          style={{ 
            backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`, 
            backgroundSize: '50px 50px', 
            transform: 'rotate(-12deg) scale(1.2)' 
          }} 
        />
      </div>

      {/* Sidebar */}
      <aside className="fixed top-0 left-0 bottom-0 w-64 bg-[#121812]/80 backdrop-blur-2xl border-r border-white/10 p-4 sm:p-5 flex flex-col z-20 shadow-[4px_0_24px_rgba(0,0,0,0.5)] h-screen overflow-hidden">
        <div className="mb-4 flex flex-col items-center text-center gap-2 shrink-0">
          <img src="/logo.png" alt="Prepnova Logo" className="h-8 object-contain drop-shadow-[0_0_10px_rgba(208,242,136,0.2)]" />
          <h2 className="text-lg font-bold text-white tracking-tight">Student Portal</h2>
        </div>
        
        {/* Dynamic Active Sidebar Navigation */}
        <DashboardSidebarNav />

        <div className="mt-auto border-t border-white/10 pt-3 shrink-0 space-y-1.5">
          <div className="text-sm font-medium text-white truncate">{profile?.full_name}</div>
          <div className="text-xs text-[#D0F288] mb-2 font-semibold">
            {({ 7: 'Master Plan (Tester)', 6: 'Master Plan', 5: 'Flash Plan (Tester)', 4: 'Flash Plan', 3: 'Practice Plan (Tester)', 2: 'Practice Plan', 1: 'Free Plan', 0: 'Level 0 (Guest)' })[userLevel] || 'Free Plan'}
            {isOverride && <span className="block text-[10px] text-amber-400 font-bold">(Admin Preview)</span>}
          </div>
          {(profile?.admin_level >= 7) && (
            <Link href="/admin" className="block text-center text-xs font-bold text-white bg-white/10 py-1.5 rounded-lg hover:bg-white/20 transition">Admin Panel</Link>
          )}
          <Link href="/dashboard/profile" className="block text-center text-xs font-bold text-white bg-white/5 border border-white/10 py-1.5 rounded-lg hover:bg-white/15 hover:border-white/20 transition">Profile</Link>
          <form action={logout}>
            <button type="submit" className="w-full block text-center text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 py-1.5 rounded-lg hover:bg-red-500/20 transition">
              Log Out
            </button>
          </form>
        </div>
      </aside>
      
      {/* Celebratory Scheduled Upgrade Popup */}
      <ScheduledUpgradePopup />

      {/* Floating Bug Report Button across all Dashboard Pages */}
      <FloatingBugReportButton />

      {/* Admin View Switcher */}
      <AdminViewLevelSwitcher adminLevel={profile?.admin_level} currentOverride={isOverride ? userLevel : 'real'} />

      {/* Main Content */}
      <main className="relative z-10 flex-1 p-8 ml-64">
        {children}
      </main>
    </div>
  )
}
