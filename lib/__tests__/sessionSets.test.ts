import { describe, it, expect } from 'vitest'
import {
  emptyLocalSet, mergeDefaultAndSavedSets, hydrateNewSessionSets,
  persistSetAndSyncTotals, createSetSaveQueue, SetIdentity, SetPayload,
  applyToggleDone, applyFieldUpdate, applyConfirmedSet, parseNumberOrNull, parseIntOrNull,
  SetsState, LocalSet,
} from '../sessionSets'
import { computeSessionTotals, SessionTotals } from '../sessionLogic'

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

  it('e. totals only reflect confirmed (successfully saved) sets, never a local edit whose save failed', async () => {
    // Reproduit exactement le scénario de l'audit : la série A est sauvegardée
    // avec succès, la série B est modifiée localement mais sa sauvegarde
    // échoue. computeTotals lit uniquement `confirmed` (jamais l'état local
    // optimiste `optimistic`), et `confirmed` n'est mis à jour que par
    // onSaveSuccess — jamais lorsque saveSetFn échoue.
    const totalsCalls: SessionTotals[] = []
    let confirmed: SetsState = { ex1: [emptyLocalSet(), emptyLocalSet()] }
    const optimisticA: LocalSet = { done: true, primary: '80', secondary: '8', saveState: 'idle' }
    const optimisticB: LocalSet = { done: true, primary: '90', secondary: '6', saveState: 'idle' }

    const computeTotalsFromConfirmed = (): SessionTotals => computeSessionTotals([{
      trackingMode: 'strength',
      optional: false,
      sets: confirmed.ex1.map(s => ({ done: s.done, weightKg: parseNumberOrNull(s.primary), reps: parseIntOrNull(s.secondary) })),
    }])

    const depsFor = (setIdx: number, snapshot: LocalSet, shouldFail: boolean) => ({
      ensureSessionId: async () => 'session-1',
      getSessionId: () => 'session-1',
      saveSetFn: async () => (shouldFail ? { error: 'network down' } : { error: null }),
      updateTotalsFn: async (_id: string, totals: SessionTotals) => { totalsCalls.push(totals); return { error: null } },
      computeTotals: computeTotalsFromConfirmed,
      onSaveSuccess: () => { confirmed = applyConfirmedSet(confirmed, 'ex1', setIdx, snapshot) },
      saveQueue: createSetSaveQueue(),
      totalsQueue: createSetSaveQueue(),
    })

    // Série A : sauvegarde réussie.
    const resultA = await persistSetAndSyncTotals('ex1:0', identity(0), payload, depsFor(0, optimisticA, false))
    expect(resultA.error).toBeNull()
    await resultA.totalsPromise

    // Série B : modifiée localement mais la sauvegarde échoue.
    const resultB = await persistSetAndSyncTotals('ex1:1', identity(1), payload, depsFor(1, optimisticB, true))
    expect(resultB.error).toBe('network down')
    expect(resultB.totalsPromise).toBeUndefined()

    // Un seul push de totaux (celui de A) ; B n'a jamais atteint computeTotals.
    expect(totalsCalls).toHaveLength(1)
    expect(totalsCalls[0]).toEqual({ setsTotal: 2, setsDone: 1, totalVolume: 640 })
    // B n'a jamais été marquée confirmée malgré la modification locale.
    expect(confirmed.ex1[1]).toEqual(emptyLocalSet())
  })
})

describe('applyToggleDone / applyFieldUpdate', () => {
  it('applyToggleDone flips done and returns the exact snapshot written into `next`', () => {
    const data: SetsState = { ex1: [{ done: false, primary: '80', secondary: '8', saveState: 'idle' }] }
    const { next, snapshot } = applyToggleDone(data, 'ex1', 0)
    expect(snapshot).toEqual({ done: true, primary: '80', secondary: '8', saveState: 'idle' })
    expect(next.ex1[0]).toBe(snapshot)
    expect(data.ex1[0].done).toBe(false) // l'état d'origine n'est jamais muté
  })

  it('applyFieldUpdate updates only the targeted field and returns the exact snapshot written into `next`', () => {
    const data: SetsState = { ex1: [{ done: true, primary: '80', secondary: '8', saveState: 'idle' }] }
    const { next, snapshot } = applyFieldUpdate(data, 'ex1', 0, 'secondary', '10')
    expect(snapshot).toEqual({ done: true, primary: '80', secondary: '10', saveState: 'idle' })
    expect(next.ex1[0]).toBe(snapshot)
  })

  it('returns snapshot: null and the same state when the targeted set does not exist', () => {
    const data: SetsState = { ex1: [] }
    expect(applyToggleDone(data, 'ex1', 0)).toEqual({ next: data, snapshot: null })
    expect(applyFieldUpdate(data, 'ex1', 0, 'primary', '10')).toEqual({ next: data, snapshot: null })
  })

  it('a modification triggers persistSet immediately with the correct snapshot, with no dependency on React setState timing', () => {
    // Reproduit la logique de app/session/[type]/page.tsx : exDataRef.current
    // est la source synchrone, updateExData l'applique et le renvoie tout de
    // suite, et l'appelant (l'équivalent de toggleDone) lit ce retour — jamais
    // une variable renseignée par un callback de setState React, dont
    // l'exécution synchrone n'est pas garantie.
    const exDataRef = { current: { ex1: [{ done: false, primary: '80', secondary: '8', saveState: 'idle' as const }] } }
    const persisted: { key: string; setIdx: number; snapshot: LocalSet }[] = []

    function updateExData(updater: (prev: SetsState) => SetsState): SetsState {
      const next = updater(exDataRef.current)
      exDataRef.current = next
      return next
    }

    function persistSet(key: string, setIdx: number, snapshot: LocalSet) {
      persisted.push({ key, setIdx, snapshot })
    }

    function toggleDone(key: string, setIdx: number) {
      const next = updateExData(prev => applyToggleDone(prev, key, setIdx).next)
      const snapshot = next[key]?.[setIdx] ?? null
      if (snapshot) persistSet(key, setIdx, snapshot)
    }

    toggleDone('ex1', 0)

    // Synchrone : persistSet a déjà été appelé, avant même de sortir de
    // toggleDone, avec exactement le nouvel état écrit dans exDataRef.
    expect(persisted).toHaveLength(1)
    expect(persisted[0]).toEqual({ key: 'ex1', setIdx: 0, snapshot: { done: true, primary: '80', secondary: '8', saveState: 'idle' } })
    expect(exDataRef.current.ex1[0].done).toBe(true)
  })
})

describe('applyConfirmedSet', () => {
  it('writes the snapshot at the given index without touching other sets', () => {
    const data: SetsState = { ex1: [emptyLocalSet(), emptyLocalSet()] }
    const snapshot: LocalSet = { done: true, primary: '100', secondary: '5', saveState: 'idle' }
    const next = applyConfirmedSet(data, 'ex1', 0, snapshot)
    expect(next.ex1[0]).toBe(snapshot)
    expect(next.ex1[1]).toEqual(emptyLocalSet())
    expect(data.ex1[0]).toEqual(emptyLocalSet()) // pas de mutation de l'original
  })

  it('extends the array with empty sets when confirming an index beyond its current length', () => {
    const data: SetsState = { ex1: [] }
    const snapshot: LocalSet = { done: true, primary: '50', secondary: '10', saveState: 'idle' }
    const next = applyConfirmedSet(data, 'ex1', 2, snapshot)
    expect(next.ex1).toHaveLength(3)
    expect(next.ex1[0]).toEqual(emptyLocalSet())
    expect(next.ex1[1]).toEqual(emptyLocalSet())
    expect(next.ex1[2]).toBe(snapshot)
  })
})
