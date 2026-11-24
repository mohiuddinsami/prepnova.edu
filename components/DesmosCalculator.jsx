'use client'
import React, { useState, useEffect, useRef } from 'react'
import { X, MoveHorizontal } from 'lucide-react'

export default function DesmosCalculator({ isOpen, onClose }) {
  const [widthPx, setWidthPx] = useState(460) // default left one-third embedded width in px
  const [sizePreset, setSizePreset] = useState('standard') // 'standard', 'wide', 'half'
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartRef = useRef({ x: 0, startWidth: 0 })

  useEffect(() => {
    // Initialize width to exactly one-third of the window width on client load if standard
    if (typeof window !== 'undefined' && sizePreset === 'standard' && widthPx === 460) {
      setWidthPx(Math.round(window.innerWidth * 0.35))
    }
  }, [])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return
      const deltaX = e.clientX - resizeStartRef.current.x
      const newWidth = Math.max(280, Math.min(window.innerWidth - 300, resizeStartRef.current.startWidth + deltaX))
      setWidthPx(newWidth)
      setSizePreset('custom')
    }

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false)
        document.body.classList.remove('select-none')
      }
    }

    if (isResizing) {
      document.body.classList.add('select-none')
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.classList.remove('select-none')
    }
  }, [isResizing])

  const startResize = (e) => {
    setIsResizing(true)
    resizeStartRef.current = {
      x: e.clientX,
      startWidth: widthPx
    }
  }

  const applyPreset = (preset) => {
    setSizePreset(preset)
    if (preset === 'standard') setWidthPx(Math.round(window.innerWidth * 0.35))
    else if (preset === 'wide') setWidthPx(Math.round(window.innerWidth * 0.48))
    else if (preset === 'half') setWidthPx(Math.round(window.innerWidth * 0.5))
  }

  return (
    <div className={isOpen ? "flex h-full shrink-0 z-20 relative" : "hidden pointer-events-none"}>
      <div
        className="h-full bg-[#1a1a1a] border-r border-gray-800 flex flex-col shrink-0 shadow-lg transition-[width] duration-100 ease-out"
        style={{ width: isOpen ? `${widthPx}px` : '0px' }}
      >
        {/* Integrated Embedded Top Bar */}
        <div className="px-4 py-2 bg-[#202020] border-b border-gray-800 flex items-center justify-between text-white select-none shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/30 shadow-inner shrink-0">
              fx
            </div>
            <span className="font-bold text-sm text-gray-200 tracking-wide truncate">
              Desmos Calculator
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/10 text-xs hidden sm:flex">
              <button
                type="button"
                onClick={() => applyPreset('standard')}
                className={`px-2 py-1 rounded font-medium transition ${
                  sizePreset === 'standard' ? 'bg-blue-600 text-white shadow' : 'text-gray-300 hover:text-white'
                }`}
              >
                1/3 View
              </button>
              <button
                type="button"
                onClick={() => applyPreset('wide')}
                className={`px-2 py-1 rounded font-medium transition ${
                  sizePreset === 'wide' ? 'bg-blue-600 text-white shadow' : 'text-gray-300 hover:text-white'
                }`}
              >
                Wide
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-red-600 text-gray-400 hover:text-white transition"
              title="Close Calculator"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Calculator Iframe Container */}
        <div className="flex-1 relative w-full h-full bg-white overflow-hidden min-h-0 min-w-0">
          {/* Transparent overlay while dragging resize handle to prevent iframe from capturing mouse */}
          {isResizing && <div className="absolute inset-0 z-50 bg-transparent cursor-col-resize" />}
          <iframe
            src="https://www.desmos.com/testing/collegeboard/graphing"
            className="w-full h-full border-0"
            allow="clipboard-read; clipboard-write; fullscreen"
            title="Official College Board Graphing Calculator"
          />
        </div>
      </div>

      {/* Vertical Drag Bar on Right Edge for Resizing Width */}
      <div
        onMouseDown={startResize}
        className="w-3.5 h-full bg-[#e5e7eb] hover:bg-blue-500/30 active:bg-blue-500/50 cursor-col-resize border-r border-gray-300 flex flex-col items-center justify-center transition-colors shrink-0 select-none group"
        title="Drag left or right to resize calculator width"
      >
        <div className="h-16 w-1 bg-gray-400 group-hover:bg-blue-600 rounded-full flex items-center justify-center transition-colors">
          <MoveHorizontal className="w-3 h-3 text-gray-600 opacity-60 -ml-1" />
        </div>
      </div>
    </div>
  )
}
