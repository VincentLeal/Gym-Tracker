import { SaveState } from '@/lib/sessionSets'

interface Props {
  state: SaveState
  onRetry?: () => void
}

export default function SaveStatus({ state, onRetry }: Props) {
  if (state === 'saving') return <span className="text-orange-400 text-xs whitespace-nowrap">Sauvegarde…</span>
  if (state === 'saved') return <span className="text-teal-500 text-xs whitespace-nowrap">✓ Sauvegardé</span>
  if (state === 'error') {
    return (
      <span className="text-red-500 text-xs whitespace-nowrap flex items-center gap-1.5">
        Erreur de sauvegarde
        {onRetry && (
          <button onClick={onRetry} className="underline font-medium hover:text-red-600">
            Réessayer
          </button>
        )}
      </span>
    )
  }
  return null
}
