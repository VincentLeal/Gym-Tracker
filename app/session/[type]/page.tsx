'use client'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  PROGRAMS, resolveProgramRole, isSessionAllowedForRole, getExercisesForRole,
  getSessionLabel, getSessionColors, describePrescription,
  ProgramRole, TrackingMode, AnySessionType,
} from '@/lib/program'
import { validateSessionRouteParam, SessionRouteValidation, computeSessionTotals, ExerciseSetsInput, isSessionCompleted } from '@/lib/sessionLogic'
import {
  createSetSaveQueue, saveSet, updateSessionTotals, parseNumberOrNull, parseIntOrNull,
  rowToLocalSet, hydrateNewSessionSets, persistSetAndSyncTotals,
  SaveState, LocalSet, ExerciseHydrationSpec,
} from '@/lib/sessionSets'
import ExerciseCard from '@/components/ExerciseCard'
import SaveStatus from '@/components/SaveStatus'

type SetsState = Record<string, LocalSet[]>

interface ExerciseView {
  key: string
  exerciseIndex: number
  exerciseId: string | null
  name: string
  trackingMode: TrackingMode
  optional: boolean
  metaLine: string
  note?: string
  badge?: string
  demo?: { gifFile?: string; youtube?: string; tip?: string }
}

interface HistoryEntry { date: string; sets: { primary: string; secondary: string }[] }

const PROGRESS_BAR_COLORS: Record<string, string> = {
  a: 'bg-emerald-500', b: 'bg-sky-500', c: 'bg-amber-500',
  push: 'bg-teal-500', pull: 'bg-blue-500', legs: 'bg-purple-500',
}

function today() { return new Date().toISOString().split('T')[0] }

function getFieldConfig(mode: TrackingMode): { labels: { primary: string; secondary: string }; types: { primary: 'number' | 'text'; secondary: 'number' | 'text' } } {
  switch (mode) {
    case 'strength':
      return { labels: { primary: 'Poids (kg)', secondary: 'Reps' }, types: { primary: 'number', secondary: 'number' } }
    case 'assisted':
      return { labels: { primary: 'Assistance (kg)', secondary: 'Reps' }, types: { primary: 'number', secondary: 'number' } }
    case 'bodyweight':
      return { labels: { primary: '', secondary: 'Reps' }, types: { primary: 'number', secondary: 'number' } }
    case 'cardio':
      return { labels: { primary: 'Résistance / note', secondary: 'Durée (min)' }, types: { primary: 'text', secondary: 'number' } }
  }
}

function buildPayload(mode: TrackingMode, s: LocalSet) {
  if (mode === 'cardio') {
    return { weightKg: null, reps: null, durationMinutes: parseIntOrNull(s.secondary), resistanceNote: s.primary.trim() || null }
  }
  if (mode === 'bodyweight') {
    return { weightKg: null, reps: parseIntOrNull(s.secondary), durationMinutes: null, resistanceNote: null }
  }
  return { weightKg: parseNumberOrNull(s.primary), reps: parseIntOrNull(s.secondary), durationMinutes: null, resistanceNote: null }
}

function buildTotalsInput(exercises: ExerciseView[], data: SetsState): ExerciseSetsInput[] {
  return exercises.map(ex => ({
    trackingMode: ex.trackingMode,
    optional: ex.optional,
    sets: (data[ex.key] || []).map(s => ({
      done: s.done,
      weightKg: parseNumberOrNull(s.primary),
      reps: parseIntOrNull(s.secondary),
    })),
  }))
}

function formatHistoryRow(mode: TrackingMode, row: any): { primary: string; secondary: string } {
  if (mode === 'cardio') return { primary: row.resistance_note || '—', secondary: row.duration_minutes != null ? `${row.duration_minutes} min` : '—' }
  if (mode === 'bodyweight') return { primary: '—', secondary: row.reps != null ? String(row.reps) : '—' }
  return { primary: row.weight_kg != null ? `${row.weight_kg} kg` : '—', secondary: row.reps != null ? String(row.reps) : '—' }
}

export default function SessionPage() {
  const router = useRouter()
  const params = useParams()

  const [routeInfo, setRouteInfo] = useState<SessionRouteValidation>({ kind: 'invalid' })
  const [ready, setReady] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [exercises, setExercises] = useState<ExerciseView[]>([])
  const [exData, setExData] = useState<SetsState>({})
  const [globalSaveState, setGlobalSaveState] = useState<SaveState>('idle')
  const [historyView, setHistoryView] = useState<ExerciseView | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([])

  const sessionIdRef = useRef<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  const exDataRef = useRef<SetsState>({})
  const exercisesRef = useRef<ExerciseView[]>([])
  const dateRef = useRef(date)
  const routeInfoRef = useRef<SessionRouteValidation>({ kind: 'invalid' })
  const ensureSessionPromiseRef = useRef<Promise<string | null> | null>(null)
  const saveQueueRef = useRef(createSetSaveQueue())
  const totalsQueueRef = useRef(createSetSaveQueue())
  const debounceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const noteEffectMountedRef = useRef(false)

  useEffect(() => { exercisesRef.current = exercises }, [exercises])
  useEffect(() => { dateRef.current = date }, [date])

  // Met à jour exDataRef de façon synchrone, au même moment que le state React
  // (et non via un useEffect qui ne se déclenche qu'après le prochain rendu),
  // pour que tout calcul de totaux lisant exDataRef juste après une action
  // utilisateur voie toujours l'état le plus frais, sans décalage possible.
  const updateExData = useCallback((updater: (prev: SetsState) => SetsState) => {
    setExData(prev => {
      const next = updater(prev)
      exDataRef.current = next
      return next
    })
  }, [])

  // -------------------------------------------------------------------------
  // Chargement initial
  // -------------------------------------------------------------------------
  useEffect(() => {
    const rawType = params.type
    const validation = validateSessionRouteParam(typeof rawType === 'string' ? rawType : undefined)
    routeInfoRef.current = validation
    setRouteInfo(validation)
    if (validation.kind === 'invalid') { router.replace('/dashboard'); return }

    const searchId = new URLSearchParams(window.location.search).get('id')
    const supabase = createClient()

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      userIdRef.current = session.user.id

      const { data: prof } = await supabase
        .from('profiles')
        .select('name, program_role, profile_type')
        .eq('id', session.user.id)
        .single()

      const role: ProgramRole = resolveProgramRole(prof)
      setProfileName(prof?.name || '')

      if (validation.kind === 'new') {
        if (!isSessionAllowedForRole(validation.type, role)) { router.replace('/dashboard'); return }

        const baseExercises: ExerciseView[] = getExercisesForRole(validation.type, role).map((ex, idx) => {
          const prescription = ex.prescriptions[role]!
          const metaLine = ex.trackingMode === 'cardio'
            ? [
                prescription.durationMinMinutes
                  ? `${prescription.durationMinMinutes}${prescription.durationMaxMinutes && prescription.durationMaxMinutes !== prescription.durationMinMinutes ? `-${prescription.durationMaxMinutes}` : ''} min`
                  : '',
                prescription.intensity || '',
              ].filter(Boolean).join(' · ')
            : describePrescription(prescription)

          return {
            key: ex.exerciseId,
            exerciseIndex: idx,
            exerciseId: ex.exerciseId,
            name: ex.name,
            trackingMode: ex.trackingMode,
            optional: !!prescription.optional,
            metaLine,
            note: prescription.note,
            badge: prescription.optional ? 'Facultatif' : undefined,
            demo: ex.demo,
          }
        })

        const hydrationSpecs: ExerciseHydrationSpec[] = baseExercises.map(ex => {
          const prescription = PROGRAMS[validation.type].find(e => e.exerciseId === ex.exerciseId)?.prescriptions[role]
          return { key: ex.key, exerciseId: ex.exerciseId, defaultSets: prescription?.defaultSets ?? 1, trackingMode: ex.trackingMode }
        })

        // Toujours partir des séries prévues par le programme, puis fusionner les
        // lignes déjà sauvegardées par-dessus (par exercise_id + set_index) : une
        // séance chargée avec seulement la série 0 sauvegardée doit quand même
        // afficher toutes les séries prévues, pas seulement celle-ci.
        let initData: SetsState = hydrateNewSessionSets(hydrationSpecs, [])

        if (searchId) {
          setEditMode(true)
          const [{ data: existingSession }, { data: existingSets }] = await Promise.all([
            supabase.from('sessions').select('id, session_date, note, session_type').eq('id', searchId).single(),
            supabase.from('session_sets').select('*').eq('session_id', searchId).order('exercise_index').order('set_index'),
          ])

          if (!existingSession || existingSession.session_type !== validation.type) { router.replace('/dashboard'); return }

          sessionIdRef.current = searchId
          setDate(existingSession.session_date)
          setNote(existingSession.note || '')

          initData = hydrateNewSessionSets(hydrationSpecs, existingSets || [])
        }

        setExercises(baseExercises)
        updateExData(() => initData)
        // La simple consultation/édition d'une séance ne doit déclencher aucune
        // écriture : les totaux ne sont resynchronisés qu'après une action
        // utilisateur réelle (voir persistSet).
      } else {
        // Séance historique (push/pull/legs) : édition uniquement, jamais de création.
        if (!searchId) { router.replace('/dashboard'); return }

        const [{ data: existingSession }, { data: existingSets }] = await Promise.all([
          supabase.from('sessions').select('id, session_date, note, session_type').eq('id', searchId).single(),
          supabase.from('session_sets').select('*').eq('session_id', searchId).order('exercise_index').order('set_index'),
        ])

        if (!existingSession || existingSession.session_type !== validation.type) { router.replace('/dashboard'); return }

        sessionIdRef.current = searchId
        setEditMode(true)
        setDate(existingSession.session_date)
        setNote(existingSession.note || '')

        const order: number[] = []
        const byIndex = new Map<number, any[]>()
        for (const s of existingSets || []) {
          if (!byIndex.has(s.exercise_index)) { byIndex.set(s.exercise_index, []); order.push(s.exercise_index) }
          byIndex.get(s.exercise_index)!.push(s)
        }

        const legacyExercises: ExerciseView[] = order.map(idx => ({
          key: `legacy-${idx}`,
          exerciseIndex: idx,
          exerciseId: null,
          name: byIndex.get(idx)![0].exercise_name,
          trackingMode: 'strength',
          optional: false,
          metaLine: '',
        }))

        const initData: SetsState = {}
        legacyExercises.forEach(ex => {
          const rows = byIndex.get(ex.exerciseIndex)!.slice().sort((a, b) => a.set_index - b.set_index)
          initData[ex.key] = rows.map(r => rowToLocalSet('strength', r))
        })

        setExercises(legacyExercises)
        updateExData(() => initData)
        // Idem : consulter une ancienne séance PPL ne doit ni recalculer ni
        // réécrire ses totaux historiques (sets_total/sets_done/total_volume).
      }

      setReady(true)
    })
  }, [params.type, router, updateExData])

  // -------------------------------------------------------------------------
  // Auto-save note / date
  // -------------------------------------------------------------------------
  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionIdRef.current) return sessionIdRef.current
    if (ensureSessionPromiseRef.current) return ensureSessionPromiseRef.current
    const validation = routeInfoRef.current
    if (validation.kind !== 'new') return null
    const userId = userIdRef.current
    if (!userId) { console.error('[ensureSession] userId manquant — auth non prête'); return null }

    const promise: Promise<string | null> = (async () => {
      const supabase = createClient()
      const totals = computeSessionTotals(buildTotalsInput(exercisesRef.current, exDataRef.current))
      const { data, error } = await supabase.from('sessions').insert({
        user_id: userId,
        session_type: validation.type,
        session_date: dateRef.current,
        total_volume: totals.totalVolume,
        sets_done: totals.setsDone,
        sets_total: totals.setsTotal,
        note: '',
      }).select().single()
      ensureSessionPromiseRef.current = null
      if (error || !data) { console.error('[ensureSession] insertion échouée:', error?.message); return null }
      sessionIdRef.current = data.id
      router.replace(`/session/${validation.type}?id=${data.id}`)
      return data.id as string
    })()

    ensureSessionPromiseRef.current = promise
    return promise
  }, [router])

  useEffect(() => {
    // Ignore le montage initial (état par défaut ou note chargée depuis la base) :
    // seule une vraie modification de l'utilisateur doit déclencher une sauvegarde.
    if (!noteEffectMountedRef.current) {
      noteEffectMountedRef.current = true
      return
    }
    // Pas de séance existante et rien à sauvegarder : ne crée surtout pas de
    // séance vide juste parce que l'utilisateur a ouvert puis quitté la page.
    if (!sessionIdRef.current && note.trim() === '') return

    const t = setTimeout(async () => {
      let sessionId = sessionIdRef.current
      if (!sessionId) sessionId = await ensureSession()
      if (!sessionId) return
      const { error } = await createClient().from('sessions').update({ note }).eq('id', sessionId)
      if (error) { console.error('[note autosave]', error.message); return }
    }, 1200)
    return () => clearTimeout(t)
  }, [note, ensureSession])

  useEffect(() => {
    const sessionId = sessionIdRef.current
    if (!sessionId) return
    createClient().from('sessions').update({ session_date: date }).eq('id', sessionId)
  }, [date])

  // -------------------------------------------------------------------------
  // Sauvegarde des séries
  // -------------------------------------------------------------------------
  const setRowSaveState = useCallback((key: string, setIdx: number, state: SaveState) => {
    updateExData(prev => {
      const rows = prev[key]
      if (!rows || !rows[setIdx]) return prev
      const nextRows = rows.slice()
      nextRows[setIdx] = { ...nextRows[setIdx], saveState: state }
      return { ...prev, [key]: nextRows }
    })
  }, [updateExData])

  const persistSet = useCallback(async (view: ExerciseView, setIdx: number, snapshot: LocalSet) => {
    setRowSaveState(view.key, setIdx, 'saving')
    setGlobalSaveState('saving')

    const payload = buildPayload(view.trackingMode, snapshot)
    const identity = { exerciseIndex: view.exerciseIndex, exerciseName: view.name, exerciseId: view.exerciseId, setIndex: setIdx }

    const { error } = await persistSetAndSyncTotals(
      `${view.key}:${setIdx}`,
      identity,
      { ...payload, completed: snapshot.done },
      {
        ensureSessionId: ensureSession,
        getSessionId: () => sessionIdRef.current,
        saveSetFn: saveSet,
        updateTotalsFn: updateSessionTotals,
        // Lu paresseusement au moment où la tâche de synchronisation s'exécute
        // réellement dans la file, jamais avant : voir persistSetAndSyncTotals.
        computeTotals: () => computeSessionTotals(buildTotalsInput(exercisesRef.current, exDataRef.current)),
        saveQueue: saveQueueRef.current,
        totalsQueue: totalsQueueRef.current,
      }
    )

    if (error) {
      setRowSaveState(view.key, setIdx, 'error')
      setGlobalSaveState('error')
      return
    }

    setRowSaveState(view.key, setIdx, 'saved')
    setGlobalSaveState('saved')
    setTimeout(() => setRowSaveState(view.key, setIdx, 'idle'), 1200)
    setTimeout(() => setGlobalSaveState(prev => (prev === 'saved' ? 'idle' : prev)), 1200)
  }, [ensureSession, setRowSaveState])

  const toggleDone = useCallback((view: ExerciseView, setIdx: number) => {
    let updatedSnapshot: LocalSet | null = null
    updateExData(prev => {
      const rows = prev[view.key] || []
      const current = rows[setIdx]
      if (!current) return prev
      updatedSnapshot = { ...current, done: !current.done }
      const nextRows = rows.slice()
      nextRows[setIdx] = updatedSnapshot
      return { ...prev, [view.key]: nextRows }
    })
    const timerKey = `${view.key}:${setIdx}`
    if (debounceTimersRef.current[timerKey]) {
      clearTimeout(debounceTimersRef.current[timerKey])
      delete debounceTimersRef.current[timerKey]
    }
    if (updatedSnapshot) persistSet(view, setIdx, updatedSnapshot)
  }, [persistSet, updateExData])

  const updateField = useCallback((view: ExerciseView, setIdx: number, field: 'primary' | 'secondary', value: string) => {
    let updatedSnapshot: LocalSet | null = null
    let wasDone = false
    updateExData(prev => {
      const rows = prev[view.key] || []
      const current = rows[setIdx]
      if (!current) return prev
      wasDone = current.done
      updatedSnapshot = { ...current, [field]: value }
      const nextRows = rows.slice()
      nextRows[setIdx] = updatedSnapshot
      return { ...prev, [view.key]: nextRows }
    })

    if (!wasDone || !updatedSnapshot) return

    const timerKey = `${view.key}:${setIdx}`
    if (debounceTimersRef.current[timerKey]) clearTimeout(debounceTimersRef.current[timerKey])
    const snapshotForSave = updatedSnapshot
    debounceTimersRef.current[timerKey] = setTimeout(() => {
      delete debounceTimersRef.current[timerKey]
      persistSet(view, setIdx, snapshotForSave)
    }, 700)
  }, [persistSet, updateExData])

  const retryRow = useCallback((view: ExerciseView, setIdx: number) => {
    const snapshot = exDataRef.current[view.key]?.[setIdx]
    if (snapshot) persistSet(view, setIdx, snapshot)
  }, [persistSet])

  const addSet = useCallback((view: ExerciseView) => {
    updateExData(prev => {
      const rows = prev[view.key] || []
      const last = rows[rows.length - 1]
      const nextRow: LocalSet = { done: false, primary: last?.primary || '', secondary: last?.secondary || '', saveState: 'idle' }
      return { ...prev, [view.key]: [...rows, nextRow] }
    })
  }, [updateExData])

  const copyToNext = useCallback((view: ExerciseView, setIdx: number) => {
    updateExData(prev => {
      const rows = prev[view.key] || []
      const current = rows[setIdx]
      const next = rows[setIdx + 1]
      if (!current || !next || next.done) return prev
      const nextRows = rows.slice()
      nextRows[setIdx + 1] = { ...next, primary: current.primary, secondary: current.secondary }
      return { ...prev, [view.key]: nextRows }
    })
  }, [updateExData])

  // -------------------------------------------------------------------------
  // Historique par exercice
  // -------------------------------------------------------------------------
  const openHistory = async (view: ExerciseView) => {
    setHistoryView(view)
    setHistoryLoading(true)
    setHistoryData([])

    const supabase = createClient()
    const userId = userIdRef.current
    if (!userId) { setHistoryLoading(false); return }

    let rows: any[] | null = null
    let queryError: { message: string } | null = null

    if (view.exerciseId) {
      const { data, error } = await supabase
        .from('session_sets')
        .select('weight_kg, reps, duration_minutes, resistance_note, set_index, session_id, sessions!inner(session_date, user_id)')
        .eq('exercise_id', view.exerciseId)
        .eq('completed', true)
        .eq('sessions.user_id', userId)
        .order('set_index')
      rows = data
      queryError = error
    } else {
      const { data, error } = await supabase
        .from('session_sets')
        .select('weight_kg, reps, set_index, session_id, sessions!inner(session_date, user_id, session_type)')
        .eq('exercise_name', view.name)
        .eq('completed', true)
        .eq('sessions.user_id', userId)
        .eq('sessions.session_type', routeInfoRef.current.kind === 'legacy' ? routeInfoRef.current.type : '__none__')
        .order('set_index')
      rows = data
      queryError = error
    }

    if (queryError || !rows) {
      console.error('[openHistory]', queryError?.message)
      setHistoryLoading(false)
      return
    }

    const grouped = new Map<string, { date: string; rows: any[] }>()
    for (const row of rows as any[]) {
      if (row.session_id === sessionIdRef.current) continue
      const sessionDate = row.sessions?.session_date
      if (!sessionDate) continue
      if (!grouped.has(row.session_id)) grouped.set(row.session_id, { date: sessionDate, rows: [] })
      grouped.get(row.session_id)!.rows.push(row)
    }

    const entries: HistoryEntry[] = Array.from(grouped.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .map(g => ({
        date: g.date,
        sets: g.rows.slice().sort((a, b) => a.set_index - b.set_index).map(r => formatHistoryRow(view.trackingMode, r)),
      }))

    setHistoryData(entries)
    setHistoryLoading(false)
  }

  // -------------------------------------------------------------------------
  // Rendu
  // -------------------------------------------------------------------------
  const totals = useMemo(() => computeSessionTotals(buildTotalsInput(exercises, exData)), [exercises, exData])
  const completed = isSessionCompleted(totals.setsTotal, totals.setsDone)

  if (!ready || routeInfo.kind === 'invalid') return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const anyType: AnySessionType = routeInfo.type
  const colors = getSessionColors(anyType)
  const label = getSessionLabel(anyType)
  const progressColor = PROGRESS_BAR_COLORS[anyType] || 'bg-teal-500'

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-8">
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
            <h1 className={`text-sm font-semibold ${colors.text} truncate`}>{label}</h1>
            {editMode && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium flex-shrink-0">Édition</span>
            )}
            {completed && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium flex-shrink-0">Terminée</span>
            )}
          </div>
          <p className="text-xs text-gray-400">{profileName}</p>
        </div>
        <div className="text-xs flex-shrink-0">
          <SaveStatus state={globalSaveState} />
        </div>
      </div>

      <div className="mb-5">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-300"
        />
      </div>

      <div className={`rounded-xl border ${colors.border} ${colors.bg} px-4 py-3 mb-6`}>
        <div className="flex justify-between items-center mb-2">
          <span className={`text-sm font-medium ${colors.text}`}>{totals.setsDone} / {totals.setsTotal} séries</span>
          <span className={`text-sm font-medium ${colors.text}`}>{totals.totalVolume.toLocaleString('fr-FR')} kg</span>
        </div>
        <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: totals.setsTotal ? `${(totals.setsDone / totals.setsTotal) * 100}%` : '0%' }}
          />
        </div>
      </div>

      <div className="space-y-5">
        {exercises.map(ex => {
          const fieldConfig = getFieldConfig(ex.trackingMode)
          const sets = exData[ex.key] || []
          return (
            <ExerciseCard
              key={ex.key}
              name={ex.name}
              metaLine={ex.metaLine}
              note={ex.note}
              badge={ex.badge}
              fieldLabels={fieldConfig.labels}
              fieldTypes={fieldConfig.types}
              demo={ex.demo}
              sets={sets}
              onChangePrimary={(setIdx, v) => updateField(ex, setIdx, 'primary', v)}
              onChangeSecondary={(setIdx, v) => updateField(ex, setIdx, 'secondary', v)}
              onToggleDone={setIdx => toggleDone(ex, setIdx)}
              onCopyToNext={setIdx => copyToNext(ex, setIdx)}
              onAddSet={() => addSet(ex)}
              onRetry={setIdx => retryRow(ex, setIdx)}
              onOpenHistory={() => openHistory(ex)}
            />
          )
        })}
      </div>

      <div className="mt-6">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Notes de séance (ressenti, douleurs, PR…)"
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none"
        />
      </div>

      {historyView && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setHistoryView(null)}>
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
                <p className="text-base font-semibold text-gray-900">{historyView.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Séances précédentes</p>
              </div>
              <button
                onClick={() => setHistoryView(null)}
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
                  const dateStr = new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                  const fieldConfig = getFieldConfig(historyView.trackingMode)
                  return (
                    <div key={i}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{dateStr}</p>
                      <div className="bg-gray-50 rounded-xl overflow-hidden">
                        <div className="grid grid-cols-12 px-3 py-2 text-xs text-gray-400 font-medium border-b border-gray-100">
                          <div className="col-span-2">Série</div>
                          <div className="col-span-5">{fieldConfig.labels.primary || '—'}</div>
                          <div className="col-span-5">{fieldConfig.labels.secondary}</div>
                        </div>
                        {entry.sets.map((s, si) => (
                          <div key={si} className="grid grid-cols-12 px-3 py-2 text-sm border-t border-gray-100">
                            <div className="col-span-2 text-gray-400">{si + 1}</div>
                            <div className="col-span-5 text-gray-700">{s.primary}</div>
                            <div className="col-span-5 text-gray-700">{s.secondary}</div>
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
