'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { SESSION_COLORS, SESSION_LABELS, SessionType } from '@/lib/program'

interface SessionRecord {
  id: string
  session_type: SessionType
  session_date: string
  total_volume: number
  sets_done: number
  sets_total: number
  note: string
}

interface Profile { name: string; email: string }

const TYPE_LABELS: Record<SessionType, string> = { push: 'Push', pull: 'Pull', legs: 'Legs' }

export default function Dashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [history, setHistory] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      const [{ data: prof }, { data: hist }] = await Promise.all([
        supabase.from('profiles').select('name, email').eq('id', session.user.id).single(),
        supabase.from('sessions').select('*').eq('user_id', session.user.id).order('session_date', { ascending: false }).limit(20),
      ])
      setProfile(prof)
      setHistory(hist || [])
      setLoading(false)
    })
  }, [router])

  const logout = async () => {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  const totalVol = history.reduce((s, h) => s + (h.total_volume || 0), 0)
  const streak = (() => {
    if (!history.length) return 0
    let count = 0
    const now = new Date()
    for (const h of history) {
      const d = new Date(h.session_date)
      const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
      if (diff <= (count + 1) * 7) count++
      else break
    }
    return count
  })()

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Salut {profile?.name || 'toi'} 👋</h1>
          <p className="text-sm text-gray-500">{history.length} séances au total</p>
        </div>
        <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">Déconnexion</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <div className="text-xl font-semibold text-teal-700">{history.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Séances</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <div className="text-xl font-semibold text-teal-700">{(totalVol / 1000).toFixed(1)}t</div>
          <div className="text-xs text-gray-500 mt-0.5">Volume total</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <div className="text-xl font-semibold text-teal-700">{streak}</div>
          <div className="text-xs text-gray-500 mt-0.5">Semaines</div>
        </div>
      </div>

      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Démarrer une séance</p>
      <div className="space-y-2 mb-8">
        {(['push', 'pull', 'legs'] as SessionType[]).map(type => {
          const c = SESSION_COLORS[type]
          return (
            <button
              key={type}
              onClick={() => router.push(`/session/${type}`)}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border ${c.bg} ${c.border} ${c.text} transition-opacity hover:opacity-80`}
            >
              <span className="font-medium text-sm">{SESSION_LABELS[type]}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )
        })}
      </div>

      {history.length > 0 && (
        <>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Historique</p>
          <div className="space-y-2">
            {history.map(h => {
              const c = SESSION_COLORS[h.session_type]
              const date = new Date(h.session_date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
              return (
                <div key={h.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 capitalize">{date}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.bg} ${c.text}`}>
                      {TYPE_LABELS[h.session_type]}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>Volume : <strong className="text-gray-700">{h.total_volume?.toLocaleString('fr-FR')} kg</strong></span>
                    <span>Séries : <strong className="text-gray-700">{h.sets_done}/{h.sets_total}</strong></span>
                  </div>
                  {h.note && <p className="text-xs text-gray-400 mt-1.5 italic truncate">{h.note}</p>}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
