import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { BookOpen, GraduationCap, Video, Sparkles } from 'lucide-react'
import { getEffectiveUserLevel } from '@/utils/getUserLevel'

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('user_level, admin_level, premium_expires_at, full_name').eq('id', user.id).single()

  const { userLevel } = await getEffectiveUserLevel(profile)

  return (
    <div className="text-white">
      <h1 className="text-4xl font-black mb-2 tracking-tight">Welcome back, {profile?.full_name?.split(' ')[0] || 'Student'}!</h1>
      <p className="text-white/60 mb-8 text-lg font-light">Ready to continue your SAT prep journey?</p>
      
      {userLevel === 0 && (
        <div className="mb-8 p-6 bg-[#D0F288]/10 backdrop-blur-md border border-[#D0F288]/30 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between shadow-lg gap-4">
          <div>
            <h3 className="text-xl font-bold text-[#D0F288] mb-1">Unlock Unlimited Practice Content</h3>
            <p className="text-gray-300 text-sm md:text-base">Create a free account or log in to track your scores and unlock thousands of SAT questions and simulated tests.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link href="/signup" className="inline-block whitespace-nowrap px-6 py-3 bg-[#D0F288] text-[#050805] font-black rounded-xl shadow-[0_0_15px_rgba(208,242,136,0.2)] hover:brightness-110 transition-all">Sign Up Free</Link>
            <Link href="/login" className="inline-block whitespace-nowrap px-6 py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl border border-white/10 transition-all">Log In</Link>
          </div>
        </div>
      )}

      {userLevel > 0 && userLevel < 6 && (
        <div className="mb-8 p-6 bg-yellow-500/10 backdrop-blur-md border border-yellow-500/20 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between shadow-lg gap-4">
          <div>
            <h3 className="text-xl font-bold text-yellow-400 mb-1">Upgrade Your Plan</h3>
            <p className="text-yellow-200/80 text-sm md:text-base">Unlock all full-length adaptive practice tests and higher level masterclasses to boost your SAT score.</p>
          </div>
          <Link href="/upgrade" className="inline-block whitespace-nowrap px-8 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#050805] font-bold rounded-xl shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:shadow-[0_0_25px_rgba(234,179,8,0.5)] transition-all transform hover:scale-[1.02] active:scale-95">Upgrade Now</Link>
        </div>
      )}

      <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Start Learning</h2>
      
      {/* Row 1: Featured Classes */}
      <div className="mb-6">
        <Link href="/dashboard/classes" className="group bg-[#0a0f0a]/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/10 p-8 hover:border-[#D0F288]/50 hover:bg-white/5 transition-all flex flex-col md:flex-row items-center gap-6 text-center md:text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#D0F288]/5 rounded-full blur-3xl pointer-events-none group-hover:bg-[#D0F288]/10 transition-all" />
          <div className="w-20 h-20 shrink-0 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#D0F288]/10 group-hover:border-[#D0F288]/30 transition-all text-white/50 group-hover:text-[#D0F288] shadow-inner">
            <Video className="w-10 h-10 drop-shadow-md" />
          </div>
          <div className="flex-1 relative z-10">
            <span className="inline-block px-3 py-1 rounded-full bg-[#D0F288]/10 border border-[#D0F288]/30 text-[#D0F288] text-[10px] font-black uppercase tracking-wider mb-2">Featured Core</span>
            <h2 className="text-2xl font-bold text-white mb-1 tracking-tight group-hover:text-[#D0F288] transition-colors">Classes & Lectures</h2>
            <p className="text-white/60 font-light text-sm max-w-2xl">Watch structured masterclasses, comprehensive lecture recordings, and download guided resource packs tailored specifically for your SAT success.</p>
          </div>
          <div className="shrink-0 relative z-10 font-bold text-sm text-[#D0F288] bg-[#D0F288]/10 border border-[#D0F288]/20 px-6 py-3 rounded-xl group-hover:bg-[#D0F288] group-hover:text-[#050805] transition-all shadow-md">
            Enter Classroom →
          </div>
        </Link>
      </div>

      {/* Row 2: Modules & Practice Tests */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <Link href="/dashboard/modules" className="group bg-[#0a0f0a]/60 backdrop-blur-xl rounded-3xl shadow-xl border border-white/10 p-8 hover:border-[#D0F288]/50 hover:bg-white/5 transition-all flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:bg-[#D0F288]/10 group-hover:border-[#D0F288]/30 transition-all text-white/50 group-hover:text-[#D0F288] shadow-inner">
            <BookOpen className="w-8 h-8 drop-shadow-md" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight group-hover:text-[#D0F288] transition-colors">Standalone Modules</h2>
          <p className="text-white/50 font-light text-sm">Practice specific subjects and topics with targeted timed 30-minute modules.</p>
        </Link>
        
        <Link href="/dashboard/practice-tests" className="group bg-[#0a0f0a]/60 backdrop-blur-xl rounded-3xl shadow-xl border border-white/10 p-8 hover:border-[#D0F288]/50 hover:bg-white/5 transition-all flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:bg-[#D0F288]/10 group-hover:border-[#D0F288]/30 transition-all text-white/50 group-hover:text-[#D0F288] shadow-inner">
            <GraduationCap className="w-8 h-8 drop-shadow-md" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight group-hover:text-[#D0F288] transition-colors">Full Practice Tests</h2>
          <p className="text-white/50 font-light text-sm">Take full-length, adaptive Digital SAT simulations to test your endurance.</p>
        </Link>
      </div>
    </div>
  )
}
