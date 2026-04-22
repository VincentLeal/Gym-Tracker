'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { PROGRAMS, SESSION_COLORS, SESSION_LABELS, SessionType } from '@/lib/program'

interface SetData { kg: string; reps: string; done: boolean }
type ExData = Record<number, SetData[]>

function today() {
  return new Date().toISOString().split('T')[0]
}

export default function SessionPage() {
  const router = useRouter()
  const params = useParams()
  const type = params.type as SessionType

  const [profile, setProfile] = useState<{ name: string } | null>(null)
  const [date, setDate] = useState(today())
  const [exData, setExData] = useState<ExData>({})
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const prog = PROGRAMS[type]
  const colors = SESSION_COLORS[type]

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('name').eq('id', session.user.id).single()
      setProfile(prof)
    })
    const init: ExData = {}
    prog.forEach((ex, i) => {
      init[i] = Array.from({ length: ex.defaultSets }, () => ({ kg: '', reps: '', done: false }))
    })
    setExData(init)
  }, [type, router])

  const updateSet = useCallback((exIdx: number, setIdx: number, field: keyof SetData, val: string | boolean) => {
    setExData(prev => {
      const next = { ...prev }
      const sets = [...(next[exIdx] || [])]
      sets[setIdx] = { ...sets[setIdx], [field]: val }
      next[exIdx] = sets
      return next
    })
  }, [])

  const addSet = useCallback((exIdx: number) => {
    setExData(prev => {
      const next = { ...prev }
      next[exIdx] = [...(next[exIdx] || []), { kg: '', reps: '', done: false }]
      return next
    })
  }, [])

  const totalVol = Object.values(exData).flat().reduce((s, d) => {
    if (d.done && d.kg && d.reps) return s + parseFloat(d.kg) * parseInt(d.reps)
    return s
  }, 0)

  const allSets = Object.values(exData).flat()
  const setsDone = allSets.filter(d => d.done).length
  const setsTotal = allSets.length

  const handleSave = async () => {
    if (setsDone === 0) { alert('Complète au moins une série avant d\'enregistrer.'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }

    const { data: session, error } = await supabase.from('sessions').insert({
      user_id: user.id,
      session_type: type,
      session_date: date,
      total_volume: Math.round(totalVol),
      sets_done: setsDone,
      sets_total: setsTotal,
      note,
    }).select().single()

    if (error || !session) { alert('Erreur lors de la sauvegarde.'); setSaving(false); return }

    const setsToInsert = prog.flatMap((ex, exIdx) =>
      (exData[exIdx] || []).map((d, setIdx) => ({
        session_id: session.id,
        exercise_index: exIdx,
        exercise_name: ex.name,
        set_index: setIdx,
        weight_kg: d.kg ? parseFloat(d.kg) : null,
        reps: d.reps ? parseInt(d.reps) : null,
        completed: d.done,
      }))
    )
    await supabase.from('session_sets').insert(setsToInsert)

    setSaving(false)
    setSaved(true)
    setTimeout(() => router.replace('/dashboard'), 1200)
  }

  if (!prog) return null

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
          {profile && <p className="text-xs text-gray-500">{profile.name}</p>}
        </div>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
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
          <div className={`text-lg font-semibold ${colors.text}`}>
            {setsTotal > 0 ? Math.round((setsDone / setsTotal) * 100) : 0}%
          </div>
          <div className="text-xs text-gray-500">complété</div>
        </div>
      </div>

      <div className="space-y-4">
        {prog.map((ex, exIdx) => {
          const sets = exData[exIdx] || []
          const allDone = sets.length > 0 && sets.every(s => s.done)
          const anyDone = sets.some(s => s.done)
          return (
            <div key={exIdx} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex items-start justify-between px-4 py-3 border-b border-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{ex.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Objectif : {ex.targetMe} / {ex.targetHer}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${
                  allDone ? 'bg-teal-50 text-teal-700' :
                  anyDone ? 'bg-amber-50 text-amber-700' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {allDone ? 'Terminé' : anyDone ? 'En cours' : 'À faire'}
                </span>
              </div>

              <div className="px-4 py-2">
                <div className="grid grid-cols-12 gap-2 mb-2 text-xs text-gray-400 font-medium">
                  <div className="col-span-2">Série</div>
                  <div className="col-span-4">Poids (kg)</div>
                  <div className="col-span-4">Reps</div>
                  <div className="col-span-1 text-center">OK</div>
                  <div className="col-span-1"></div>
                </div>
                {sets.map((s, setIdx) => {
                  const vol = s.done && s.kg && s.reps ? Math.round(parseFloat(s.kg) * parseInt(s.reps)) : null
                  return (
                    <div key={setIdx} className={`grid grid-cols-12 gap-2 items-center py-1.5 border-t border-gray-50 ${s.done ? 'opacity-70' : ''}`}>
                      <div className="col-span-2 text-xs text-gray-400 font-medium">{setIdx + 1}</div>
                      <div className="col-span-4">
                        <input
                          type="number"
                          value={s.kg}
                          onChange={e => updateSet(exIdx, setIdx, 'kg', e.target.value)}
                          placeholder="—"
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="number"
                          value={s.reps}
                          onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                          placeholder="—"
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <input
                          type="checkbox"
                          checked={s.done}
                          onChange={e => updateSet(exIdx, setIdx, 'done', e.target.checked)}
                          className="w-4 h-4 accent-teal-600 cursor-pointer"
                        />
                      </div>
                      <div className="col-span-1 text-xs text-gray-300 text-right">
                        {vol !== null ? `${vol}` : ''}
                      </div>
                    </div>
                  )
                })}
                <button
                  onClick={() => addSet(exIdx)}
                  className="mt-2 mb-1 text-xs text-gray-400 hover:text-teal-600 transition-colors"
                >
                  + Ajouter une série
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Notes de séance..."
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
        />
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 flex gap-3">
        <button
          onClick={() => router.back()}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Annuler
        </button>
        <button
          onClick={handleSave}
          disabled={saving || saved || setsDone === 0}
          className="flex-2 flex-grow-[2] py-3 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-40 transition-colors"
        >
          {saved ? 'Enregistrée ✓' : saving ? 'Sauvegarde...' : 'Enregistrer la séance'}
        </button>
      </div>
    </div>
  )
}
