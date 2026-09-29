import { SaveState } from '@/lib/sessionSets'
import SaveStatus from './SaveStatus'

export interface SetFieldConfig {
  label: string
  value: string
  onChange: (value: string) => void
  type: 'number' | 'text'
  placeholder?: string
}

interface Props {
  index: number
  done: boolean
  fieldA: SetFieldConfig | null
  fieldB: SetFieldConfig | null
  onToggleDone: () => void
  showCopyButton: boolean
  onCopy?: () => void
  saveState: SaveState
  onRetry: () => void
}

export default function SetRow({ index, done, fieldA, fieldB, onToggleDone, showCopyButton, onCopy, saveState, onRetry }: Props) {
  const fields = [fieldA, fieldB].filter(Boolean) as SetFieldConfig[]
  const fieldColSpanClass = fields.length === 1 ? 'col-span-8' : 'col-span-4'

  return (
    <div className="rounded-xl px-1 py-1.5 transition-colors">
      <div className={`grid grid-cols-12 items-center gap-1 rounded-xl px-1 py-1.5 transition-colors ${done ? 'bg-teal-50' : 'bg-gray-50'}`}>
        <div className="col-span-2 text-xs text-gray-400 pl-1">{index + 1}</div>
        {fields.map((field, i) => (
          <div key={i} className={fieldColSpanClass}>
            <input
              type={field.type}
              inputMode={field.type === 'number' ? 'decimal' : undefined}
              placeholder={field.placeholder ?? '—'}
              value={field.value}
              onChange={e => field.onChange(e.target.value)}
              className="w-full text-sm bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-300 text-center"
            />
          </div>
        ))}
        <div className="col-span-2 flex items-center justify-end gap-1">
          {showCopyButton && (
            <button
              onClick={onCopy}
              title="Copier vers la série suivante"
              className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}
          <button
            onClick={onToggleDone}
            className={`w-7 h-7 flex items-center justify-center rounded-full border-2 transition-colors ${done ? 'bg-teal-500 border-teal-500 text-white' : 'border-gray-300 text-transparent hover:border-teal-400'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>
      {saveState === 'error' && (
        <div className="px-1 pt-1">
          <SaveStatus state={saveState} onRetry={onRetry} />
        </div>
      )}
    </div>
  )
}
