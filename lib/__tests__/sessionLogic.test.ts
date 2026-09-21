import { describe, it, expect } from 'vitest'
import {
  validateSessionRouteParam, computeSessionTotals, isSessionCompleted,
  getNextRecommendedSession, getLastCompletedNewSession, computeConsecutiveWeeks,
  ExerciseSetsInput,
} from '../sessionLogic'

describe('validateSessionRouteParam', () => {
  it('accepts new session types', () => {
    expect(validateSessionRouteParam('a')).toEqual({ kind: 'new', type: 'a' })
    expect(validateSessionRouteParam('B')).toEqual({ kind: 'new', type: 'b' })
  })

  it('accepts legacy session types for history', () => {
    expect(validateSessionRouteParam('push')).toEqual({ kind: 'legacy', type: 'push' })
    expect(validateSessionRouteParam('legs')).toEqual({ kind: 'legacy', type: 'legs' })
  })

  it('rejects unknown or missing values without throwing', () => {
    expect(validateSessionRouteParam('hiit')).toEqual({ kind: 'invalid' })
    expect(validateSessionRouteParam(undefined)).toEqual({ kind: 'invalid' })
    expect(validateSessionRouteParam(42)).toEqual({ kind: 'invalid' })
  })
})

describe('computeSessionTotals', () => {
  it('only counts volume for completed strength sets with weight and reps', () => {
    const exercises: ExerciseSetsInput[] = [
      { trackingMode: 'strength', optional: false, sets: [{ done: true, weightKg: 100, reps: 5 }, { done: false, weightKg: 100, reps: 5 }] },
      { trackingMode: 'cardio', optional: false, sets: [{ done: true, weightKg: null, reps: null }] },
      { trackingMode: 'bodyweight', optional: false, sets: [{ done: true, weightKg: null, reps: 10 }] },
    ]
    const totals = computeSessionTotals(exercises)
    expect(totals.totalVolume).toBe(500)
    expect(totals.setsTotal).toBe(3)
    expect(totals.setsDone).toBe(2)
  })

  it('excludes cardio entirely from sets_total and sets_done', () => {
    const exercises: ExerciseSetsInput[] = [
      { trackingMode: 'cardio', optional: false, sets: [{ done: true, weightKg: null, reps: null }, { done: false, weightKg: null, reps: null }] },
    ]
    const totals = computeSessionTotals(exercises)
    expect(totals).toEqual({ setsTotal: 0, setsDone: 0, totalVolume: 0 })
  })

  it('excludes an optional set from totals when it is not done, but includes it when done', () => {
    const notDone: ExerciseSetsInput[] = [
      { trackingMode: 'strength', optional: false, sets: [{ done: true, weightKg: 50, reps: 10 }] },
      { trackingMode: 'strength', optional: true, sets: [{ done: false, weightKg: null, reps: null }] },
    ]
    expect(computeSessionTotals(notDone)).toEqual({ setsTotal: 1, setsDone: 1, totalVolume: 500 })

    const done: ExerciseSetsInput[] = [
      { trackingMode: 'strength', optional: false, sets: [{ done: true, weightKg: 50, reps: 10 }] },
      { trackingMode: 'strength', optional: true, sets: [{ done: true, weightKg: 20, reps: 12 }] },
    ]
    expect(computeSessionTotals(done)).toEqual({ setsTotal: 2, setsDone: 2, totalVolume: 740 })
  })

  it('stops contributing to totals once a set is unchecked', () => {
    const checked = computeSessionTotals([{ trackingMode: 'strength', optional: false, sets: [{ done: true, weightKg: 80, reps: 8 }] }])
    const unchecked = computeSessionTotals([{ trackingMode: 'strength', optional: false, sets: [{ done: false, weightKg: 80, reps: 8 }] }])
    expect(checked).toEqual({ setsTotal: 1, setsDone: 1, totalVolume: 640 })
    expect(unchecked).toEqual({ setsTotal: 1, setsDone: 0, totalVolume: 0 })
  })
})

describe('isSessionCompleted', () => {
  it('requires a positive total and sets_done >= sets_total', () => {
    expect(isSessionCompleted(0, 0)).toBe(false)
    expect(isSessionCompleted(3, 2)).toBe(false)
    expect(isSessionCompleted(3, 3)).toBe(true)
  })
})

describe('getNextRecommendedSession', () => {
  it("follows Vincent's A -> B -> C -> A sequence", () => {
    expect(getNextRecommendedSession('vincent', null)).toBe('a')
    expect(getNextRecommendedSession('vincent', 'a')).toBe('b')
    expect(getNextRecommendedSession('vincent', 'b')).toBe('c')
    expect(getNextRecommendedSession('vincent', 'c')).toBe('a')
  })

  it("follows Axelle's A -> B -> A sequence", () => {
    expect(getNextRecommendedSession('axelle', null)).toBe('a')
    expect(getNextRecommendedSession('axelle', 'a')).toBe('b')
    expect(getNextRecommendedSession('axelle', 'b')).toBe('a')
  })
})

describe('getLastCompletedNewSession', () => {
  it('ignores legacy sessions and incomplete sessions', () => {
    const last = getLastCompletedNewSession([
      { sessionType: 'push', sessionDate: '2024-01-10', setsTotal: 5, setsDone: 5 },
      { sessionType: 'a', sessionDate: '2024-01-12', setsTotal: 10, setsDone: 10 },
      { sessionType: 'b', sessionDate: '2024-01-14', setsTotal: 8, setsDone: 4 },
    ])
    expect(last).toBe('a')
  })

  it('returns null when nothing is completed', () => {
    expect(getLastCompletedNewSession([])).toBeNull()
  })
})

describe('computeConsecutiveWeeks', () => {
  const reference = new Date('2024-01-15T00:00:00Z') // Monday, ISO week 2024-W03

  it('counts consecutive ISO weeks with at least one completed session', () => {
    expect(computeConsecutiveWeeks(['2024-01-15', '2024-01-08'], reference)).toBe(2)
  })

  it('does not double-count several sessions within the same ISO week', () => {
    expect(computeConsecutiveWeeks(['2024-01-15', '2024-01-16', '2024-01-08'], reference)).toBe(2)
  })

  it('stops at the first missing week', () => {
    expect(computeConsecutiveWeeks(['2024-01-15'], reference)).toBe(1)
  })

  it('returns 0 when the reference week itself has no session', () => {
    expect(computeConsecutiveWeeks(['2024-01-08'], reference)).toBe(0)
  })

  it('returns 0 for an empty history', () => {
    expect(computeConsecutiveWeeks([], reference)).toBe(0)
  })
})
