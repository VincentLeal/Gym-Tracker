'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getExercisesForProfile, SESSION_COLORS, SESSION_LABELS, SessionType, ProfileType } from '@/lib/program'
import ExerciseDemo from '@/components/ExerciseDemo'

interface SetData { kg: string; reps: string; done: boolean }
type ExData = Record<number, SetData[]>

function today() { return new Date().toISOString().split('T')[0] }

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
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const sessionIdRef = useRef<string | null>(null)
  const userIdRef = useRef<string | null>(null)

  const colors = SESSION_COLORS[type]
  const pType: ProfileType = profile?.profile_type || 'male'
  const prog = getExercisesForProfile(type, pType)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      userIdRef.current = session.user.id
      const { data: prof } = await supabase.from('profiles').select('name, profile_type').eq('id', session.user.id).single()
      setProfile(prof)
      const pt: ProfileType = prof?.profile_type || 'male'
      const exercises = getExercisesForProfile(type, pt)
      const init: ExData = {}
      exercises.forEach((ex, i) => {
        init[i] = Array.from({ length: ex.defaultSets[pt] || 3 }, () => ({ kg: '', reps: '', done: false }))
      })
      setExData(init)
    })
  }, [type, router])

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionIdRef.current) return sessionIdRef.current
    const supabase = createClient()
    const userId = userIdRef.current
    if (!userId) return null
    const { data, error } = await supabase.from('sessions').insert({
      user_id: userId, session_type: type, session_date: date,
      total_volume: 0, sets_done: 0,
      sets_total: prog.reduce((s, ex) => s + (ex.defaultSets[pType] || 3), 0),
      note: '',
    }).select().single()
    if (error || !data) return null
    sessionIdRef.current = data.id
    return data.id
  }, [type, date, prog, pType])

  const autoSaveSet = useCallback(async (exIdx: number, setIdx: number, setData: SetData) => {
    if (!setData.done) return
    setAutoSaveStatus('saving')
    const sessionId = await ensureSession()
    if (!sessionId) { setAutoSaveStatus('idle'); return }
    const supabase = createClient()
    const ex = prog[exIdx]

    await supabase.from('session_sets').upsert({
      session_id: sessionId, exercise_index: exIdx, exercise_name: ex.name,
      set_index: setIdx, weight_kg: setData.kg ? parseFloat(setData.kg) : null,
      reps: setData.reps ? parseInt(setData.reps) : null, completed: true,
    }, { onConflict: 'session_id,exercise_index,set_index' })

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

  const allSets = Object.values(exData).flat()
  const setsDone = allSets.filter(d => d.done).length
  const setsTotal = allSets.length
  const totalVol = allSets.reduce((s, d) => d.done && d.kg && d.reps ? s + parseFloat(d.kg) * parseInt(d.reps) : s, 0)

  const saveNote = async () => {
    const sessionId = sessionIdRef.current
    if (!sessionId) return
    setSaving(true)
    await createClient().from('sessions').update({ note }).eq('id', sessionId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!profile) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-28">
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
          <h1 className={`text-sm font-semibold ${colors.text} truncate`}>{SESSION_LABELS[type]}</h1>
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
                <ExerciseDemo name={ex.name} gifFile={ex.demo.gifFile} youtube={ex.demo.youtube} tip={ex.demo.tip} />
              </div>

              {/* Sets */}
              <div className="px-4 pb-1">
                <div className="grid grid-cols-12 text-xs text-gray-400 font-medium mb-1.5 px-1">
                  <div className="col-span-2">#</div>
                  <div className="col-span-4">Poids (kg)</div>
                  <div className="col-span-4">Reps</div>
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
                          inputMode="decimal"
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

      {/* Note */}
      <div className="mt-6">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Notes de séance (ressenti, douleurs, PR…)"
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none"
        />
        {note && (
          <button
            onClick={saveNote}
            disabled={saving}
            className="mt-2 w-full py-2.5 text-sm font-medium bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Sauvegarde…' : saved ? '✓ Note sauvegardée' : 'Sauvegarder la note'}
          </button>
        )}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-3">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex-1 py-3 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
        >
          Tableau de bord
        </button>
        {setsDone > 0 && (
          <button
            onClick={() => router.push('/dashboard')}
            disabled={autoSaveStatus === 'saving'}
            className="flex-1 py-3 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {autoSaveStatus === 'saving' ? 'Sauvegarde…' : 'Terminer'}
          </button>
        )}
      </div>
    </div>
  )
}
