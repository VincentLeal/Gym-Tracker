import { isNewSessionType, isLegacySessionType, NewSessionType, LegacySessionType, ProgramRole, TrackingMode } from './program'

// ---------------------------------------------------------------------------
// Validation de la route /session/[type]
// ---------------------------------------------------------------------------

export type SessionRouteValidation =
  | { kind: 'new'; type: NewSessionType }
  | { kind: 'legacy'; type: LegacySessionType }
  | { kind: 'invalid' }

export function validateSessionRouteParam(raw: unknown): SessionRouteValidation {
  if (typeof raw !== 'string') return { kind: 'invalid' }
  const value = raw.toLowerCase()
  if (isNewSessionType(value)) return { kind: 'new', type: value }
  if (isLegacySessionType(value)) return { kind: 'legacy', type: value }
  return { kind: 'invalid' }
}

// ---------------------------------------------------------------------------
// Totaux de séance (séries faites/totales, volume)
// ---------------------------------------------------------------------------

export interface SetCalcEntry {
  done: boolean
  weightKg?: number | null
  reps?: number | null
}

export interface ExerciseSetsInput {
  trackingMode: TrackingMode
  /** true si cette prescription est facultative pour le participant concerné. */
  optional: boolean
  sets: SetCalcEntry[]
}

export interface SessionTotals {
  setsTotal: number
  setsDone: number
  totalVolume: number
}

/**
 * Calcule sets_total / sets_done / total_volume pour une séance.
 * - Le cardio n'entre jamais dans le décompte des séries ni dans le volume.
 * - Une série facultative non réalisée n'entre ni dans sets_total ni dans sets_done
 *   (elle ne doit pas bloquer ni fausser l'achèvement de la séance).
 * - Seules les séries de force (strength) terminées avec poids ET reps renseignés
 *   contribuent au volume (le poids du corps et l'assistance ne sont pas une charge réelle).
 */
export function computeSessionTotals(exercises: ExerciseSetsInput[]): SessionTotals {
  let setsTotal = 0
  let setsDone = 0
  let totalVolume = 0

  for (const exercise of exercises) {
    if (exercise.trackingMode === 'cardio') continue

    for (const set of exercise.sets) {
      const isCounted = !exercise.optional || set.done
      if (isCounted) {
        setsTotal++
        if (set.done) setsDone++
      }
      if (set.done && exercise.trackingMode === 'strength' && set.weightKg && set.reps) {
        totalVolume += set.weightKg * set.reps
      }
    }
  }

  return { setsTotal, setsDone, totalVolume: Math.round(totalVolume) }
}

export function isSessionCompleted(setsTotal: number, setsDone: number): boolean {
  return setsTotal > 0 && setsDone >= setsTotal
}

// ---------------------------------------------------------------------------
// Prochaine séance recommandée
// ---------------------------------------------------------------------------

export interface SessionSummary {
  sessionType: string
  sessionDate: string
  setsTotal: number
  setsDone: number
}

/** Renvoie le dernier type de séance A/B/C terminé (au sens sets_done >= sets_total), ou null. */
export function getLastCompletedNewSession(sessions: SessionSummary[]): NewSessionType | null {
  const completed = sessions
    .filter(s => isNewSessionType(s.sessionType) && isSessionCompleted(s.setsTotal, s.setsDone))
    .slice()
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
  const last = completed[0]
  return last ? (last.sessionType as NewSessionType) : null
}

/**
 * Séquence logique : Vincent A -> B -> C -> A ; Axelle A -> B -> A.
 * Les anciennes séances push/pull/legs ne sont jamais prises en compte.
 */
export function getNextRecommendedSession(role: ProgramRole, lastCompleted: NewSessionType | null): NewSessionType {
  if (role === 'axelle') {
    return lastCompleted === 'a' ? 'b' : 'a'
  }
  if (lastCompleted === 'a') return 'b'
  if (lastCompleted === 'b') return 'c'
  return 'a'
}

// ---------------------------------------------------------------------------
// Semaines consécutives (calendrier ISO)
// ---------------------------------------------------------------------------

/** Clé "YYYY-Www" pour la semaine ISO 8601 d'une date. */
export function toISOWeekKey(dateStr: string): string {
  const parsed = new Date(`${dateStr}T00:00:00Z`)
  const d = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/**
 * Nombre de semaines ISO consécutives, en partant de la semaine de referenceDate,
 * ayant au moins une séance terminée. Plusieurs séances la même semaine ISO ne
 * comptent qu'une fois. Le compteur s'arrête à la première semaine sans séance.
 */
export function computeConsecutiveWeeks(completedSessionDates: string[], referenceDate: Date = new Date()): number {
  const weekKeys = new Set(completedSessionDates.map(toISOWeekKey))
  let count = 0
  let cursor = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()))
  for (;;) {
    const key = toISOWeekKey(cursor.toISOString().split('T')[0])
    if (!weekKeys.has(key)) break
    count++
    cursor = new Date(cursor.getTime() - 7 * 86400000)
  }
  return count
}
