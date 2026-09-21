import { createClient } from './supabase'
import { TrackingMode } from './program'
import { SessionTotals } from './sessionLogic'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface SetIdentity {
  sessionId: string
  exerciseIndex: number
  exerciseName: string
  exerciseId: string | null
  setIndex: number
}

export interface SetPayload {
  weightKg: number | null
  reps: number | null
  durationMinutes: number | null
  resistanceNote: string | null
  completed: boolean
}

export interface LocalSet {
  done: boolean
  primary: string
  secondary: string
  saveState: SaveState
}

export function parseNumberOrNull(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function parseIntOrNull(value: string): number | null {
  if (value.trim() === '') return null
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : null
}

export function emptyLocalSet(): LocalSet {
  return { done: false, primary: '', secondary: '', saveState: 'idle' }
}

/** Convertit une ligne session_sets brute (Supabase) en état local, selon le mode de suivi. */
export function rowToLocalSet(mode: TrackingMode, row: any): LocalSet {
  if (mode === 'cardio') {
    return { done: !!row.completed, primary: row.resistance_note ?? '', secondary: row.duration_minutes != null ? String(row.duration_minutes) : '', saveState: 'idle' }
  }
  if (mode === 'bodyweight') {
    return { done: !!row.completed, primary: '', secondary: row.reps != null ? String(row.reps) : '', saveState: 'idle' }
  }
  return { done: !!row.completed, primary: row.weight_kg != null ? String(row.weight_kg) : '', secondary: row.reps != null ? String(row.reps) : '', saveState: 'idle' }
}

/**
 * Fusionne les séries sauvegardées (identifiées par set_index) dans le tableau de
 * séries par défaut prévu par le programme, sans jamais perdre les séries qui
 * n'ont pas encore été sauvegardées. N'étend le tableau que si une ligne
 * sauvegardée porte un set_index supérieur au nombre de séries par défaut.
 */
export function mergeDefaultAndSavedSets(
  defaultSets: LocalSet[],
  savedRows: { set_index: number }[],
  toLocalSet: (row: any) => LocalSet
): LocalSet[] {
  const merged = defaultSets.slice()
  for (const row of savedRows) {
    const idx = row.set_index
    while (merged.length <= idx) merged.push(emptyLocalSet())
    merged[idx] = toLocalSet(row)
  }
  return merged
}

export interface ExerciseHydrationSpec {
  key: string
  exerciseId: string | null
  defaultSets: number
  trackingMode: TrackingMode
}

/**
 * Construit l'état initial des séries pour une séance A/B/C à partir du programme
 * (source de vérité pour le nombre de séries prévues) et des lignes déjà
 * sauvegardées en base, rattachées par exercise_id (jamais par position dans le
 * tableau), pour rester correct même si l'ordre des exercices change.
 */
export function hydrateNewSessionSets(
  specs: ExerciseHydrationSpec[],
  savedRows: { exercise_id: string | null; set_index: number }[]
): Record<string, LocalSet[]> {
  const grouped = new Map<string, any[]>()
  for (const row of savedRows) {
    if (!row.exercise_id) continue
    if (!grouped.has(row.exercise_id)) grouped.set(row.exercise_id, [])
    grouped.get(row.exercise_id)!.push(row)
  }

  const result: Record<string, LocalSet[]> = {}
  for (const spec of specs) {
    const defaults = Array.from({ length: spec.defaultSets }, () => emptyLocalSet())
    const rows = spec.exerciseId ? grouped.get(spec.exerciseId) : undefined
    result[spec.key] = rows && rows.length > 0
      ? mergeDefaultAndSavedSets(defaults, rows, row => rowToLocalSet(spec.trackingMode, row))
      : defaults
  }
  return result
}

/**
 * Sauvegarde fiable d'une série via upsert (au lieu d'un delete+insert).
 * - Nouvelles séries (exercise_id renseigné) : upsert ciblant la contrainte
 *   unique (session_id, exercise_id, set_index).
 * - Anciennes séries (exercise_id null) : upsert ciblant la contrainte unique
 *   historique (session_id, exercise_index, set_index), seule compatible avec
 *   ces lignes.
 */
export async function saveSet(identity: SetIdentity, payload: SetPayload): Promise<{ error: string | null }> {
  const supabase = createClient()
  const onConflict = identity.exerciseId
    ? 'session_id,exercise_id,set_index'
    : 'session_id,exercise_index,set_index'

  const { error } = await supabase
    .from('session_sets')
    .upsert(
      {
        session_id: identity.sessionId,
        exercise_index: identity.exerciseIndex,
        exercise_name: identity.exerciseName,
        exercise_id: identity.exerciseId,
        set_index: identity.setIndex,
        weight_kg: payload.weightKg,
        reps: payload.reps,
        duration_minutes: payload.durationMinutes,
        resistance_note: payload.resistanceNote,
        completed: payload.completed,
      },
      { onConflict }
    )

  if (error) {
    console.error('[saveSet] upsert failed:', error.message)
    return { error: 'Sauvegarde impossible. Vérifie ta connexion.' }
  }
  return { error: null }
}

/**
 * File d'attente par clé : sérialise des tâches asynchrones concurrentes qui
 * partagent la même clé, pour rester sûr face aux clics rapides et aux réponses
 * réseau qui arrivent dans le désordre. Utilisée à la fois pour les écritures de
 * séries (une file par série) et pour la synchronisation des totaux (une file
 * par séance), afin qu'il n'y ait jamais plus d'une requête réseau en vol pour
 * une même ressource.
 */
export function createSetSaveQueue() {
  const queues = new Map<string, Promise<unknown>>()
  return function enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = queues.get(key) || Promise.resolve()
    const next = previous.then(task, task)
    queues.set(key, next.catch(() => undefined))
    return next
  }
}

export async function updateSessionTotals(
  sessionId: string,
  totals: { setsDone: number; setsTotal: number; totalVolume: number }
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('sessions')
    .update({ sets_done: totals.setsDone, sets_total: totals.setsTotal, total_volume: totals.totalVolume })
    .eq('id', sessionId)

  if (error) {
    console.error('[updateSessionTotals] update failed:', error.message)
    return { error: 'Impossible de mettre à jour les totaux de la séance.' }
  }
  return { error: null }
}

export interface PersistSetDeps {
  ensureSessionId: () => Promise<string | null>
  getSessionId: () => string | null
  saveSetFn: (identity: SetIdentity, payload: SetPayload) => Promise<{ error: string | null }>
  updateTotalsFn: (sessionId: string, totals: SessionTotals) => Promise<{ error: string | null }>
  /** Doit lire l'état le plus frais au moment de l'appel (pas une valeur capturée à l'avance). */
  computeTotals: () => SessionTotals
  saveQueue: ReturnType<typeof createSetSaveQueue>
  totalsQueue: ReturnType<typeof createSetSaveQueue>
}

export interface PersistSetResult {
  error: string | null
  /** Exposée pour les tests / un retry explicite ; l'appelant UI n'a pas besoin de l'attendre. */
  totalsPromise?: Promise<void>
}

/**
 * Sauvegarde une série puis synchronise les totaux de la séance.
 * - Les totaux sont calculés paresseusement (deps.computeTotals) au moment où la
 *   tâche s'exécute réellement dans la file, jamais avant : cela élimine tout
 *   décalage avec l'état React le plus récent.
 * - La synchronisation des totaux passe par une file par séance (totalsQueue),
 *   ce qui garantit qu'il n'y a jamais qu'une seule requête de mise à jour des
 *   totaux en vol : une sauvegarde plus ancienne ne peut donc jamais écraser des
 *   totaux plus récents, quel que soit l'ordre de résolution réseau.
 * - Si la sauvegarde de la série échoue, aucun total n'est poussé.
 */
export async function persistSetAndSyncTotals(
  key: string,
  identity: Omit<SetIdentity, 'sessionId'>,
  payload: SetPayload,
  deps: PersistSetDeps
): Promise<PersistSetResult> {
  let sessionId = deps.getSessionId()
  if (!sessionId) sessionId = await deps.ensureSessionId()
  if (!sessionId) return { error: 'Aucune séance à mettre à jour.' }

  const resolvedSessionId = sessionId
  const { error } = await deps.saveQueue(key, () => deps.saveSetFn({ ...identity, sessionId: resolvedSessionId }, payload))
  if (error) return { error }

  const totalsPromise = deps.totalsQueue(`totals:${resolvedSessionId}`, async () => {
    const totals = deps.computeTotals()
    const { error: totalsError } = await deps.updateTotalsFn(resolvedSessionId, totals)
    if (totalsError) console.error('[persistSetAndSyncTotals] synchronisation des totaux échouée:', totalsError)
  })

  return { error: null, totalsPromise }
}
