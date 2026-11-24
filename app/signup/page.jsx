import SignupForm from './SignupForm'
import Link from 'next/link'

export default async function SignupPage({ searchParams }) {
  const resolvedSearchParams = await searchParams
  const error = resolvedSearchParams?.error
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-[#050805] overflow-hidden">
      
      {/* Tilted Grid & Radial Lighting Background */}
      <div className="fixed inset-0 z-0 flex items-center justify-center">
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-[#D0F288] opacity-[0.07] rounded-full blur-[120px] mix-blend-screen pointer-events-none translate-x-[-30%] translate-y-[-30%]"></div>
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[#D0F288] opacity-[0.05] rounded-full blur-[100px] mix-blend-screen pointer-events-none translate-x-[20%] translate-y-[20%]"></div>
        
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

      {/* Signup Card */}
      <div className="relative z-10 w-full max-w-lg bg-[#0a0f0a]/60 backdrop-blur-xl border border-white/10 p-8 sm:p-10 rounded-2xl shadow-2xl my-8">
        
        <div className="text-center mb-8 flex flex-col items-center">
          <img 
            src="/logo.png" 
            alt="Prepnova Logo" 
            className="h-10 mb-6 object-contain drop-shadow-[0_0_10px_rgba(208,242,136,0.1)]" 
          />
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Create Account</h1>
        </div>

        <SignupForm serverError={error} />
        
        <p className="mt-8 text-center text-sm text-white/50">
          Already have an account?{' '}
          <Link href="/login" className="text-[#D0F288] font-medium hover:underline hover:text-[#bce668] transition-colors">
            Log in here
          </Link>
        </p>
      </div>
    </div>
  )
}
