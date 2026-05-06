export type SessionType = 'push' | 'pull' | 'legs'
export type ProfileType = 'male' | 'female'

export interface Exercise {
  name: string
  target: Record<ProfileType, string>
  defaultSets: Record<ProfileType, number>
  notes?: Record<ProfileType, string>
  substituteFor?: ProfileType  // si défini, cet exercice remplace le précédent pour ce profil
  demo: {
    gifFile: string
    youtube: string
    tip: string
  }
}

// GIF IDs from static.exercisedb.dev/media/{id}.gif (free CDN, no auth needed)
export const PROGRAMS: Record<SessionType, Exercise[]> = {
  push: [
    {
      name: 'Développé couché',
      target: { male: '4×8-10', female: '3×12-15' },
      defaultSets: { male: 4, female: 3 },
      notes: { male: 'Barre', female: 'Haltères légers ou barre légère' },
      demo: {
        gifFile: 'bench-press.gif',
        youtube: 'https://www.youtube.com/watch?v=rT7DgCr-3pg',
        tip: 'Omoplates serrées, descends la barre jusqu\'à effleurer la poitrine, coudes à 45°.',
      },
    },
    {
      name: 'Pompes sur genoux',
      substituteFor: 'female',
      target: { male: '4×8-10', female: '3×10-15' },
      defaultSets: { male: 4, female: 3 },
      notes: { female: 'Substitut au développé couché — progresse vers pompes normales puis barre' },
      demo: {
        gifFile: 'knee-push-up.gif',
        youtube: 'https://www.youtube.com/watch?v=jWxvty2KROs',
        tip: 'Genoux au sol, corps aligné des genoux aux épaules, descends la poitrine jusqu\'au sol.',
      },
    },
    {
      name: 'Développé incliné haltères',
      target: { male: '3×10', female: '3×12' },
      defaultSets: { male: 3, female: 3 },
      demo: {
        gifFile: 'incline-dumbbell-press.gif',
        youtube: 'https://www.youtube.com/watch?v=8iPEnn-ltC8',
        tip: 'Banc à 30-45°, haltères alignés avec le milieu de la poitrine, pas les épaules.',
      },
    },
    {
      name: 'Élévations latérales',
      target: { male: '3×15', female: '3×15' },
      defaultSets: { male: 3, female: 3 },
      demo: {
        gifFile: 'lateral-raise.gif',
        youtube: 'https://www.youtube.com/watch?v=3VcKaXpzqRo',
        tip: 'Légère flexion des coudes, monte jusqu\'à l\'horizontale, contrôle la descente.',
      },
    },
    {
      name: 'Développé militaire',
      target: { male: '3×10', female: '3×12' },
      defaultSets: { male: 3, female: 3 },
      demo: {
        gifFile: 'overhead-press.gif',
        youtube: 'https://www.youtube.com/watch?v=2yjwXTZQDDI',
        tip: 'Gainage abdominal, pousse verticalement, ne creuse pas le dos.',
      },
    },
    {
      name: 'Dips / Push-down triceps',
      target: { male: '3×10', female: '3×15' },
      defaultSets: { male: 3, female: 3 },
      notes: { male: 'Dips lestés si possible', female: 'Push-down câble' },
      demo: {
        gifFile: 'triceps-pushdown.gif',
        youtube: 'https://www.youtube.com/watch?v=2-LAMcpzODU',
        tip: 'Coudes fixes le long du corps, extension complète, pince les triceps en bas.',
      },
    },
  ],
  pull: [
    {
      name: 'Tractions / Tirage vertical',
      target: { male: '4×6-8', female: '3×12' },
      defaultSets: { male: 4, female: 3 },
      notes: { male: 'Tractions', female: 'Tirage poulie haute machine' },
      demo: {
        gifFile: 'pull-up.gif',
        youtube: 'https://www.youtube.com/watch?v=eGo4IYlbE5g',
        tip: 'Tire les coudes vers les hanches, pas les épaules vers les oreilles.',
      },
    },
    {
      name: 'Rowing barre / haltère',
      target: { male: '4×8', female: '3×12' },
      defaultSets: { male: 4, female: 3 },
      notes: { male: 'Rowing barre', female: 'Haltère unilatéral' },
      demo: {
        gifFile: 'barbell-row.webp',
        youtube: 'https://www.youtube.com/watch?v=roCP6wCXPqo',
        tip: 'Dos plat, tire le coude vers le plafond, contracte l\'omoplate en fin de mouvement.',
      },
    },
    {
      name: 'Tirage horizontal poulie',
      target: { male: '3×12-15', female: '3×12-15' },
      defaultSets: { male: 3, female: 3 },
      demo: {
        gifFile: 'seated-cable-row.gif',
        youtube: 'https://www.youtube.com/watch?v=GZbfZ033f74',
        tip: 'Reste droit, ramène les coudes derrière le dos, ne te penche pas en arrière.',
      },
    },
    {
      name: 'Face pull',
      target: { male: '3×15', female: '3×15' },
      defaultSets: { male: 3, female: 3 },
      demo: {
        gifFile: 'face-pull.gif',
        youtube: 'https://www.youtube.com/watch?v=rep-qVOkqgk',
        tip: 'Poulie haute, tire vers le visage en écartant les coudes, excellent pour la coiffe.',
      },
    },
    {
      name: 'Curl biceps haltères',
      target: { male: '3×12', female: '3×12' },
      defaultSets: { male: 3, female: 3 },
      demo: {
        gifFile: 'bicep-curl.gif',
        youtube: 'https://www.youtube.com/watch?v=ykJmrZ5v0Oo',
        tip: 'Coudes fixes, supine la main en montant, descente lente et contrôlée.',
      },
    },
  ],
  legs: [
    {
      name: 'Squat',
      target: { male: '4×8-10', female: '3×12-15' },
      defaultSets: { male: 4, female: 3 },
      notes: { male: 'Barre', female: 'Goblet squat avec haltère' },
      demo: {
        gifFile: 'squat.gif',
        youtube: 'https://www.youtube.com/watch?v=ultWZbUMPL8',
        tip: 'Pieds écartés, genoux dans l\'axe des orteils, descends jusqu\'au parallèle.',
      },
    },
    {
      name: 'Presse à cuisses',
      target: { male: '3×12', female: '3×12' },
      defaultSets: { male: 3, female: 3 },
      demo: {
        gifFile: 'leg-press.gif',
        youtube: 'https://www.youtube.com/watch?v=IZxyjW7MPJQ',
        tip: 'Pieds hauts = fessiers/ischio, pieds bas = quadriceps. Ne verrouille pas les genoux.',
      },
    },
    {
      name: 'Hip thrust',
      target: { male: '3×15', female: '3×15' },
      defaultSets: { male: 3, female: 3 },
      notes: { male: 'Barre ou haltère', female: 'Focus fessiers, amplitude complète' },
      demo: {
        gifFile: 'hip-thrust.gif',
        youtube: 'https://www.youtube.com/watch?v=SEdqd1n0cvg',
        tip: 'Banc sous les omoplates, pousse avec les talons, contracte fort les fessiers en haut.',
      },
    },
    {
      name: 'Leg curl couché',
      target: { male: '3×12', female: '3×12' },
      defaultSets: { male: 3, female: 3 },
      demo: {
        gifFile: 'leg-curl.gif',
        youtube: 'https://www.youtube.com/watch?v=1Tq3QdYUuHs',
        tip: 'Hanches plaquées sur la machine, remonte les talons vers les fesses, descente lente.',
      },
    },
    {
      name: 'Planche + Crunch câble',
      target: { male: '3×45s / 3×15', female: '3×45s / 3×15' },
      defaultSets: { male: 3, female: 3 },
      demo: {
        gifFile: 'plank.gif',
        youtube: 'https://www.youtube.com/watch?v=pSHjTRCQxIw',
        tip: 'Planche : corps aligné, respire. Crunch câble : contracte le ventre, pas le cou.',
      },
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
