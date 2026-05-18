export type SessionType = 'push' | 'pull' | 'legs'
export type ProfileType = 'male' | 'female'
export type ExerciseKind = 'together' | 'hiit' | 'solo'

export interface Exercise {
  name: string
  kind: ExerciseKind
  target: Partial<Record<ProfileType, string>>
  defaultSets: Partial<Record<ProfileType, number>>
  notes?: Partial<Record<ProfileType, string>>
  demo: {
    gifFile: string
    youtube: string
    tip: string
  }
}

export const PROGRAMS: Record<SessionType, Exercise[]> = {
  push: [
    {
      name: 'Développé couché barre',
      kind: 'solo',
      target: { male: '4×8-10' },
      defaultSets: { male: 4 },
      notes: { male: 'Omoplates serrées, barre effleure la poitrine' },
      demo: { gifFile: 'bench-press.gif', youtube: 'https://www.youtube.com/watch?v=rT7DgCr-3pg', tip: 'Omoplates serrées, descends la barre jusqu\'à effleurer la poitrine, coudes à 45°.' },
    },
    {
      name: 'Rameur — HIIT',
      kind: 'hiit',
      target: { female: '5×30"/30"' },
      defaultSets: { female: 5 },
      notes: { female: 'Pendant le développé couché de Vincent — 30s effort / 30s repos' },
      demo: { gifFile: 'rowing-machine.gif', youtube: 'https://www.youtube.com/watch?v=H0r_HMEo4y8', tip: 'Pousse avec les jambes d\'abord, puis tire avec les bras. Dos droit tout au long.' },
    },
    {
      name: 'Développé incliné haltères',
      kind: 'together',
      target: { male: '3×10', female: '3×12' },
      defaultSets: { male: 3, female: 3 },
      demo: { gifFile: 'incline-dumbbell-press.gif', youtube: 'https://www.youtube.com/watch?v=8iPEnn-ltC8', tip: 'Banc à 30-45°, haltères alignés avec le milieu de la poitrine.' },
    },
    {
      name: 'Élévations latérales',
      kind: 'together',
      target: { male: '3×15', female: '3×15' },
      defaultSets: { male: 3, female: 3 },
      demo: { gifFile: 'lateral-raise.gif', youtube: 'https://www.youtube.com/watch?v=3VcKaXpzqRo', tip: 'Légère flexion des coudes, monte jusqu\'à l\'horizontale, contrôle la descente.' },
    },
    {
      name: 'Développé militaire',
      kind: 'together',
      target: { male: '3×10', female: '3×12' },
      defaultSets: { male: 3, female: 3 },
      demo: { gifFile: 'overhead-press.gif', youtube: 'https://www.youtube.com/watch?v=2yjwXTZQDDI', tip: 'Gainage abdominal, pousse verticalement, ne creuse pas le dos.' },
    },
    {
      name: 'Dips',
      kind: 'solo',
      target: { male: '3×10' },
      defaultSets: { male: 3 },
      notes: { male: 'Lester si possible' },
      demo: { gifFile: 'triceps-pushdown.gif', youtube: 'https://www.youtube.com/watch?v=2-LAMcpzODU', tip: 'Corps vertical pour les triceps, légèrement penché pour les pectoraux.' },
    },
    {
      name: 'Tapis — HIIT',
      kind: 'hiit',
      target: { female: '4×40"/20"' },
      defaultSets: { female: 4 },
      notes: { female: 'Pendant les dips de Vincent — 40s effort / 20s repos' },
      demo: { gifFile: 'plank.gif', youtube: 'https://www.youtube.com/watch?v=wQq3ybaLZeA', tip: 'Inclinaison modérée, effort intense sur les 40 secondes, récupère bien les 20s.' },
    },
  ],

  pull: [
    {
      name: 'Tractions / Tirage poulie haute',
      kind: 'together',
      target: { male: '4×6-8', female: '3×12' },
      defaultSets: { male: 4, female: 3 },
      notes: { male: 'Tractions', female: 'Tirage poulie haute machine' },
      demo: { gifFile: 'pull-up.gif', youtube: 'https://www.youtube.com/watch?v=eGo4IYlbE5g', tip: 'Tire les coudes vers les hanches, pas les épaules vers les oreilles.' },
    },
    {
      name: 'Rowing barre',
      kind: 'solo',
      target: { male: '4×8' },
      defaultSets: { male: 4 },
      notes: { male: 'Dos plat, omoplate contractée en fin de mouvement' },
      demo: { gifFile: 'barbell-row.webp', youtube: 'https://www.youtube.com/watch?v=roCP6wCXPqo', tip: 'Dos plat, tire le coude vers le plafond, contracte l\'omoplate en fin de mouvement.' },
    },
    {
      name: 'Rameur — HIIT',
      kind: 'hiit',
      target: { female: '5×30"/30"' },
      defaultSets: { female: 5 },
      notes: { female: 'Pendant le rowing barre de Vincent' },
      demo: { gifFile: 'rowing-machine.gif', youtube: 'https://www.youtube.com/watch?v=H0r_HMEo4y8', tip: 'Pousse avec les jambes d\'abord, puis tire avec les bras. Dos droit tout au long.' },
    },
    {
      name: 'Tirage horizontal poulie',
      kind: 'solo',
      target: { male: '3×12-15' },
      defaultSets: { male: 3 },
      demo: { gifFile: 'seated-cable-row.gif', youtube: 'https://www.youtube.com/watch?v=GZbfZ033f74', tip: 'Reste droit, ramène les coudes derrière le dos, ne te penche pas en arrière.' },
    },
    {
      name: 'Tapis — HIIT',
      kind: 'hiit',
      target: { female: '4×40"/20"' },
      defaultSets: { female: 4 },
      notes: { female: 'Pendant le tirage horizontal de Vincent' },
      demo: { gifFile: 'plank.gif', youtube: 'https://www.youtube.com/watch?v=wQq3ybaLZeA', tip: 'Inclinaison modérée, effort intense sur les 40 secondes, récupère bien les 20s.' },
    },
    {
      name: 'Face pull',
      kind: 'together',
      target: { male: '3×15', female: '3×15' },
      defaultSets: { male: 3, female: 3 },
      demo: { gifFile: 'face-pull.gif', youtube: 'https://www.youtube.com/watch?v=rep-qVOkqgk', tip: 'Poulie haute, tire vers le visage en écartant les coudes.' },
    },
    {
      name: 'Curl biceps haltères',
      kind: 'together',
      target: { male: '3×12', female: '3×12' },
      defaultSets: { male: 3, female: 3 },
      demo: { gifFile: 'bicep-curl.gif', youtube: 'https://www.youtube.com/watch?v=ykJmrZ5v0Oo', tip: 'Coudes fixes, supine la main en montant, descente lente et contrôlée.' },
    },
  ],

  legs: [
    {
      name: 'Squat barre',
      kind: 'solo',
      target: { male: '4×8-10' },
      defaultSets: { male: 4 },
      notes: { male: 'Pieds écartés, genoux dans l\'axe des orteils' },
      demo: { gifFile: 'squat.gif', youtube: 'https://www.youtube.com/watch?v=ultWZbUMPL8', tip: 'Pieds écartés, genoux dans l\'axe des orteils, descends jusqu\'au parallèle.' },
    },
    {
      name: 'Rameur — HIIT',
      kind: 'hiit',
      target: { female: '6×30"/30"' },
      defaultSets: { female: 6 },
      notes: { female: 'Pendant le squat barre de Vincent' },
      demo: { gifFile: 'rowing-machine.gif', youtube: 'https://www.youtube.com/watch?v=H0r_HMEo4y8', tip: 'Pousse avec les jambes d\'abord, puis tire avec les bras. Dos droit tout au long.' },
    },
    {
      name: 'Presse / Goblet squat',
      kind: 'together',
      target: { male: '3×12', female: '3×15' },
      defaultSets: { male: 3, female: 3 },
      notes: { male: 'Presse à cuisses', female: 'Goblet squat avec haltère' },
      demo: { gifFile: 'leg-press.gif', youtube: 'https://www.youtube.com/watch?v=IZxyjW7MPJQ', tip: 'Pieds hauts = fessiers/ischio, pieds bas = quadriceps. Ne verrouille pas les genoux.' },
    },
    {
      name: 'Hip thrust',
      kind: 'together',
      target: { male: '3×15', female: '3×15' },
      defaultSets: { male: 3, female: 3 },
      notes: { female: 'Focus fessiers, amplitude complète' },
      demo: { gifFile: 'hip-thrust.gif', youtube: 'https://www.youtube.com/watch?v=SEdqd1n0cvg', tip: 'Banc sous les omoplates, pousse avec les talons, contracte fort les fessiers en haut.' },
    },
    {
      name: 'Leg curl couché',
      kind: 'together',
      target: { male: '3×12', female: '3×12' },
      defaultSets: { male: 3, female: 3 },
      demo: { gifFile: 'leg-curl.gif', youtube: 'https://www.youtube.com/watch?v=1Tq3QdYUuHs', tip: 'Hanches plaquées sur la machine, remonte les talons vers les fesses, descente lente.' },
    },
    {
      name: 'Planche + Crunch câble',
      kind: 'together',
      target: { male: '3×45"', female: '3×40"' },
      defaultSets: { male: 3, female: 3 },
      demo: { gifFile: 'plank.gif', youtube: 'https://www.youtube.com/watch?v=pSHjTRCQxIw', tip: 'Planche : corps aligné, respire. Crunch câble : contracte le ventre, pas le cou.' },
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

export function getExercisesForProfile(session: SessionType, profile: ProfileType): Exercise[] {
  return PROGRAMS[session].filter(ex => {
    if (ex.kind === 'together') return true
    if (ex.kind === 'solo') return profile === 'male'
    if (ex.kind === 'hiit') return profile === 'female'
    return false
  })
}
