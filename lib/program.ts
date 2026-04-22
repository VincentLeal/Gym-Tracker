export type SessionType = 'push' | 'pull' | 'legs'

export interface Exercise {
  name: string
  targetMe: string
  targetHer: string
  defaultSets: number
}

export const PROGRAMS: Record<SessionType, Exercise[]> = {
  push: [
    { name: 'Développé couché', targetMe: '4×8-10', targetHer: '3×12-15', defaultSets: 4 },
    { name: 'Développé incliné haltères', targetMe: '3×10', targetHer: '3×12', defaultSets: 3 },
    { name: 'Élévations latérales', targetMe: '3×15', targetHer: '3×15', defaultSets: 3 },
    { name: 'Développé militaire', targetMe: '3×10', targetHer: '3×12', defaultSets: 3 },
    { name: 'Dips / Push-down triceps', targetMe: '3×10', targetHer: '3×15', defaultSets: 3 },
  ],
  pull: [
    { name: 'Tractions / Tirage vertical', targetMe: '4×6-8', targetHer: '3×12', defaultSets: 4 },
    { name: 'Rowing barre / haltère', targetMe: '4×8', targetHer: '3×12', defaultSets: 3 },
    { name: 'Tirage horizontal poulie', targetMe: '3×12-15', targetHer: '3×12-15', defaultSets: 3 },
    { name: 'Face pull', targetMe: '3×15', targetHer: '3×15', defaultSets: 3 },
    { name: 'Curl biceps haltères', targetMe: '3×12', targetHer: '3×12', defaultSets: 3 },
  ],
  legs: [
    { name: 'Squat', targetMe: '4×8-10', targetHer: '3×12-15', defaultSets: 4 },
    { name: 'Presse à cuisses', targetMe: '3×12', targetHer: '3×12', defaultSets: 3 },
    { name: 'Hip thrust', targetMe: '3×15', targetHer: '3×15', defaultSets: 3 },
    { name: 'Leg curl couché', targetMe: '3×12', targetHer: '3×12', defaultSets: 3 },
    { name: 'Planche + Crunch câble', targetMe: '3×45s / 3×15', targetHer: '3×45s / 3×15', defaultSets: 3 },
  ],
}

export const SESSION_LABELS: Record<SessionType, string> = {
  push: 'Push — Pecto / Épaules / Triceps',
  pull: 'Pull — Dos / Biceps',
  legs: 'Legs — Jambes / Fessiers / Abdos',
}

export const SESSION_COLORS: Record<SessionType, { bg: string; text: string; border: string }> = {
  push:  { bg: 'bg-teal-50',   text: 'text-teal-800',   border: 'border-teal-300' },
  pull:  { bg: 'bg-blue-50',   text: 'text-blue-800',   border: 'border-blue-300' },
  legs:  { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-300' },
}
