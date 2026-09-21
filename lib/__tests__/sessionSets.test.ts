import { describe, it, expect } from 'vitest'
import {
  emptyLocalSet, mergeDefaultAndSavedSets, hydrateNewSessionSets,
  persistSetAndSyncTotals, createSetSaveQueue, SetIdentity, SetPayload,
} from '../sessionSets'
import { SessionTotals } from '../sessionLogic'

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}

function identity(setIndex: number, exerciseId: string | null = 'ex1'): Omit<SetIdentity, 'sessionId'> {
  return { exerciseIndex: 0, exerciseName: 'Presse à cuisses', exerciseId, setIndex }
}

const payload: SetPayload = { weightKg: 100, reps: 5, durationMinutes: null, resistanceNote: null, completed: true }

describe('mergeDefaultAndSavedSets', () => {
  it('fills saved values in place without dropping the other default sets', () => {
    const defaults = [emptyLocalSet(), emptyLocalSet(), emptyLocalSet()]
    const merged = mergeDefaultAndSavedSets(
      defaults,
      [{ set_index: 0, weight_kg: 80, reps: 8 }],
      row => ({ done: true, primary: String(row.weight_kg), secondary: String(row.reps), saveState: 'idle' })
    )
    expect(merged).toHaveLength(3)
    expect(merged[0]).toEqual({ done: true, primary: '80', secondary: '8', saveState: 'idle' })
    expect(merged[1]).toEqual(emptyLocalSet())
    expect(merged[2]).toEqual(emptyLocalSet())
  })

  it('only extends the array when a saved row has a higher set_index than the defaults', () => {
    const defaults = [emptyLocalSet(), emptyLocalSet()]
    const merged = mergeDefaultAndSavedSets(
      defaults,
      [{ set_index: 2, weight_kg: 50, reps: 5 }],
      row => ({ done: true, primary: String(row.weight_kg), secondary: String(row.reps), saveState: 'idle' })
    )
    expect(merged).toHaveLength(3)
    expect(merged[2].done).toBe(true)
  })
})

describe('hydrateNewSessionSets', () => {
  it('shows all 3 prescribed sets when only set_index 0 was ever saved', () => {
    const specs = [{ key: 'ex1', exerciseId: 'ex1', defaultSets: 3, trackingMode: 'strength' as const }]
    const savedRows = [{ exercise_id: 'ex1', set_index: 0, weight_kg: 80, reps: 8, completed: true }]

    const result = hydrateNewSessionSets(specs, savedRows)

    expect(result.ex1).toHaveLength(3)
    expect(result.ex1[0]).toEqual({ done: true, primary: '80', secondary: '8', saveState: 'idle' })
    expect(result.ex1[1]).toEqual(emptyLocalSet())
    expect(result.ex1[2]).toEqual(emptyLocalSet())
  })

  it('re-hydrates from an empty saved-rows list without losing default sets (brand new session)', () => {
    const specs = [{ key: 'ex1', exerciseId: 'ex1', defaultSets: 3, trackingMode: 'strength' as const }]
    const result = hydrateNewSessionSets(specs, [])
    expect(result.ex1).toHaveLength(3)
    expect(result.ex1.every(s => !s.done)).toBe(true)
  })

  it('attaches saved rows to the correct exercise by exercise_id, even if the exercise order changes', () => {
    const savedRows = [{ exercise_id: 'ex_b', set_index: 0, weight_kg: 42, reps: 10, completed: true }]
    const spec = (key: string) => ({ key, exerciseId: key, defaultSets: 2, trackingMode: 'strength' as const })

    const original = hydrateNewSessionSets([spec('ex_a'), spec('ex_b')], savedRows)
    const shuffled = hydrateNewSessionSets([spec('ex_c'), spec('ex_b'), spec('ex_a')], savedRows)

    expect(original.ex_b[0].primary).toBe('42')
    expect(shuffled.ex_b[0].primary).toBe('42')
    expect(shuffled.ex_a[0].primary).toBe('')
    expect(shuffled.ex_c[0].primary).toBe('')
  })
})

describe('persistSetAndSyncTotals', () => {
  it('a. pushes totals once after the first checked set is saved', async () => {
    const totalsCalls: { sessionId: string; totals: SessionTotals }[] = []
    const deps = {
      ensureSessionId: async () => 'session-1',
      getSessionId: () => 'session-1',
      saveSetFn: async () => ({ error: null }),
      updateTotalsFn: async (sessionId: string, totals: SessionTotals) => { totalsCalls.push({ sessionId, totals }); return { error: null } },
      computeTotals: (): SessionTotals => ({ setsTotal: 3, setsDone: 1, totalVolume: 500 }),
      saveQueue: createSetSaveQueue(),
      totalsQueue: createSetSaveQueue(),
    }

    const result = await persistSetAndSyncTotals('ex1:0', identity(0), payload, deps)
    expect(result.error).toBeNull()
    await result.totalsPromise

    expect(totalsCalls).toEqual([{ sessionId: 'session-1', totals: { setsTotal: 3, setsDone: 1, totalVolume: 500 } }])
  })

  it('b. never lets an older save that resolves late overwrite the totals from a newer one', async () => {
    const saveDeferreds = { set0: deferred<void>(), set1: deferred<void>() }
    const totalsCalls: SessionTotals[] = []
    let doneCount = 0 // état "authoritative" partagé, comme exDataRef côté page

    const deps = {
      ensureSessionId: async () => 'session-1',
      getSessionId: () => 'session-1',
      saveSetFn: async (id: SetIdentity) => {
        await (id.setIndex === 0 ? saveDeferreds.set0.promise : saveDeferreds.set1.promise)
        return { error: null }
      },
      updateTotalsFn: async (_id: string, totals: SessionTotals) => { totalsCalls.push(totals); return { error: null } },
      computeTotals: (): SessionTotals => ({ setsTotal: 2, setsDone: doneCount, totalVolume: doneCount * 100 }),
      saveQueue: createSetSaveQueue(),
      totalsQueue: createSetSaveQueue(),
    }

    // L'utilisateur coche les deux séries très vite : l'état local est mis à jour
    // de façon synchrone avant même que les requêtes réseau ne démarrent.
    doneCount = 1
    const p0 = persistSetAndSyncTotals('ex1:0', identity(0), payload, deps)
    doneCount = 2
    const p1 = persistSetAndSyncTotals('ex1:1', identity(1), payload, deps)

    // Le réseau répond dans le désordre : la requête envoyée en second (set1) revient en premier.
    saveDeferreds.set1.resolve()
    await Promise.resolve()
    saveDeferreds.set0.resolve()

    const [r0, r1] = await Promise.all([p0, p1])
    await Promise.all([r0.totalsPromise, r1.totalsPromise])

    expect(totalsCalls.length).toBeGreaterThan(0)
    expect(totalsCalls.every(t => t.setsDone === 2)).toBe(true)
  })

  it('c. reflects an unchecked set immediately in the next totals push', async () => {
    const totalsCalls: SessionTotals[] = []
    let done = true
    const deps = {
      ensureSessionId: async () => 'session-1',
      getSessionId: () => 'session-1',
      saveSetFn: async () => ({ error: null }),
      updateTotalsFn: async (_id: string, totals: SessionTotals) => { totalsCalls.push(totals); return { error: null } },
      computeTotals: (): SessionTotals => (done ? { setsTotal: 1, setsDone: 1, totalVolume: 640 } : { setsTotal: 1, setsDone: 0, totalVolume: 0 }),
      saveQueue: createSetSaveQueue(),
      totalsQueue: createSetSaveQueue(),
    }

    const checked = await persistSetAndSyncTotals('ex1:0', identity(0), { ...payload, weightKg: 80, reps: 8 }, deps)
    await checked.totalsPromise

    done = false
    const unchecked = await persistSetAndSyncTotals('ex1:0', identity(0), { ...payload, completed: false }, deps)
    await unchecked.totalsPromise

    expect(totalsCalls).toEqual([
      { setsTotal: 1, setsDone: 1, totalVolume: 640 },
      { setsTotal: 1, setsDone: 0, totalVolume: 0 },
    ])
  })

  it('d. does not push any totals when the set save itself fails', async () => {
    const totalsCalls: SessionTotals[] = []
    const deps = {
      ensureSessionId: async () => 'session-1',
      getSessionId: () => 'session-1',
      saveSetFn: async () => ({ error: 'network down' }),
      updateTotalsFn: async (_id: string, totals: SessionTotals) => { totalsCalls.push(totals); return { error: null } },
      computeTotals: (): SessionTotals => ({ setsTotal: 1, setsDone: 1, totalVolume: 100 }),
      saveQueue: createSetSaveQueue(),
      totalsQueue: createSetSaveQueue(),
    }

    const result = await persistSetAndSyncTotals('ex1:0', identity(0), payload, deps)

    expect(result.error).toBe('network down')
    expect(result.totalsPromise).toBeUndefined()
    expect(totalsCalls).toEqual([])
  })
})
