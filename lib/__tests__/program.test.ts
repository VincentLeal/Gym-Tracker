import { describe, it, expect } from 'vitest'
import {
  isSessionAllowedForRole, getExercisesForRole, resolveProgramRole,
  isLegacySessionType, isNewSessionType, isValidSessionType, findExerciseDefinition,
} from '../program'

describe('isSessionAllowedForRole', () => {
  it('allows Vincent to start A, B and C', () => {
    expect(isSessionAllowedForRole('a', 'vincent')).toBe(true)
    expect(isSessionAllowedForRole('b', 'vincent')).toBe(true)
    expect(isSessionAllowedForRole('c', 'vincent')).toBe(true)
  })

  it('allows Axelle to start A and B but not C', () => {
    expect(isSessionAllowedForRole('a', 'axelle')).toBe(true)
    expect(isSessionAllowedForRole('b', 'axelle')).toBe(true)
    expect(isSessionAllowedForRole('c', 'axelle')).toBe(false)
  })
})

describe('getExercisesForRole', () => {
  it('returns no exercises for Axelle on session C (Vincent-only session)', () => {
    expect(getExercisesForRole('c', 'axelle')).toEqual([])
  })

  it('returns exercises with a prescription for the requested role only', () => {
    const forVincent = getExercisesForRole('a', 'vincent')
    const forAxelle = getExercisesForRole('a', 'axelle')
    expect(forVincent.every(ex => !!ex.prescriptions.vincent)).toBe(true)
    expect(forAxelle.every(ex => !!ex.prescriptions.axelle)).toBe(true)
    // Tractions assistées est réservé à Vincent dans la séance A.
    expect(forVincent.some(ex => ex.exerciseId === 'assisted_pull_up')).toBe(true)
    expect(forAxelle.some(ex => ex.exerciseId === 'assisted_pull_up')).toBe(false)
  })
})

describe('program content per participant', () => {
  const ids = (session: 'a' | 'b' | 'c', role: 'vincent' | 'axelle') => getExercisesForRole(session, role).map(ex => ex.exerciseId)

  it('Vincent A: no lat pulldown, assisted pull-ups in 3rd position', () => {
    expect(ids('a', 'vincent')).toEqual(['leg_press', 'chest_press_machine', 'assisted_pull_up', 'leg_curl', 'biceps_curl', 'cardio_a'])
    const pullUp = getExercisesForRole('a', 'vincent')[2].prescriptions.vincent!
    expect(pullUp).toMatchObject({ defaultSets: 3, repsMin: 6, repsMax: 10, rirMin: 2, rirMax: 3, restMinSeconds: 90, restMaxSeconds: 120 })
  })

  it('Axelle A: keeps lat pulldown and 2 biceps curl sets', () => {
    expect(ids('a', 'axelle')).toEqual(['leg_press', 'chest_press_machine', 'lat_pulldown', 'leg_curl', 'biceps_curl', 'cardio_a'])
    expect(getExercisesForRole('a', 'axelle').find(ex => ex.exerciseId === 'biceps_curl')!.prescriptions.axelle!.defaultSets).toBe(2)
  })

  it('Vincent B: push-ups right after hip thrust and seated row', () => {
    expect(ids('b', 'vincent')).toEqual(['hip_thrust', 'seated_row', 'push_up', 'incline_db_press', 'leg_extension', 'triceps_pushdown', 'cardio_b'])
    expect(getExercisesForRole('b', 'vincent')[2].prescriptions.vincent).toMatchObject({ defaultSets: 3, repsMin: 4, repsMax: 5, restMinSeconds: 90 })
  })

  it('Axelle B: no push-ups, 2 triceps sets, leg extension kept as knee-conditional', () => {
    expect(ids('b', 'axelle')).toEqual(['hip_thrust', 'seated_row', 'incline_db_press', 'leg_extension', 'triceps_pushdown', 'cardio_b'])
    const b = getExercisesForRole('b', 'axelle')
    expect(b.find(ex => ex.exerciseId === 'triceps_pushdown')!.prescriptions.axelle!.defaultSets).toBe(2)
    expect(b.find(ex => ex.exerciseId === 'leg_extension')!.prescriptions.axelle!.note).toContain('genoux')
  })

  it('keeps cardio prescriptions unchanged', () => {
    expect(getExercisesForRole('a', 'vincent').at(-1)!.prescriptions.vincent).toMatchObject({ durationMinMinutes: 20, durationMaxMinutes: 25 })
    expect(getExercisesForRole('b', 'axelle').at(-1)!.prescriptions.axelle).toMatchObject({ durationMinMinutes: 5, durationMaxMinutes: 10, optional: true })
    expect(getExercisesForRole('c', 'vincent').at(-1)!.prescriptions.vincent).toMatchObject({ durationMinMinutes: 10, durationMaxMinutes: 15, optional: true })
  })

  it('still finds the definition of an exercise removed from a participant program', () => {
    expect(findExerciseDefinition('lat_pulldown', 'a')?.name).toBe('Tirage vertical')
    expect(findExerciseDefinition('unknown')).toBeUndefined()
  })
})

describe('resolveProgramRole', () => {
  it('prioritizes program_role over the legacy profile_type', () => {
    expect(resolveProgramRole({ program_role: 'axelle', profile_type: 'male' })).toBe('axelle')
  })

  it('falls back to profile_type when program_role is missing', () => {
    expect(resolveProgramRole({ program_role: null, profile_type: 'female' })).toBe('axelle')
    expect(resolveProgramRole({ program_role: null, profile_type: 'male' })).toBe('vincent')
  })

  it('defaults to vincent when nothing is set', () => {
    expect(resolveProgramRole({ program_role: null, profile_type: null })).toBe('vincent')
    expect(resolveProgramRole(null)).toBe('vincent')
    expect(resolveProgramRole(undefined)).toBe('vincent')
  })
})

describe('legacy session type recognition', () => {
  it('still recognizes push/pull/legs for history purposes', () => {
    expect(isLegacySessionType('push')).toBe(true)
    expect(isLegacySessionType('pull')).toBe(true)
    expect(isLegacySessionType('legs')).toBe(true)
    expect(isNewSessionType('push')).toBe(false)
  })

  it('recognizes a/b/c as the new session types', () => {
    expect(isNewSessionType('a')).toBe(true)
    expect(isNewSessionType('b')).toBe(true)
    expect(isNewSessionType('c')).toBe(true)
  })

  it('rejects unknown session types', () => {
    expect(isValidSessionType('hiit')).toBe(false)
    expect(isValidSessionType('')).toBe(false)
  })
})
