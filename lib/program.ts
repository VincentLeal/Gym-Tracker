// Programme d'entraînement V2 — séances A / B / C partagées par Vincent et Axelle.
// Le modèle ne dépend plus de male/female ni de push/pull/legs : chaque exercice
// déclare ses participants autorisés et une prescription dédiée par participant.

export const PROGRAM_ROLES = ['vincent', 'axelle'] as const
export type ProgramRole = (typeof PROGRAM_ROLES)[number]

export const NEW_SESSION_TYPES = ['a', 'b', 'c'] as const
export type NewSessionType = (typeof NEW_SESSION_TYPES)[number]

export const LEGACY_SESSION_TYPES = ['push', 'pull', 'legs'] as const
export type LegacySessionType = (typeof LEGACY_SESSION_TYPES)[number]

export type AnySessionType = NewSessionType | LegacySessionType

export function isNewSessionType(value: string): value is NewSessionType {
  return (NEW_SESSION_TYPES as readonly string[]).includes(value)
}

export function isLegacySessionType(value: string): value is LegacySessionType {
  return (LEGACY_SESSION_TYPES as readonly string[]).includes(value)
}

export function isValidSessionType(value: string): value is AnySessionType {
  return isNewSessionType(value) || isLegacySessionType(value)
}

/**
 * Détermine le rôle programme d'un profil, avec repli contrôlé sur l'ancien
 * champ profile_type (male/female) pour les profils qui n'ont pas encore
 * program_role renseigné. male -> vincent, female -> axelle.
 */
export function resolveProgramRole(profile: { program_role?: string | null; profile_type?: string | null } | null | undefined): ProgramRole {
  if (profile?.program_role === 'vincent' || profile?.program_role === 'axelle') return profile.program_role
  if (profile?.profile_type === 'female') return 'axelle'
  return 'vincent'
}

export type TrackingMode = 'strength' | 'bodyweight' | 'assisted' | 'cardio'

/** Champs pertinents par mode de suivi, pour libeller correctement l'UI et le calcul de volume. */
export const TRACKING_FIELD_LABELS: Record<TrackingMode, { primary: string; secondary: string }> = {
  strength: { primary: 'Poids (kg)', secondary: 'Reps' },
  bodyweight: { primary: '', secondary: 'Reps' },
  assisted: { primary: 'Assistance (kg)', secondary: 'Reps' },
  cardio: { primary: 'Résistance / note', secondary: 'Durée (min)' },
}

export interface Prescription {
  defaultSets: number
  /** Une prescription facultative ne bloque jamais la fin de séance et n'est comptée que si elle est réalisée. */
  optional?: boolean
  repsMin?: number
  repsMax?: number
  rirMin?: number
  rirMax?: number
  restMinSeconds?: number
  restMaxSeconds?: number
  durationMinMinutes?: number
  durationMaxMinutes?: number
  intensity?: string
  note?: string
}

export interface ExerciseDemo {
  gifFile?: string
  youtube?: string
  tip?: string
}

export interface Exercise {
  exerciseId: string
  name: string
  trackingMode: TrackingMode
  participants: ProgramRole[]
  prescriptions: Partial<Record<ProgramRole, Prescription>>
  demo?: ExerciseDemo
}

function restLabel(p: Prescription): string {
  if (p.restMinSeconds == null) return ''
  if (p.restMaxSeconds && p.restMaxSeconds !== p.restMinSeconds) {
    return `${p.restMinSeconds}-${p.restMaxSeconds}s repos`
  }
  return `${p.restMinSeconds}s repos`
}

function rirLabel(p: Prescription): string {
  if (p.rirMin == null) return ''
  if (p.rirMax && p.rirMax !== p.rirMin) return `RIR ${p.rirMin}-${p.rirMax}`
  return `RIR ${p.rirMin}`
}

function repsLabel(p: Prescription): string {
  if (p.repsMin == null) return ''
  if (p.repsMax && p.repsMax !== p.repsMin) return `${p.repsMin}-${p.repsMax} reps`
  return `${p.repsMin} reps`
}

/** Résumé lisible "3 séries · 8-12 reps · RIR 3 · 90-120s repos" pour une prescription donnée. */
export function describePrescription(p: Prescription): string {
  const parts = [
    `${p.defaultSets} série${p.defaultSets > 1 ? 's' : ''}`,
    repsLabel(p),
    rirLabel(p),
    restLabel(p),
  ].filter(Boolean)
  return parts.join(' · ')
}

export const PROGRAMS: Record<NewSessionType, Exercise[]> = {
  a: [
    {
      exerciseId: 'leg_press',
      name: 'Presse à cuisses',
      trackingMode: 'strength',
      participants: ['vincent', 'axelle'],
      prescriptions: {
        vincent: { defaultSets: 3, repsMin: 8, repsMax: 12, rirMin: 3, rirMax: 3, restMinSeconds: 90, restMaxSeconds: 120 },
        axelle: { defaultSets: 3, repsMin: 10, repsMax: 15, rirMin: 3, rirMax: 3, restMinSeconds: 90, restMaxSeconds: 120 },
      },
      demo: { gifFile: 'leg-press.gif', youtube: 'https://www.youtube.com/watch?v=IZxyjW7MPJQ', tip: 'Pieds hauts = fessiers/ischio, pieds bas = quadriceps. Ne verrouille pas les genoux.' },
    },
    {
      exerciseId: 'chest_press_machine',
      name: 'Développé poitrine machine',
      trackingMode: 'strength',
      participants: ['vincent', 'axelle'],
      prescriptions: {
        vincent: { defaultSets: 3, repsMin: 8, repsMax: 12, rirMin: 3, rirMax: 3, restMinSeconds: 90 },
        axelle: { defaultSets: 2, repsMin: 10, repsMax: 15, rirMin: 3, rirMax: 3, restMinSeconds: 90 },
      },
    },
    {
      exerciseId: 'lat_pulldown',
      name: 'Tirage vertical',
      trackingMode: 'strength',
      participants: ['vincent', 'axelle'],
      prescriptions: {
        vincent: { defaultSets: 3, repsMin: 8, repsMax: 12, rirMin: 2, rirMax: 3, restMinSeconds: 90 },
        axelle: { defaultSets: 2, repsMin: 10, repsMax: 15, rirMin: 3, rirMax: 3, restMinSeconds: 90 },
      },
    },
    {
      exerciseId: 'leg_curl',
      name: 'Leg curl',
      trackingMode: 'strength',
      participants: ['vincent', 'axelle'],
      prescriptions: {
        vincent: { defaultSets: 2, repsMin: 10, repsMax: 15, rirMin: 2, rirMax: 3, restMinSeconds: 60, restMaxSeconds: 90 },
        axelle: { defaultSets: 2, repsMin: 10, repsMax: 15, rirMin: 2, rirMax: 3, restMinSeconds: 60, restMaxSeconds: 90 },
      },
      demo: { gifFile: 'leg-curl.gif', youtube: 'https://www.youtube.com/watch?v=1Tq3QdYUuHs', tip: 'Hanches plaquées sur la machine, remonte les talons vers les fesses, descente lente.' },
    },
    {
      exerciseId: 'assisted_pull_up',
      name: 'Tractions assistées',
      trackingMode: 'assisted',
      participants: ['vincent'],
      prescriptions: {
        vincent: { defaultSets: 3, repsMin: 6, repsMax: 10, rirMin: 2, rirMax: 3, restMinSeconds: 90, restMaxSeconds: 120, note: 'La charge saisie correspond au niveau d’assistance (kg), pas à une charge soulevée.' },
      },
      demo: { gifFile: 'pull-up.gif', youtube: 'https://www.youtube.com/watch?v=eGo4IYlbE5g', tip: 'Tire les coudes vers les hanches, pas les épaules vers les oreilles.' },
    },
    {
      exerciseId: 'biceps_curl',
      name: 'Curl biceps à la poulie ou aux haltères',
      trackingMode: 'strength',
      participants: ['vincent', 'axelle'],
      prescriptions: {
        vincent: { defaultSets: 2, repsMin: 10, repsMax: 15, rirMin: 2, rirMax: 3, restMinSeconds: 60, restMaxSeconds: 90 },
        axelle: { defaultSets: 1, repsMin: 10, repsMax: 15, restMinSeconds: 60, restMaxSeconds: 90, optional: true, note: '1 à 2 séries facultatives — ajoute une série si tu le souhaites.' },
      },
      demo: { gifFile: 'bicep-curl.gif', youtube: 'https://www.youtube.com/watch?v=ykJmrZ5v0Oo', tip: 'Coudes fixes, supine la main en montant, descente lente et contrôlée.' },
    },
    {
      exerciseId: 'cardio_a',
      name: 'Cardio',
      trackingMode: 'cardio',
      participants: ['vincent', 'axelle'],
      prescriptions: {
        vincent: { defaultSets: 1, durationMinMinutes: 20, durationMaxMinutes: 25, intensity: 'Modérée — la conversation doit rester possible', note: 'Marche inclinée ou vélo' },
        axelle: { defaultSets: 1, durationMinMinutes: 5, durationMaxMinutes: 10, intensity: 'Facile à modérée', note: 'Marche inclinée ou elliptique — facultatif', optional: true },
      },
    },
  ],

  b: [
    {
      exerciseId: 'hip_thrust',
      name: 'Hip thrust',
      trackingMode: 'strength',
      participants: ['vincent', 'axelle'],
      prescriptions: {
        vincent: { defaultSets: 3, repsMin: 8, repsMax: 12, rirMin: 3, rirMax: 3, restMinSeconds: 90, restMaxSeconds: 120 },
        axelle: { defaultSets: 3, repsMin: 10, repsMax: 15, rirMin: 3, rirMax: 3, restMinSeconds: 90, restMaxSeconds: 120 },
      },
      demo: { gifFile: 'hip-thrust.gif', youtube: 'https://www.youtube.com/watch?v=SEdqd1n0cvg', tip: 'Banc sous les omoplates, pousse avec les talons, contracte fort les fessiers en haut.' },
    },
    {
      exerciseId: 'seated_row',
      name: 'Rowing assis à la poulie ou à la machine',
      trackingMode: 'strength',
      participants: ['vincent', 'axelle'],
      prescriptions: {
        vincent: { defaultSets: 3, repsMin: 8, repsMax: 12, rirMin: 2, rirMax: 3, restMinSeconds: 90 },
        axelle: { defaultSets: 2, repsMin: 10, repsMax: 15, rirMin: 3, rirMax: 3, restMinSeconds: 90 },
      },
      demo: { gifFile: 'seated-cable-row.gif', youtube: 'https://www.youtube.com/watch?v=GZbfZ033f74', tip: 'Reste droit, ramène les coudes derrière le dos, ne te penche pas en arrière.' },
    },
    {
      exerciseId: 'incline_db_press',
      name: 'Développé incliné haltères',
      trackingMode: 'strength',
      participants: ['vincent', 'axelle'],
      prescriptions: {
        vincent: { defaultSets: 3, repsMin: 8, repsMax: 12, rirMin: 2, rirMax: 3, restMinSeconds: 90 },
        axelle: { defaultSets: 2, repsMin: 10, repsMax: 15, rirMin: 3, rirMax: 3, restMinSeconds: 90 },
      },
      demo: { gifFile: 'incline-dumbbell-press.gif', youtube: 'https://www.youtube.com/watch?v=8iPEnn-ltC8', tip: 'Banc à 30-45°, haltères alignés avec le milieu de la poitrine.' },
    },
    {
      exerciseId: 'leg_extension',
      name: 'Extension de jambes',
      trackingMode: 'strength',
      participants: ['vincent', 'axelle'],
      prescriptions: {
        vincent: { defaultSets: 2, repsMin: 10, repsMax: 15, rirMin: 2, rirMax: 3, restMinSeconds: 60, restMaxSeconds: 90 },
        axelle: { defaultSets: 2, repsMin: 10, repsMax: 15, restMinSeconds: 60, restMaxSeconds: 90, optional: true, note: 'Uniquement si les genoux sont confortables.' },
      },
    },
    {
      exerciseId: 'push_up',
      name: 'Pompes',
      trackingMode: 'bodyweight',
      participants: ['vincent'],
      prescriptions: {
        vincent: { defaultSets: 3, repsMin: 4, repsMax: 5, restMinSeconds: 90, note: 'Objectif initial : 4 à 5 répétitions propres.' },
      },
      demo: { gifFile: 'knee-push-up.gif', tip: 'Corps aligné de la tête aux talons (ou aux genoux), descends jusqu’à effleurer le sol.' },
    },
    {
      exerciseId: 'triceps_pushdown',
      name: 'Extension triceps à la poulie',
      trackingMode: 'strength',
      participants: ['vincent', 'axelle'],
      prescriptions: {
        vincent: { defaultSets: 2, repsMin: 10, repsMax: 15, rirMin: 2, rirMax: 3, restMinSeconds: 60, restMaxSeconds: 90 },
        axelle: { defaultSets: 1, repsMin: 10, repsMax: 15, restMinSeconds: 60, restMaxSeconds: 90, optional: true, note: '1 à 2 séries facultatives — ajoute une série si tu le souhaites.' },
      },
      demo: { gifFile: 'triceps-pushdown.gif', youtube: 'https://www.youtube.com/watch?v=2-LAMcpzODU', tip: 'Coudes fixes le long du corps, pousse jusqu’à l’extension complète.' },
    },
    {
      exerciseId: 'cardio_b',
      name: 'Cardio',
      trackingMode: 'cardio',
      participants: ['vincent', 'axelle'],
      prescriptions: {
        vincent: { defaultSets: 1, durationMinMinutes: 20, durationMaxMinutes: 25, intensity: 'Modérée', note: 'Marche inclinée ou vélo' },
        axelle: { defaultSets: 1, durationMinMinutes: 5, durationMaxMinutes: 10, intensity: 'Facile à modérée', note: 'Marche inclinée ou elliptique — facultatif', optional: true },
      },
    },
  ],

  c: [
    {
      exerciseId: 'leg_press',
      name: 'Presse à cuisses',
      trackingMode: 'strength',
      participants: ['vincent'],
      prescriptions: {
        vincent: { defaultSets: 3, repsMin: 10, repsMax: 15, rirMin: 2, rirMax: 3, restMinSeconds: 120 },
      },
      demo: { gifFile: 'leg-press.gif', youtube: 'https://www.youtube.com/watch?v=IZxyjW7MPJQ', tip: 'Pieds hauts = fessiers/ischio, pieds bas = quadriceps. Ne verrouille pas les genoux.' },
    },
    {
      exerciseId: 'bench_press',
      name: 'Développé couché',
      trackingMode: 'strength',
      participants: ['vincent'],
      prescriptions: {
        vincent: { defaultSets: 3, repsMin: 6, repsMax: 10, rirMin: 2, rirMax: 3, restMinSeconds: 120 },
      },
      demo: { gifFile: 'bench-press.gif', youtube: 'https://www.youtube.com/watch?v=rT7DgCr-3pg', tip: 'Omoplates serrées, descends la barre jusqu’à effleurer la poitrine, coudes à 45°.' },
    },
    {
      exerciseId: 'assisted_pull_up',
      name: 'Tractions assistées',
      trackingMode: 'assisted',
      participants: ['vincent'],
      prescriptions: {
        vincent: { defaultSets: 3, repsMin: 6, repsMax: 10, rirMin: 2, rirMax: 3, restMinSeconds: 120, note: 'La charge saisie correspond au niveau d’assistance (kg), pas à une charge soulevée.' },
      },
      demo: { gifFile: 'pull-up.gif', youtube: 'https://www.youtube.com/watch?v=eGo4IYlbE5g', tip: 'Tire les coudes vers les hanches, pas les épaules vers les oreilles.' },
    },
    {
      exerciseId: 'romanian_deadlift_db',
      name: 'Soulevé de terre roumain avec haltères',
      trackingMode: 'strength',
      participants: ['vincent'],
      prescriptions: {
        vincent: { defaultSets: 3, repsMin: 8, repsMax: 12, rirMin: 2, rirMax: 3, restMinSeconds: 120 },
      },
    },
    {
      exerciseId: 'rowing_barbell',
      name: 'Rowing',
      trackingMode: 'strength',
      participants: ['vincent'],
      prescriptions: {
        vincent: { defaultSets: 2, repsMin: 10, repsMax: 15, rirMin: 2, rirMax: 3, restMinSeconds: 90 },
      },
      demo: { gifFile: 'barbell-row.webp', youtube: 'https://www.youtube.com/watch?v=roCP6wCXPqo', tip: 'Dos plat, tire le coude vers le plafond, contracte l’omoplate en fin de mouvement.' },
    },
    {
      exerciseId: 'lateral_raise',
      name: 'Élévations latérales',
      trackingMode: 'strength',
      participants: ['vincent'],
      prescriptions: {
        vincent: { defaultSets: 2, repsMin: 12, repsMax: 20, rirMin: 2, rirMax: 3, restMinSeconds: 60, restMaxSeconds: 90 },
      },
      demo: { gifFile: 'lateral-raise.gif', youtube: 'https://www.youtube.com/watch?v=3VcKaXpzqRo', tip: 'Légère flexion des coudes, monte jusqu’à l’horizontale, contrôle la descente.' },
    },
    {
      exerciseId: 'push_up',
      name: 'Pompes',
      trackingMode: 'bodyweight',
      participants: ['vincent'],
      prescriptions: {
        vincent: { defaultSets: 2, restMinSeconds: 90, note: 'Séries sous-maximales propres — arrête avant la dégradation technique.' },
      },
      demo: { gifFile: 'knee-push-up.gif', tip: 'Corps aligné de la tête aux talons (ou aux genoux), descends jusqu’à effleurer le sol.' },
    },
    {
      exerciseId: 'cardio_c',
      name: 'Cardio (facultatif)',
      trackingMode: 'cardio',
      participants: ['vincent'],
      prescriptions: {
        vincent: { defaultSets: 1, durationMinMinutes: 10, durationMaxMinutes: 15, intensity: 'Facile à modérée', note: 'Marche inclinée ou vélo', optional: true },
      },
    },
  ],
}

/** Rôles autorisés à démarrer chaque type de séance. */
export const SESSION_PARTICIPANTS: Record<NewSessionType, ProgramRole[]> = {
  a: ['vincent', 'axelle'],
  b: ['vincent', 'axelle'],
  c: ['vincent'],
}

export function isSessionAllowedForRole(session: NewSessionType, role: ProgramRole): boolean {
  return SESSION_PARTICIPANTS[session].includes(role)
}

export function getExercisesForRole(session: NewSessionType, role: ProgramRole): Exercise[] {
  return PROGRAMS[session].filter(ex => ex.participants.includes(role) && ex.prescriptions[role])
}

export const SESSION_LABELS: Record<NewSessionType, string> = {
  a: 'Séance A',
  b: 'Séance B',
  c: 'Séance C',
}

export const LEGACY_SESSION_LABELS: Record<LegacySessionType, string> = {
  push: 'Push (ancien programme)',
  pull: 'Pull (ancien programme)',
  legs: 'Legs (ancien programme)',
}

export const SESSION_COLORS: Record<NewSessionType, { bg: string; text: string; border: string }> = {
  a: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300' },
  b: { bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-300' },
  c: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
}

export const LEGACY_SESSION_COLORS: Record<LegacySessionType, { bg: string; text: string; border: string }> = {
  push: { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-300' },
  pull: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-300' },
  legs: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-300' },
}

export function getSessionLabel(type: AnySessionType): string {
  if (isNewSessionType(type)) return SESSION_LABELS[type]
  return LEGACY_SESSION_LABELS[type]
}

export function getSessionColors(type: AnySessionType) {
  if (isNewSessionType(type)) return SESSION_COLORS[type]
  return LEGACY_SESSION_COLORS[type]
}

/** Durée indicative affichée sur le dashboard — purement informative. */
export const SESSION_ESTIMATED_DURATION: Record<NewSessionType, string> = {
  a: 'environ 1h15 à 1h30',
  b: 'environ 1h10 à 1h25',
  c: 'environ 1h à 1h25',
}
