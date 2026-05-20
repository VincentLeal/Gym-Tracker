'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { SESSION_COLORS, SESSION_LABELS, SessionType } from '@/lib/program'

interface SetRecord {
  exercise_name: string
  set_index: number
  weight_kg: number | null
  reps: number | null
  completed: boolean
}

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

function isSessionCompleted(s: SessionRecord) {
  return s.sets_total > 0 && s.sets_done >= s.sets_total
}

export default function Dashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [history, setHistory] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [detailSession, setDetailSession] = useState<SessionRecord | null>(null)
  const [detailSets, setDetailSets] = useState<SetRecord[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

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

  const deleteSession = async (id: string) => {
    if (!confirm('Supprimer cette séance ?')) return
    await createClient().from('sessions').delete().eq('id', id)
    setHistory(prev => prev.filter(h => h.id !== id))
    if (detailSession?.id === id) setDetailSession(null)
  }

  const openDetail = async (h: SessionRecord) => {
    setDetailSession(h)
    setDetailLoading(true)
    const { data } = await createClient().from('session_sets').select('*').eq('session_id', h.id)
      .order('exercise_index').order('set_index')
    setDetailSets(data || [])
    setDetailLoading(false)
  }

  const groupedSets = detailSets.reduce((acc, s) => {
    if (!acc[s.exercise_name]) acc[s.exercise_name] = []
    acc[s.exercise_name].push(s)
    return acc
  }, {} as Record<string, SetRecord[]>)

  const totalVol = history.reduce((s, h) => s + (h.total_volume || 0), 0)
  const streak = (() => {
    if (!history.length) return 0
    let count = 0
    const now = new Date()
    for (const h of history) {
      const diff = Math.floor((now.getTime() - new Date(h.session_date).getTime()) / 86400000)
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
        {[{ label: 'Séances', val: history.length }, { label: 'Volume total', val: `${(totalVol/1000).toFixed(1)}t` }, { label: 'Semaines', val: streak }].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <div className="text-xl font-semibold text-teal-700">{s.val}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Démarrer une séance</p>
      <div className="space-y-2 mb-8">
        {(['push', 'pull', 'legs'] as SessionType[]).map(type => {
          const c = SESSION_COLORS[type]
          return (
            <button key={type} onClick={() => router.push(`/session/${type}`)}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border ${c.bg} ${c.border} ${c.text} transition-opacity hover:opacity-80`}>
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
              const completed = isSessionCompleted(h)
              return (
                <div
                  key={h.id}
                  className={`rounded-xl border p-4 ${completed ? 'bg-emerald-50/70 border-emerald-200' : 'bg-amber-50/40 border-amber-200'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700 capitalize">{date}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.bg} ${c.text}`}>{TYPE_LABELS[h.session_type]}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {completed ? (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                            Terminée
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            En cours
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openDetail(h)} title="Consulter"
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-teal-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button onClick={() => router.push(`/session/${h.session_type}?id=${h.id}`)} title="Modifier"
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-orange-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => deleteSession(h.id)} title="Supprimer"
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
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

      {/* Detail modal */}
      {detailSession && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setDetailSession(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <div>
                <p className="text-base font-semibold text-gray-900">
                  {new Date(detailSession.session_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {TYPE_LABELS[detailSession.session_type]} · {detailSession.total_volume?.toLocaleString('fr-FR')} kg · {detailSession.sets_done}/{detailSession.sets_total} séries
                </p>
                <div className="mt-1.5">
                  {isSessionCompleted(detailSession) ? (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 bg-emerald-100 text-emerald-700">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                      Terminée
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 bg-amber-100 text-amber-700">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      En cours
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => deleteSession(detailSession.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <button onClick={() => setDetailSession(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {detailLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : Object.keys(groupedSets).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Aucune série enregistrée.</p>
              ) : (
                Object.entries(groupedSets).map(([exName, sets]) => (
                  <div key={exName}>
                    <p className="text-sm font-medium text-gray-800 mb-2">{exName}</p>
                    <div className="bg-gray-50 rounded-xl overflow-hidden">
                      <div className="grid grid-cols-12 px-3 py-2 text-xs text-gray-400 font-medium border-b border-gray-100">
                        <div className="col-span-2">Série</div>
                        <div className="col-span-4">Poids</div>
                        <div className="col-span-4">Reps</div>
                        <div className="col-span-2 text-right">Vol.</div>
                      </div>
                      {sets.map((s, i) => {
                        const vol = s.weight_kg && s.reps ? Math.round(s.weight_kg * s.reps) : null
                        return (
                          <div key={i} className={`grid grid-cols-12 px-3 py-2 text-sm border-t border-gray-100 ${!s.completed ? 'opacity-40' : ''}`}>
                            <div className="col-span-2 text-gray-400">{s.set_index + 1}</div>
                            <div className="col-span-4 text-gray-700">{s.weight_kg ? `${s.weight_kg} kg` : '—'}</div>
                            <div className="col-span-4 text-gray-700">{s.reps ?? '—'}</div>
                            <div className="col-span-2 text-right text-gray-400 text-xs">{vol ?? '—'}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
              {detailSession.note && (
                <div className="bg-teal-50 rounded-xl p-3">
                  <p className="text-xs text-teal-700 italic">{detailSession.note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
