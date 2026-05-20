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

    // Upsert the set
    await supabase.from('session_sets').upsert({
      session_id: sessionId, exercise_index: exIdx, exercise_name: ex.name,
      set_index: setIdx, weight_kg: setData.kg ? parseFloat(setData.kg) : null,
      reps: setData.reps ? parseInt(setData.reps) : null, completed: true,
    }, { onConflict: 'session_id,exercise_index,set_index' })

    // Recompute volume and sets_done from DB to stay accurate
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