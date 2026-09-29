import { describe, it, expect } from 'vitest'
import {
  isSessionAllowedForRole, getExercisesForRole, resolveProgramRole,
  isLegacySessionType, isNewSessionType, isValidSessionType,
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
