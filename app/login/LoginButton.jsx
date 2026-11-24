'use client'

import { useFormStatus } from 'react-dom'

export default function LoginButton() {
  const { pending } = useFormStatus()

  return (
    <button 
      type="submit" 
      disabled={pending}
      className={`w-full py-3 mt-2 font-bold rounded-xl shadow-[0_0_20px_rgba(208,242,136,0.3)] transition-all ${pending ? 'bg-gray-600 text-gray-300 cursor-not-allowed opacity-70 shadow-none animate-pulse' : 'bg-[#D0F288] hover:bg-[#bce668] text-[#050805] hover:shadow-[0_0_30px_rgba(208,242,136,0.5)] active:scale-[0.98]'}`}
    >
      {pending ? '⏳ Verifying Credentials...' : 'Log In'}
    </button>
  )
}
