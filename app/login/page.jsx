import { login, resendEmail } from './actions'
import LoginButton from './LoginButton'
import Link from 'next/link'

export default async function LoginPage({ searchParams }) {
  const resolvedSearchParams = await searchParams
  const error = resolvedSearchParams?.error
  const message = resolvedSearchParams?.message
  const email = resolvedSearchParams?.email

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-[#050805] overflow-hidden">
      
      {/* Tilted Grid & Radial Lighting Background */}
      <div className="fixed inset-0 z-0 flex items-center justify-center">
        {/* Radial Gradients */}
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-[#D0F288] opacity-[0.07] rounded-full blur-[120px] mix-blend-screen pointer-events-none translate-x-[-30%] translate-y-[-30%]"></div>
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[#D0F288] opacity-[0.05] rounded-full blur-[100px] mix-blend-screen pointer-events-none translate-x-[20%] translate-y-[20%]"></div>
        
        {/* The Grid */}
        <div 
          className="absolute inset-[-50%] z-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            transform: 'rotate(-12deg) scale(1.2)'
          }}
        />
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md bg-[#0a0f0a]/60 backdrop-blur-xl border border-white/10 p-8 sm:p-10 rounded-2xl shadow-2xl">
        
        <div className="text-center mb-8 flex flex-col items-center">
          <img 
            src="/logo.png" 
            alt="Prepnova Logo" 
            className="h-10 mb-6 object-contain drop-shadow-[0_0_10px_rgba(208,242,136,0.1)]" 
          />
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Welcome Back</h1>
          <p className="text-white/60 text-sm">Sign in to continue your prep journey.</p>
        </div>

        {message && (
          <div className="mb-6 p-4 bg-[#D0F288]/15 border border-[#D0F288]/40 text-[#D0F288] rounded-xl text-sm text-center backdrop-blur-sm shadow-lg font-medium leading-relaxed">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl text-sm text-center backdrop-blur-sm flex flex-col items-center gap-3">
            <span className="font-medium">{error}</span>
            {error.toLowerCase().includes('not confirmed') || error.toLowerCase().includes('not verified') ? (
              <form action={resendEmail} className="w-full mt-1">
                <input type="hidden" name="email" value={email || ''} />
                <button type="submit" className="w-full py-2.5 px-4 bg-[#D0F288] hover:bg-[#bce668] text-[#050805] font-bold rounded-xl shadow transition-all active:scale-[0.98] text-xs">
                  📩 Resend Verification Email
                </button>
              </form>
            ) : null}
          </div>
        )}

        <form action={login} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-white/80" htmlFor="email">Email Address</label>
            <input 
              id="email" 
              name="email" 
              type="email" 
              required 
              defaultValue={email || ''}
              placeholder="you@example.com"
              className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#D0F288]/50 focus:border-[#D0F288] transition-all" 
            />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-white/80" htmlFor="password">Password</label>
            </div>
            <input 
              id="password" 
              name="password" 
              type="password" 
              required 
              placeholder="••••••••"
              className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#D0F288]/50 focus:border-[#D0F288] transition-all" 
            />
            
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-200/80 text-xs rounded-xl text-center leading-relaxed">
              <strong className="block text-red-400 font-semibold mb-1">Forgot your password?</strong> 
              Please contact the system administrator. Only admins can manually reset passwords.
            </div>
          </div>
          
          <LoginButton />
        </form>
        
        <p className="mt-8 text-center text-sm text-white/50">
          Don't have an account?{' '}
          <Link href="/signup" className="text-[#D0F288] font-medium hover:underline hover:text-[#bce668] transition-colors">
            Sign up here
          </Link>
        </p>
      </div>
    </div>
  )
}
