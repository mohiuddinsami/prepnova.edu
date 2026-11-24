'use client'

import React, { useEffect, useState } from 'react'
import PracticeEngine from '@/app/dashboard/practice/PracticeEngine'

export default function PracticeSessionPage() {
  const [sessionData, setSessionData] = useState(null)

  useEffect(() => {
    const data = localStorage.getItem('prepnova_practice_session')
    if (data) {
      try {
        setSessionData(JSON.parse(data))
      } catch (e) {
        window.location.href = '/dashboard/practice'
      }
    } else {
      window.location.href = '/dashboard/practice'
    }
  }, [])

  if (!sessionData) return <div className="min-h-screen bg-white flex items-center justify-center text-black">Loading...</div>

  return (
    <main className="h-screen w-screen bg-white overflow-hidden fixed inset-0 z-[9999]">
      <PracticeEngine 
        sessionData={sessionData} 
        onExit={() => {
           localStorage.removeItem('prepnova_practice_session')
           window.location.href = '/dashboard/practice'
        }} 
      />
    </main>
  )
}
