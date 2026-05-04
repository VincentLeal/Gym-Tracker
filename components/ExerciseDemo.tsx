'use client'
import { useState } from 'react'

interface Props {
  name: string
  gif: string
  youtube: string
  tip: string
}

export default function ExerciseDemo({ name, gif, youtube, tip }: Props) {
  const [open, setOpen] = useState(false)
  const [gifError, setGifError] = useState(false)

  // Extract YouTube video ID for embed
  const ytId = youtube.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1]

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center text-gray-400 hover:text-gray-600"
        aria-label="Voir la démonstration"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4"
          onClick={() => setOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Sheet */}
          <div
            className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar (mobile) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900 pr-4">{name}</h2>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* GIF or YouTube embed */}
            <div className="bg-gray-50 aspect-video w-full overflow-hidden">
              {!gifError ? (
                <img
                  src={gif}
                  alt={`Démonstration ${name}`}
                  className="w-full h-full object-cover"
                  onError={() => setGifError(true)}
                />
              ) : ytId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}?autoplay=0&rel=0&modestbranding=1`}
                  title={name}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  Démo non disponible
                </div>
              )}
            </div>

            {/* Tip */}
            <div className="px-5 py-4">
              <div className="flex gap-3 items-start bg-teal-50 rounded-xl p-3">
                <span className="text-lg flex-shrink-0">💡</span>
                <p className="text-sm text-teal-800 leading-relaxed">{tip}</p>
              </div>
            </div>

            {/* YouTube fallback link */}
            <div className="px-5 pb-5">
              <a
                href={youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                Voir sur YouTube
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
