import type { Piece } from '../../types'
import { slotColor } from '../../lib/layout/slotLegend'
import { isExpandedLayoutPiece } from '../../lib/layout/expandPieces'

type Props = {
  pieces: Piece[]
  onAdd: (piece: Piece) => void
}

export function UnplacedPieceList({ pieces, onAdd }: Props) {
  if (pieces.length === 0) return null

  return (
    <div className="mb-4">
      <p className="mb-2 text-sm font-medium text-gray-700">未配置（{pieces.length}）</p>
      <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
        {pieces.map((piece) => {
          const slotIndex = isExpandedLayoutPiece(piece) ? piece.slotIndex : 0
          const color = slotColor(slotIndex)
          return (
            <li key={piece.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50 active:bg-gray-100"
                onClick={() => onAdd(piece)}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span className="text-gray-900">{piece.name}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
