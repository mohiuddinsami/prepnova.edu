'use client'

import React, { useEffect, useState, use } from 'react'
import PracticeEngine from '@/app/dashboard/practice/PracticeEngine'

export default function PracticeSessionPage({ params }) {
  const { sessionId } = use(params)
  const [sessionData, setSessionData] = useState(null)

  useEffect(() => {
    const data = localStorage.getItem(`prepnova_practice_${sessionId}`)
    if (data) {
      try {
        setSessionData(JSON.parse(data))
      } catch (e) {
        window.location.href = '/dashboard/practice'
      }
    } else {
      window.location.href = '/dashboard/practice'
    }
  }, [sessionId])

  if (!sessionData) return <div className="min-h-screen bg-white flex items-center justify-center text-black">Loading...</div>

  return (
    <main className="h-screen w-screen bg-white overflow-hidden fixed inset-0 z-[9999]">
      <PracticeEngine 
        sessionData={sessionData} 
        onExit={() => {
           localStorage.removeItem(`prepnova_practice_${sessionId}`)
           window.location.href = '/dashboard/practice'
        }} 
      />
    </main>
  )
}
