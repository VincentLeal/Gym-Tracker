'use client'
import { useState } from 'react'
import ExerciseDemo from './ExerciseDemo'
import SetRow, { SetFieldConfig } from './SetRow'
import { SaveState } from '@/lib/sessionSets'

export interface ExerciseCardSet {
  done: boolean
  primary: string
  secondary: string
  saveState: SaveState
}

interface Props {
  name: string
  metaLine?: string
  note?: string
  badge?: string
  fieldLabels: { primary: string; secondary: string } | null
  fieldTypes?: { primary: 'number' | 'text'; secondary: 'number' | 'text' }
  demo?: { gifFile?: string; youtube?: string; tip?: string }
  sets: ExerciseCardSet[]
  onChangePrimary: (setIdx: number, value: string) => void
  onChangeSecondary: (setIdx: number, value: string) => void
  onToggleDone: (setIdx: number) => void
  onCopyToNext: (setIdx: number) => void
  onAddSet: () => void
  onRetry: (setIdx: number) => void
  onOpenHistory?: () => void
}

export default function ExerciseCard({
  name, metaLine, note, badge, fieldLabels, fieldTypes, demo, sets,
  onChangePrimary, onChangeSecondary, onToggleDone, onCopyToNext, onAddSet, onRetry, onOpenHistory,
}: Props) {
  const [showRirHelp, setShowRirHelp] = useState(false)
  const hasRir = metaLine?.includes('RIR')

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="flex items-start gap-2 px-4 pt-4 pb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{name}</span>
            {badge && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">{badge}</span>
            )}
          </div>
          {metaLine && (
            <p className="text-xs text-gray-400 mt-0.5">
              {metaLine}
              {hasRir && (
                <button onClick={() => setShowRirHelp(v => !v)} className="ml-1 text-gray-300 hover:text-gray-500 underline decoration-dotted">
                  RIR ?
                </button>
              )}
            </p>
          )}
          {showRirHelp && (
            <p className="text-xs text-teal-600 mt-0.5">RIR = répétitions qu&apos;il resterait possible de faire avant l&apos;échec.</p>
          )}
          {note && <p className="text-xs text-gray-400 italic mt-0.5">{note}</p>}
        </div>
        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            title="Voir l'historique"
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-300 hover:text-teal-500 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
        {demo && (demo.gifFile || demo.youtube) && (
          <ExerciseDemo name={name} gifFile={demo.gifFile} youtube={demo.youtube} tip={demo.tip} />
        )}
      </div>

      {fieldLabels && (
        <div className="px-4 pb-1">
          <div className="grid grid-cols-12 text-xs text-gray-400 font-medium mb-1.5 px-1">
            <div className="col-span-2">#</div>
            {fieldLabels.primary && <div className="col-span-4">{fieldLabels.primary}</div>}
            <div className={fieldLabels.primary ? 'col-span-4' : 'col-span-8'}>{fieldLabels.secondary}</div>
            <div className="col-span-2 text-right">✓</div>
          </div>
          <div className="space-y-1.5">
            {sets.map((s, setIdx) => {
              const fieldA: SetFieldConfig | null = fieldLabels.primary
                ? { label: fieldLabels.primary, value: s.primary, onChange: v => onChangePrimary(setIdx, v), type: fieldTypes?.primary ?? 'number' }
                : null
              const fieldB: SetFieldConfig = {
                label: fieldLabels.secondary, value: s.secondary, onChange: v => onChangeSecondary(setIdx, v), type: fieldTypes?.secondary ?? 'number',
              }
              const showCopy = s.done && setIdx + 1 < sets.length && !sets[setIdx + 1].done
              return (
                <SetRow
                  key={setIdx}
                  index={setIdx}
                  done={s.done}
                  fieldA={fieldA}
                  fieldB={fieldB}
                  onToggleDone={() => onToggleDone(setIdx)}
                  showCopyButton={showCopy}
                  onCopy={() => onCopyToNext(setIdx)}
                  saveState={s.saveState}
                  onRetry={() => onRetry(setIdx)}
                />
              )
            })}
          </div>
        </div>
      )}

      <div className="px-4 pb-4 pt-2">
        <button
          onClick={onAddSet}
          className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
        >
          + Ajouter une série
        </button>
      </div>
    </div>
  )
}
