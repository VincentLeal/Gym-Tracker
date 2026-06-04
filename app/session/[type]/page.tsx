'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getExercisesForProfile, SESSION_COLORS, SESSION_LABELS, SessionType, ProfileType } from '@/lib/program'
import ExerciseDemo from '@/components/ExerciseDemo'

interface SetData { kg: string; reps: string; done: boolean }
type ExData = Record<number, SetData[]>
interface HistoryEntry { date: string; sets: { kg: number | null; reps: number | null }[] }

function today() { return new Date().toISOString().split('T')[0] }

function fmtTime(sec: number) {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60), s = sec % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

const PROGRESS_COLORS: Record<SessionType, string> = {
  push: 'bg-teal-500',
  pull: 'bg-blue-500',
  legs: 'bg-purple-500',
}

export default function SessionPage() {
  const router = useRouter()
  const params = useParams()
  const type = params.type as SessionType

  const [profile, setProfile] = useState<{ name: string; profile_type: ProfileType } | null>(null)
  const [date, setDate] = useState(today())
  const [exData, setExData] = useState<ExData>({})
  const [note, setNote] = useState('')
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [editMode, setEditMode] = useState(false)
  const [historyExIdx, setHistoryExIdx] = useState<number | null>(null)
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const sessionIdRef = useRef<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  const exDataRef = useRef<ExData>({})
  const ensureSessionPromiseRef = useRef<Promise<string | null> | null>(null)

  const colors = SESSION_COLORS[type]
  const pType: ProfileType = profile?.profile_type || 'male'
  const prog = getExercisesForProfile(type, pType)

  useEffect(() => { exDataRef.current = exData }, [exData])

  useEffect(() => {
    const searchId = new URLSearchParams(window.location.search).get('id')
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      userIdRef.current = session.user.id

      const { data: prof } = await supabase
        .from('profiles')
        .select('name, profile_type')
        .eq('id', session.user.id)
        .single()
      setProfile(prof)

      const pt: ProfileType = prof?.profile_type || 'male'
      const exercises = getExercisesForProfile(type, pt)

      const init: ExData = {}
      exercises.forEach((ex, i) => {
        const count = ex.kind === 'hiit' ? 1 : (ex.defaultSets[pt] || 3)
        init[i] = Array.from({ length: count }, () => ({ kg: '', reps: '', done: false }))
      })

      if (searchId) {
        sessionIdRef.current = searchId
        setEditMode(true)

        const [{ data: existingSession }, { data: existingSets }] = await Promise.all([
          supabase.from('sessions').select('session_date, note').eq('id', searchId).single(),
          supabase.from('session_sets').select('*').eq('session_id', searchId)
            .order('exercise_index').order('set_index'),
        ])

        if (existingSession) {
          setDate(existingSession.session_date)
          setNote(existingSession.note || '')
        }

        if (existingSets) {
          existingSets.forEach(s => {
            if (!init[s.exercise_index]) init[s.exercise_index] = []
            while (init[s.exercise_index].length <= s.set_index) {
              init[s.exercise_index].push({ kg: '', reps: '', done: false })
            }
            init[s.exercise_index][s.set_index] = {
              kg: s.weight_kg?.toString() || '',
              reps: s.reps?.toString() || '',
              done: s.completed ?? false,
            }
          })

          const setsDone = existingSets.filter(s => s.completed).length
          const totalVolume = existingSets.reduce((sum, s) => {
            if (s.completed && s.weight_kg && s.reps) return sum + s.weight_kg * s.reps
            return sum
          }, 0)
          await supabase.from('sessions').update({
            sets_done: setsDone,
            total_volume: Math.round(totalVolume),
          }).eq('id', searchId)
        }
      }

      setExData(init)
    })
  }, [type, router])

  // Auto-save note (debounced)
  useEffect(() => {
    const t = setTimeout(async () => {
      const sessionId = sessionIdRef.current
      if (!sessionId) return
      setAutoSaveStatus('saving')
      await createClient().from('sessions').update({ note }).eq('id', sessionId)
      setAutoSaveStatus('saved')
      setTimeout(() => setAutoSaveStatus('idle'), 1500)
    }, 1500)
    return () => clearTimeout(t)
  }, [note])

  // Auto-save date when it changes (only if session already exists)
  useEffect(() => {
    const sessionId = sessionIdRef.current
    if (!sessionId) return
    createClient().from('sessions').update({ session_date: date }).eq('id', sessionId)
  }, [date])

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionIdRef.current) return sessionIdRef.current
    if (ensureSessionPromiseRef.current) return ensureSessionPromiseRef.current
    const supabase = createClient()
    const userId = userIdRef.current
    if (!userId) { console.error('[ensureSession] userId is null — auth not ready'); return null }
    const promise: Promise<string | null> = (async () => {
      const { data, error } = await supabase.from('sessions').insert({
        user_id: userId, session_type: type, session_date: date,
        total_volume: 0, sets_done: 0,
        sets_total: prog.reduce((s, ex) => s + (ex.defaultSets[pType] || 3), 0),
        note: '',
      }).select().single()
      ensureSessionPromiseRef.current = null
      if (error || !data) { console.error('ensureSession error:', error); return null }
      sessionIdRef.current = data.id
      return data.id
    })()
    ensureSessionPromiseRef.current = promise
    return promise
  }, [type, date, prog, pType])

  const autoSaveSet = useCallback(async (exIdx: number, setIdx: number, setData: SetData) => {
    if (!setData.done) return
    setAutoSaveStatus('saving')
    const sessionId = await ensureSession()
    if (!sessionId) { setAutoSaveStatus('idle'); return }
    const supabase = createClient()
    const ex = prog[exIdx]

    await supabase.from('session_sets')
      .delete()
      .eq('session_id', sessionId)
      .eq('exercise_index', exIdx)
      .eq('set_index', setIdx)

    const { error: insertError } = await supabase.from('session_sets').insert({
      session_id: sessionId,
      exercise_index: exIdx,
      exercise_name: ex.name,
      set_index: setIdx,
      weight_kg: setData.kg ? parseFloat(setData.kg) : null,
      reps: setData.reps ? parseInt(setData.reps) : null,
      completed: true,
    })

    if (insertError) {
      console.error('insert set error:', insertError)
      setAutoSaveStatus('idle')
      return
    }

    const { data: allSets } = await supabase
      .from('session_sets')
      .select('weight_kg, reps, completed')
      .eq('session_id', sessionId)

    if (allSets) {
      const setsDone = allSets.filter(s => s.completed).length
      const totalVolume = allSets.reduce((sum, s) => {
        if (s.completed && s.weight_kg && s.reps) return sum + s.weight_kg * s.reps
        return sum
      }, 0)
      await supabase.from('sessions').update({
        sets_done: setsDone,
        total_volume: Math.round(totalVolume),
      }).eq('id', sessionId)
    }

    setAutoSaveStatus('saved')
    setTimeout(() => setAutoSaveStatus('idle'), 1500)
  }, [ensureSession, prog])

  const updateSet = useCallback((exIdx: number, setIdx: number, field: keyof SetData, val: string | boolean) => {
    let setToSave: SetData | null = null
    setExData(prev => {
      const next = { ...prev }
      const sets = [...(next[exIdx] || [])]
      sets[setIdx] = { ...sets[setIdx], [field]: val }
      next[exIdx] = sets
      if (field === 'done' && val === true) setToSave = sets[setIdx]
      return next
    })
    if (setToSave) autoSaveSet(exIdx, setIdx, setToSave)
  }, [autoSaveSet])

  const addSet = useCallback((exIdx: number) => {
    setExData(prev => {
      const next = { ...prev }
      const last = next[exIdx]?.[next[exIdx].length - 1]
      next[exIdx] = [...(next[exIdx] || []), { kg: last?.kg || '', reps: last?.reps || '', done: false }]
      return next
    })
  }, [])

  const copyToNextSet = useCallback((exIdx: number, setIdx: number) => {
    setExData(prev => {
      const next = { ...prev }
      const sets = [...(next[exIdx] || [])]
      const current = sets[setIdx]
      if (!current || !sets[setIdx + 1] || sets[setIdx + 1].done) return prev
      sets[setIdx + 1] = { ...sets[setIdx + 1], kg: current.kg, reps: current.reps }
      next[exIdx] = sets
      return next
    })
  }, [])

  const openHistory = async (exIdx: number) => {
    setHistoryExIdx(exIdx)
    setHistoryLoading(true)
    setHistoryData([])

    const exName = prog[exIdx].name
    const supabase = createClient()
    const userId = userIdRef.current
    if (!userId) { setHistoryLoading(false); return }

    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, session_date')
      .eq('user_id', userId)
      .eq('session_type', type)
      .order('session_date', { ascending: false })
      .limit(6)

    if (!sessions || sessions.length === 0) { setHistoryLoading(false); return }

    const pastSessions = sessions
      .filter(s => s.id !== sessionIdRef.current)
      .slice(0, 5)

    if (pastSessions.length === 0) { setHistoryLoading(false); return }

    const { data: sets } = await supabase
      .from('session_sets')
      .select('session_id, set_index, weight_kg, reps')
      .in('session_id', pastSessions.map(s => s.id))
      .eq('exercise_name', exName)
      .eq('completed', true)
      .order('set_index')

    const grouped = new Map<string, { kg: number | null; reps: number | null }[]>()
    for (const s of pastSessions) grouped.set(s.id, [])
    for (const s of sets || []) grouped.get(s.session_id)?.push({ kg: s.weight_kg, reps: s.reps })

    const result: HistoryEntry[] = pastSessions
      .filter(s => (grouped.get(s.id) || []).length > 0)
      .map(s => ({ date: s.session_date, sets: grouped.get(s.id) || [] }))

    setHistoryData(result)
    setHistoryLoading(false)
  }

  const allSets = Object.values(exData).flat()
  const setsDone = allSets.filter(d => d.done).length
  const setsTotal = allSets.length
  const totalVol = prog.reduce((total, ex, exIdx) => {
    if (ex.kind === 'hiit') return total
    return total + (exData[exIdx] || []).reduce((s: number, d: SetData) => d.done && d.kg && d.reps ? s + parseFloat(d.kg) * parseInt(d.reps) : s, 0)
  }, 0)

  if (!profile) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => router.push('/dashboard')}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className={`text-sm font-semibold ${colors.text} truncate`}>{SESSION_LABELS[type]}</h1>
            {editMode && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium flex-shrink-0">
                Édition
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">{profile.name}</p>
        </div>
        <div className="text-xs flex-shrink-0">
          {autoSaveStatus === 'saving' && <span className="text-orange-400">Sauvegarde…</span>}
          {autoSaveStatus === 'saved' && <span className="text-teal-500">✓ Sauvegardé</span>}
        </div>
      </div>

      {/* Date */}
      <div className="mb-5">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-300"
        />
      </div>

      {/* Progress bar */}
      <div className={`rounded-xl border ${colors.border} ${colors.bg} px-4 py-3 mb-6`}>
        <div className="flex justify-between items-center mb-2">
          <span className={`text-sm font-medium ${colors.text}`}>{setsDone} / {setsTotal} séries</span>
          <span className={`text-sm font-medium ${colors.text}`}>{Math.round(totalVol).toLocaleString('fr-FR')} kg</span>
        </div>
        <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${PROGRESS_COLORS[type]}`}
            style={{ width: setsTotal ? `${(setsDone / setsTotal) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Exercises */}
      <div className="space-y-5">
        {prog.map((ex, exIdx) => {
          const sets = exData[exIdx] || []
          const targetStr = ex.target[pType] || ''
          const noteStr = ex.notes?.[pType] || ''
          return (
            <div key={exIdx} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              {/* Exercise header */}
              <div className="flex items-start gap-2 px-4 pt-4 pb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{ex.name}</span>
                    {ex.kind !== 'together' && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ex.kind === 'hiit' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                        {ex.kind === 'hiit' ? 'HIIT' : 'Solo'}
                      </span>
                    )}
                  </div>
                  {targetStr && <p className="text-xs text-gray-400 mt-0.5">{targetStr}</p>}
                  {noteStr && <p className="text-xs text-gray-400 italic mt-0.5">{noteStr}</p>}
                </div>
                <button
                  onClick={() => openHistory(exIdx)}
                  title="Voir l'historique"
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-300 hover:text-teal-500 transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <ExerciseDemo name={ex.name} gifFile={ex.demo.gifFile} youtube={ex.demo.youtube} tip={ex.demo.tip} />
              </div>

              {/* Sets */}
              <div className="px-4 pb-1">
                <div className="grid grid-cols-12 text-xs text-gray-400 font-medium mb-1.5 px-1">
                  <div className="col-span-2">#</div>
                  <div className="col-span-4">{ex.kind === 'hiit' ? 'Résistance' : 'Poids (kg)'}</div>
                  <div className="col-span-4">{ex.kind === 'hiit' ? 'Durée (s)' : 'Reps'}</div>
                  <div className="col-span-2 text-right">✓</div>
                </div>
                <div className="space-y-1.5">
                  {sets.map((s, setIdx) => (
                    <div
                      key={setIdx}
                      className={`grid grid-cols-12 items-center gap-1 rounded-xl px-1 py-1.5 transition-colors ${s.done ? 'bg-teal-50' : 'bg-gray-50'}`}
                    >
                      <div className="col-span-2 text-xs text-gray-400 pl-1">{setIdx + 1}</div>
                      <div className="col-span-4">
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="—"
                          value={s.kg}
                          onChange={e => updateSet(exIdx, setIdx, 'kg', e.target.value)}
                          className="w-full text-sm bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-300 text-center"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="—"
                          value={s.reps}
                          onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                          className="w-full text-sm bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-300 text-center"
                        />
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        {s.done && setIdx + 1 < sets.length && !sets[setIdx + 1].done && (
                          <button
                            onClick={() => copyToNextSet(exIdx, setIdx)}
                            title="Copier vers la série suivante"
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => updateSet(exIdx, setIdx, 'done', !s.done)}
                          className={`w-7 h-7 flex items-center justify-center rounded-full border-2 transition-colors ${s.done ? 'bg-teal-500 border-teal-500 text-white' : 'border-gray-300 text-transparent hover:border-teal-400'}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add set */}
              <div className="px-4 pb-4 pt-2">
                <button
                  onClick={() => addSet(exIdx)}
                  className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
                >
                  + Ajouter une série
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Note — auto-saved */}
      <div className="mt-6">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Notes de séance (ressenti, douleurs, PR…)"
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none"
        />
      </div>

      {/* Exercise history modal */}
      {historyExIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setHistoryExIdx(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <div>
                <p className="text-base font-semibold text-gray-900">{prog[historyExIdx].name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Séances précédentes</p>
              </div>
              <button
                onClick={() => setHistoryExIdx(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : historyData.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Aucun historique disponible.</p>
              ) : (
                historyData.map((entry, i) => {
                  const dateStr = new Date(entry.date).toLocaleDateString('fr-FR', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                  })
                  return (
                    <div key={i}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{dateStr}</p>
                      <div className="bg-gray-50 rounded-xl overflow-hidden">
                        <div className="grid grid-cols-12 px-3 py-2 text-xs text-gray-400 font-medium border-b border-gray-100">
                          <div className="col-span-2">Série</div>
                          <div className="col-span-5">{prog[historyExIdx].kind === 'hiit' ? 'Résistance' : 'Poids'}</div>
                          <div className="col-span-5">{prog[historyExIdx].kind === 'hiit' ? 'Durée' : 'Reps'}</div>
                        </div>
                        {entry.sets.map((s, si) => (
                          <div key={si} className="grid grid-cols-12 px-3 py-2 text-sm border-t border-gray-100">
                            <div className="col-span-2 text-gray-400">{si + 1}</div>
                            <div className="col-span-5 text-gray-700">
                              {s.kg != null ? (prog[historyExIdx].kind === 'hiit' ? s.kg : `${s.kg} kg`) : '—'}
                            </div>
                            <div className="col-span-5 text-gray-700">
                              {s.reps != null ? (prog[historyExIdx].kind === 'hiit' ? fmtTime(s.reps) : s.reps) : '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
