import { createClient } from './supabase'

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

/**
 * Sauvegarde fiable d'une série via upsert (au lieu d'un delete+insert), en
 * ciblant la contrainte d'unicité existante (session_id, exercise_index, set_index)
 * qui couvre aussi bien les anciennes séries (exercise_id null) que les nouvelles.
 */
export async function saveSet(identity: SetIdentity, payload: SetPayload): Promise<{ error: string | null }> {
  const supabase = createClient()
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
      { onConflict: 'session_id,exercise_index,set_index' }
    )

  if (error) {
    console.error('[saveSet] upsert failed:', error.message)
    return { error: 'Sauvegarde impossible. Vérifie ta connexion.' }
  }
  return { error: null }
}

/**
 * File d'attente de sauvegarde par clé (une clé par série). Sérialise les écritures
 * concurrentes sur une même série pour rester sûr face aux clics rapides : la dernière
 * valeur soumise est toujours la dernière écrite, quel que soit l'ordre de retour réseau.
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
