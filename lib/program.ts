export type SessionType = 'push' | 'pull' | 'legs'
export type ProfileType = 'male' | 'female'

export interface Exercise {
  name: string
  target: Record<ProfileType, string>
  defaultSets: Record<ProfileType, number>
  notes?: Record<ProfileType, string>
}

export const PROGRAMS: Record<SessionType, Exercise[]> = {
  push: [
    {
      name: 'Développé couché',
      target: { male: '4×8-10', female: '3×12-15' },
      defaultSets: { male: 4, female: 3 },
      notes: { male: 'Barre', female: 'Haltères légers ou barre légère' },
    },
    {
      name: 'Développé incliné haltères',
      target: { male: '3×10', female: '3×12' },
      defaultSets: { male: 3, female: 3 },
    },
    {
      name: 'Élévations latérales',
      target: { male: '3×15', female: '3×15' },
      defaultSets: { male: 3, female: 3 },
    },
    {
      name: 'Développé militaire',
      target: { male: '3×10', female: '3×12' },
      defaultSets: { male: 3, female: 3 },
    },
    {
      name: 'Dips / Push-down triceps',
      target: { male: '3×10', female: '3×15' },
      defaultSets: { male: 3, female: 3 },
      notes: { male: 'Dips lestés si possible', female: 'Push-down câble' },
    },
  ],
  pull: [
    {
      name: 'Tractions / Tirage vertical',
      target: { male: '4×6-8', female: '3×12' },
      defaultSets: { male: 4, female: 3 },
      notes: { male: 'Tractions', female: 'Tirage poulie haute machine' },
    },
    {
      name: 'Rowing barre / haltère',
      target: { male: '4×8', female: '3×12' },
      defaultSets: { male: 4, female: 3 },
      notes: { male: 'Rowing barre', female: 'Haltère unilatéral' },
    },
    {
      name: 'Tirage horizontal poulie',
      target: { male: '3×12-15', female: '3×12-15' },
      defaultSets: { male: 3, female: 3 },
    },
    {
      name: 'Face pull',
      target: { male: '3×15', female: '3×15' },
      defaultSets: { male: 3, female: 3 },
    },
    {
      name: 'Curl biceps haltères',
      target: { male: '3×12', female: '3×12' },
      defaultSets: { male: 3, female: 3 },
    },
  ],
  legs: [
    {
      name: 'Squat',
      target: { male: '4×8-10', female: '3×12-15' },
      defaultSets: { male: 4, female: 3 },
      notes: { male: 'Barre', female: 'Goblet squat avec haltère' },
    },
    {
      name: 'Presse à cuisses',
      target: { male: '3×12', female: '3×12' },
      defaultSets: { male: 3, female: 3 },
    },
    {
      name: 'Hip thrust',
      target: { male: '3×15', female: '3×15' },
      defaultSets: { male: 3, female: 3 },
      notes: { male: 'Barre ou haltère', female: 'Focus fessiers, amplitude complète' },
    },
    {
      name: 'Leg curl couché',
      target: { male: '3×12', female: '3×12' },
      defaultSets: { male: 3, female: 3 },
    },
    {
      name: 'Planche + Crunch câble',
      target: { male: '3×45s / 3×15', female: '3×45s / 3×15' },
      defaultSets: { male: 3, female: 3 },
    },
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
