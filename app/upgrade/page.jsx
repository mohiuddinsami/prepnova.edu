import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, X, Globe, Video, Youtube, MessageSquare } from 'lucide-react';
import PromoPopup from './PromoPopup';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async function UpgradePage() {
  let showPromoPopup = false;
  
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const authClient = await createServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (user) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('user_level, has_claimed_practice_promo, premium_expires_at')
        .eq('id', user.id)
        .single();
      
      if (profile && !profile.has_claimed_practice_promo) {
        let isLevel1 = profile.user_level === 1;
        if (profile.user_level >= 2 && profile.premium_expires_at) {
          if (new Date(profile.premium_expires_at) < new Date()) {
            isLevel1 = true;
          }
        }
        if (isLevel1) {
          showPromoPopup = true;
        }
      }
    }
  }

  return (
    <div className="relative min-h-screen bg-[#050805] text-white overflow-hidden pb-20 font-sans">
      {showPromoPopup && <PromoPopup />}
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

      <div className="relative z-10 pt-8">
        <div className="mb-8 px-4 md:px-8 max-w-[1400px] mx-auto">
          <Link href="/dashboard" className="inline-flex items-center gap-3 text-base md:text-lg text-[#D0F288] hover:text-[#bce668] hover:underline font-bold transition-colors bg-[#0a0f0a]/80 backdrop-blur-xl px-6 py-3 md:px-8 md:py-4 rounded-full border border-white/10 shadow-lg">
            <ArrowLeft className="w-5 h-5" /> Back to Dashboard
          </Link>
        </div>

        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-4 drop-shadow-lg">
            Choose your Mastery Plan
          </h1>
          <p className="text-lg md:text-xl text-white/60 font-medium">
            Unlock your full potential and achieve your target SAT score.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-[1400px] mx-auto px-4">
          
          {/* Free Tier */}
          <div className="bg-[#0a0f0a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 xl:p-8 flex flex-col hover:border-white/20 transition-all shadow-xl">
            <h2 className="text-xl md:text-2xl font-black text-center mb-6 uppercase tracking-widest text-white/90">Free Tier</h2>
            
            <div className="h-[220px] mb-8">
              <div className="bg-[#121812] rounded-2xl p-6 text-center border border-white/5 h-full flex flex-col items-center justify-center gap-2">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl md:text-5xl font-black tracking-tight">৳0</span>
                  <span className="text-white/50 font-medium text-sm md:text-base whitespace-nowrap">/ lifetime</span>
                </div>
                <div className="text-sm text-white/40 font-medium mt-2">Basic Platform Access</div>
              </div>
            </div>

            <ul className="space-y-4 mb-10 flex-1">
              <li className="flex items-start opacity-50"><X className="w-5 h-5 text-red-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight">No Live Classes</span></li>
              <li className="flex items-start opacity-50"><X className="w-5 h-5 text-red-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight">No Recorded Classes</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-green-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight">1 Adaptive Mock Test</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-green-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight">Public Modules Access</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-green-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight">Daily Question Limit: 25</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-green-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight">Daily Explanation Limit: 5</span></li>
              <li className="flex items-start opacity-50"><X className="w-5 h-5 text-red-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight">Personalized Practice Mode</span></li>
              <li className="flex items-start"><Globe className="w-5 h-5 text-green-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight">Basic Web Portal</span></li>
              <li className="flex items-start opacity-50"><X className="w-5 h-5 text-red-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight">24/7 Discord Support</span></li>
            </ul>


          </div>

          {/* Practice Core (Most Popular) */}
          <div className="relative bg-[#0a0f0a] border-2 border-emerald-500 rounded-3xl p-6 xl:p-8 flex flex-col shadow-[0_0_40px_rgba(16,185,129,0.15)] z-10 mt-4 xl:mt-0">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-[#050805] px-6 py-1.5 rounded-full text-xs font-black tracking-widest uppercase shadow-xl whitespace-nowrap">
              Most Popular
            </div>
            
            <h2 className="text-xl md:text-2xl font-black text-center mb-6 uppercase tracking-widest text-emerald-400">Practice</h2>
            
            <div className="h-[220px] mb-8">
              <div className="flex flex-col gap-3 h-full">
                <div className="bg-[#121812] border border-emerald-500/20 rounded-xl flex-1 relative overflow-hidden text-center flex flex-col justify-center p-2">
                   <div className="absolute top-0 right-0 bg-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[9px] font-bold rounded-bl-lg uppercase tracking-wider">Monthly</div>
                   <div className="flex items-baseline justify-center gap-1 mt-2">
                     <span className="text-4xl md:text-5xl font-black tracking-tight">৳249</span>
                     <span className="text-white/50 font-medium text-sm md:text-base whitespace-nowrap">/ month</span>
                   </div>
                </div>
                
                <div className="bg-[#121812] border border-emerald-500/20 rounded-xl flex-1 relative overflow-hidden text-center flex flex-col justify-center p-2">
                   <div className="absolute top-0 right-0 bg-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[9px] font-bold rounded-bl-lg uppercase tracking-wider">Quarterly</div>
                   <div className="flex items-baseline justify-center gap-1 mt-1">
                     <span className="text-4xl md:text-5xl font-black tracking-tight">৳599</span>
                     <span className="text-white/50 font-medium text-sm md:text-base whitespace-nowrap">/ 3 months</span>
                   </div>
                </div>
              </div>
            </div>

            <ul className="space-y-4 mb-10 flex-1">
              <li className="flex items-start opacity-50"><X className="w-5 h-5 text-red-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight">No Live Classes</span></li>
              <li className="flex items-start opacity-50"><X className="w-5 h-5 text-red-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight">No Recorded Classes</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-emerald-400 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">12 Adaptive Mock Tests</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-emerald-400 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">Weekly Practice Modules</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-emerald-400 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">Daily Question Limit: 150</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-emerald-400 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">Daily Explanation Limit: 100</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-emerald-400 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">Personalized Practice Mode</span></li>
              <li className="flex items-start"><Globe className="w-5 h-5 text-emerald-400 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">Personalized Web Portal</span></li>
              <li className="flex items-start opacity-50"><X className="w-5 h-5 text-red-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight">24/7 Discord Support</span></li>
            </ul>

            <a href="https://forms.gle/3SbJZtTDzf8S37oi8" target="_blank" rel="noopener noreferrer" className="block w-full py-4 text-center rounded-xl bg-emerald-500 text-[#050805] shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:-translate-y-1 transition-all font-black text-sm md:text-base">
              Choose Practice
            </a>
          </div>

          {/* Flash Course */}
          <div className="bg-[#0a0f0a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 xl:p-8 flex flex-col hover:border-white/20 transition-all shadow-xl">
            <h2 className="text-xl md:text-2xl font-black text-center mb-6 uppercase tracking-widest text-[#D0F288]">Flash</h2>
            
            <div className="h-[220px] mb-8">
              <div className="bg-[#121812] rounded-2xl p-6 text-center border border-white/5 h-full flex flex-col items-center justify-center gap-2">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl md:text-5xl font-black tracking-tight">৳2690</span>
                  <span className="text-white/50 font-medium text-sm md:text-base whitespace-nowrap">/ 3 Months</span>
                </div>
                <div className="text-sm text-[#D0F288] font-medium mt-2">Intensive Crash Course</div>
              </div>
            </div>

            <ul className="space-y-4 mb-10 flex-1">
              <li className="flex items-start opacity-50"><X className="w-5 h-5 text-red-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight">No Live Classes</span></li>
              <li className="flex items-start"><Youtube className="w-5 h-5 text-green-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">30 Recorded Classes</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-green-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">12 Adaptive Mock Tests</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-green-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">Weekly Practice Modules</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-green-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">Daily Question Limit: 150</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-green-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">Daily Explanation Limit: 100</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-green-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">Personalized Practice Mode</span></li>
              <li className="flex items-start"><Globe className="w-5 h-5 text-green-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">Personalized Web Portal</span></li>
              <li className="flex items-start"><MessageSquare className="w-5 h-5 text-green-500 mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">24/7 Discord Support</span></li>
            </ul>

            <button className="block w-full py-4 text-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition font-bold text-white text-sm md:text-base cursor-not-allowed opacity-80">
              Coming Soon
            </button>
          </div>

          {/* Master Program (Recommended) */}
          <div className="relative bg-[#0a0f0a] border-2 border-[#D0F288] rounded-3xl p-6 xl:p-8 flex flex-col shadow-[0_0_40px_rgba(208,242,136,0.15)] z-10 mt-4 xl:mt-0">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#D0F288] text-[#050805] px-6 py-1.5 rounded-full text-xs font-black tracking-widest uppercase shadow-xl whitespace-nowrap">
              Recommended
            </div>

            <h2 className="text-xl md:text-2xl font-black text-center mb-6 uppercase tracking-widest text-[#D0F288]">Master</h2>
            
            <div className="h-[220px] mb-8">
              <div className="bg-[#121812] rounded-2xl p-6 text-center border border-white/5 relative overflow-hidden h-full flex flex-col items-center justify-center gap-2">
                <div className="flex items-baseline justify-center gap-1 relative">
                  <span className="absolute -top-7 text-lg font-black text-red-500 line-through decoration-red-500 decoration-2">৳8990/-</span>
                  <span className="text-4xl md:text-5xl font-black tracking-tight text-white">৳5990</span>
                  <span className="text-white/50 font-medium text-sm md:text-base whitespace-nowrap">/ 3 Months</span>
                </div>
                <div className="text-xs text-[#D0F288] font-bold mt-2">Oct & Nov Batch</div>
              </div>
            </div>

            <ul className="space-y-4 mb-10 flex-1">
              <li className="flex items-start"><Video className="w-5 h-5 text-[#D0F288] mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">30 Live Classes</span></li>
              <li className="flex items-start"><Youtube className="w-5 h-5 text-[#D0F288] mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">30 Recorded Classes</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-[#D0F288] mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">12 Adaptive Mock Tests</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-[#D0F288] mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">Weekly Practice Modules</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-[#D0F288] mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">Daily Question Limit: Unlimited</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-[#D0F288] mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">Daily Explanation Limit: Unlimited</span></li>
              <li className="flex items-start"><Check className="w-5 h-5 text-[#D0F288] mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">Personalized Practice Mode</span></li>
              <li className="flex items-start"><Globe className="w-5 h-5 text-[#D0F288] mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">Personalized Web Portal</span></li>
              <li className="flex items-start"><MessageSquare className="w-5 h-5 text-[#D0F288] mr-3 shrink-0" /><span className="text-[13px] md:text-sm font-medium leading-tight text-white/90">24/7 Discord Support</span></li>
            </ul>

            <a href="https://docs.google.com/forms/d/e/1FAIpQLSfIY3JDxN2U_PkFSW2BWEAimSeGgfsQR1w_0lt1MyyDtj8L7Q/viewform" target="_blank" rel="noopener noreferrer" className="block w-full py-4 text-center rounded-xl bg-[#D0F288] text-[#050805] shadow-[0_0_20px_rgba(208,242,136,0.3)] hover:shadow-[0_0_30px_rgba(208,242,136,0.5)] hover:-translate-y-1 transition-all font-black text-sm md:text-base">
              Choose Master
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
