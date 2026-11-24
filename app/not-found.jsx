import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#050805] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="fixed top-1/4 left-1/3 w-96 h-96 bg-[#D0F288]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/3 w-96 h-96 bg-blue-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Tilted Grid Pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
        <div 
          className="absolute inset-0" 
          style={{ 
            backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)', 
            backgroundSize: '50px 50px', 
            transform: 'rotate(-12deg) scale(1.2)' 
          }} 
        />
      </div>

      <div className="max-w-md w-full bg-[#121812]/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 sm:p-10 text-center relative z-10 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center">
        <div className="w-20 h-20 rounded-2xl bg-[#D0F288]/10 border border-[#D0F288]/30 flex items-center justify-center mb-6 shadow-inner text-[#D0F288]">
          <AlertTriangle className="w-10 h-10 animate-pulse" />
        </div>

        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#D0F288] to-white tracking-tighter mb-2">
          404
        </h1>
        
        <h2 className="text-xl font-bold text-white mb-3">
          Page Unavailable
        </h2>

        <p className="text-sm text-gray-400 mb-8 leading-relaxed">
          The page or resource you are looking for doesn&apos;t exist, was moved, or you mistyped the URL.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Link 
            href="/dashboard" 
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#D0F288] hover:bg-[#bce668] text-[#050805] font-extrabold text-sm transition shadow-lg hover:scale-[1.02] active:scale-[0.98]"
          >
            <Home className="w-4 h-4" /> Go to Dashboard
          </Link>
          
          <Link 
            href="/" 
            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm transition"
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
        </div>
      </div>
    </div>
  )
}
