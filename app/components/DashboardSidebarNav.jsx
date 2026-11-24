'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard Home' },
  { href: '/dashboard/classes', label: 'Classes' },
  { href: '/dashboard/modules', label: 'Modules' },
  { href: '/dashboard/practice-tests', label: 'Practice Tests' },
  { href: '/dashboard/practice', label: 'Practice Mode' },
  { href: '/dashboard/history', label: 'History & Review' },
]

export default function DashboardSidebarNav() {
  const pathname = usePathname() || ''

  return (
    <nav className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto pr-1 my-2">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === item.href || pathname.startsWith(item.href + '/')

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`p-2.5 rounded-xl transition-all text-sm shrink-0 flex items-center justify-between group ${
              isActive
                ? 'bg-[#D0F288]/15 border border-[#D0F288]/50 text-[#D0F288] font-bold shadow-[0_0_20px_rgba(208,242,136,0.18)]'
                : 'hover:bg-white/5 font-medium text-white/70 hover:text-white border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <span className={`w-1.5 h-4 rounded-full transition-all shrink-0 ${isActive ? 'bg-[#D0F288] shadow-[0_0_8px_#D0F288]' : 'bg-transparent group-hover:bg-white/20'}`} />
              <span className="truncate">{item.label}</span>
            </div>
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#D0F288] animate-pulse shrink-0" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
