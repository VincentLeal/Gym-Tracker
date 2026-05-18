'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getExercisesForProfile, SESSION_COLORS, SESSION_LABELS, SessionType, ProfileType } from '@/lib/program'
import ExerciseDemo from '@/components/ExerciseDemo'

interface SetData { kg: string; reps: string; done: boolean }
type ExData = Record<number, SetData[]>

function today() { return new Date().toISOString().split('T')[0] }

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
    setAutoSaveStatus('saved')
    setTimeout(() => setAutoSaveStatus('idle'), 1500)
  }, [ensureSession, prog])

  const updateSet = useCallback((exIdx: number, setIdx: number, field: keyof SetData, val: string | boolean) => {
    setExData(prev => {
      const next = { ...prev }
      const sets = [...(next[exIdx] || [])]
      sets[setIdx] = { ...sets[setIdx], [field]: val }
      next[exIdx] = sets
      if (field === 'done' && val === true) autoSaveSet(exIdx, setIdx, sets[setIdx])
      return next
    })
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

  const handleFinish = async () => {
    setSaving(true)
    const supabase = createClient()
    if (sessionIdRef.current) {
      await supabase.from('sessions').update({
        note, sets_done: setsDone, sets_total: setsTotal, total_volume: Math.round(totalVol),
      }).eq('id', sessionIdRef.current)
    } else {
      if (setsDone === 0) { alert('Complète au moins une série avant de terminer.'); setSaving(false); return }
      const userId = userIdRef.current
      if (!userId) return
      const { data: session, error } = await supabase.from('sessions').insert({
        user_id: userId, session_type: type, session_date: date,
        total_volume: Math.round(totalVol), sets_done: setsDone, sets_total: setsTotal, note,
      }).select().single()
      if (error || !session) { alert('Erreur lors de la sauvegarde.'); setSaving(false); return }
      const setsToInsert = prog.flatMap((ex, exIdx) =>
        (exData[exIdx] || []).map((d, setIdx) => ({
          session_id: session.id, exercise_index: exIdx, exercise_name: ex.name,
          set_index: setIdx, weight_kg: d.kg ? parseFloat(d.kg) : null,
          reps: d.reps ? parseInt(d.reps) : null, completed: d.done,
        }))
      )
      await supabase.from('session_sets').insert(setsToInsert)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => router.replace('/dashboard'), 1200)
  }

  if (!profile) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-32">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold leading-tight">{SESSION_LABELS[type]}</h1>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500">{profile.name} · {pType === 'male' ? 'Prise de muscle' : 'Perte de gras'}</p>
            {autoSaveStatus === 'saving' && <span className="text-xs text-amber-500 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />Sauvegarde...</span>}
            {autoSaveStatus === 'saved' && <span className="text-xs text-teal-600 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-teal-500" />Sauvegardé</span>}
          </div>
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500" />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className={`rounded-xl p-3 text-center ${colors.bg}`}>
          <div className={`text-lg font-semibold ${colors.text}`}>{Math.round(totalVol).toLocaleString('fr-FR')}</div>
          <div className="text-xs text-gray-500">kg volume</div>
        </div>
        <div className={`rounded-xl p-3 text-center ${colors.bg}`}>
          <div className={`text-lg font-semibold ${colors.text}`}>{setsDone}/{setsTotal}</div>
          <div className="text-xs text-gray-500">séries</div>
        </div>
        <div className={`rounded-xl p-3 text-center ${colors.bg}`}>
          <div className={`text-lg font-semibold ${colors.text}`}>{setsTotal > 0 ? Math.round((setsDone / setsTotal) * 100) : 0}%</div>
          <div className="text-xs text-gray-500">complété</div>
        </div>
      </div>

      <div className="space-y-4">
        {prog.map((ex, exIdx) => {
          const sets = exData[exIdx] || []
          const allDone = sets.length > 0 && sets.every(s => s.done)
          const anyDone = sets.some(s => s.done)
          const exNote = ex.notes?.[pType]
          const isHiit = ex.kind === 'hiit'

          return (
            <div key={exIdx} className={`rounded-2xl border overflow-hidden ${isHiit ? 'bg-orange-50 border-orange-100' : 'bg-white border-gray-100'}`}>
              <div className={`flex items-start justify-between px-4 py-3 border-b ${isHiit ? 'border-orange-100' : 'border-gray-50'}`}>
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{ex.name}</p>
                    {isHiit && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">HIIT cardio</span>}
                    {ex.kind === 'together' && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Ensemble</span>}
                    <ExerciseDemo name={ex.name} gifFile={ex.demo.gifFile} youtube={ex.demo.youtube} tip={ex.demo.tip} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">Objectif : {ex.target[pType]}</p>
                  {exNote && <p className={`text-xs mt-0.5 italic ${isHiit ? 'text-orange-600' : 'text-teal-600'}`}>{exNote}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${allDone ? 'bg-teal-50 text-teal-700' : anyDone ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>
                  {allDone ? 'Terminé' : anyDone ? 'En cours' : 'À faire'}
                </span>
              </div>

              <div className="px-4 py-2">
                <div className="grid grid-cols-12 gap-2 mb-2 text-xs text-gray-400 font-medium">
                  <div className="col-span-2">Série</div>
                  <div className="col-span-4">{isHiit ? 'Durée' : 'Poids (kg)'}</div>
                  <div className="col-span-3">{isHiit ? 'Effort' : 'Reps'}</div>
                  <div className="col-span-1 text-center">OK</div>
                  <div className="col-span-2"></div>
                </div>
                {sets.map((s, setIdx) => {
                  const vol = !isHiit && s.done && s.kg && s.reps ? Math.round(parseFloat(s.kg) * parseInt(s.reps)) : null
                  const hasNext = setIdx < sets.length - 1 && !sets[setIdx + 1]?.done && (s.kg || s.reps)
                  return (
                    <div key={setIdx} className={`grid grid-cols-12 gap-2 items-center py-1.5 border-t border-gray-50 ${s.done ? 'opacity-60' : ''}`}>
                      <div className="col-span-2 text-xs text-gray-400 font-medium">{setIdx + 1}</div>
                      <div className="col-span-4">
                        <input type="number" value={s.kg} onChange={e => updateSet(exIdx, setIdx, 'kg', e.target.value)}
                          placeholder={isHiit ? '30' : '—'} disabled={s.done}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:bg-gray-50" />
                      </div>
                      <div className="col-span-3">
                        <input type="number" value={s.reps} onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                          placeholder={isHiit ? 'RPE' : '—'} disabled={s.done}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:bg-gray-50" />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <input type="checkbox" checked={s.done} onChange={e => updateSet(exIdx, setIdx, 'done', e.target.checked)}
                          className="w-4 h-4 accent-teal-600 cursor-pointer" />
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        {vol !== null && <span className="text-xs text-gray-300">{vol}</span>}
                        {hasNext && s.done && !isHiit && (
                          <button onClick={() => copyToNextSet(exIdx, setIdx)} title="Copier vers la série suivante"
                            className="text-gray-300 hover:text-teal-500 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
                <button onClick={() => addSet(exIdx)} className="mt-2 mb-1 text-xs text-gray-400 hover:text-teal-600 transition-colors">
                  + Ajouter une série
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5">
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Notes de séance..." rows={3}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 flex gap-3">
        <button onClick={() => router.back()} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          Annuler
        </button>
        <button onClick={handleFinish} disabled={saving || saved}
          className="flex-[2] py-3 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-40 transition-colors">
          {saved ? 'Terminée ✓' : saving ? 'Finalisation...' : 'Terminer la séance'}
        </button>
      </div>
    </div>
  )
}
