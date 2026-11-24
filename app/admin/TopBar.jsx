'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { usePathname } from 'next/navigation'

export default function TopBar() {
  const pathname = usePathname()
  
  if (pathname === '/admin') return null;

  return (
    <div className="p-4 border-b border-gray-200 bg-white flex items-center shadow-sm z-10 shrink-0">
      <Link href="/admin" className="flex items-center gap-2 text-gray-600 hover:text-blue-600 font-bold transition-colors">
        <ChevronLeft className="w-5 h-5" /> Back to Dashboard
      </Link>
    </div>
  )
}
