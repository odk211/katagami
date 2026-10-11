import type { Piece } from '../../types'

export type ExpandedLayoutPiece = Piece & {
  instanceKey: string
  slotIndex: number
  sourcePieceId: string
}

export function expandPatternSlots(
  patternProjectIds: string[],
  piecesByProjectId: Map<string, Piece[]>,
): ExpandedLayoutPiece[] {
  const result: ExpandedLayoutPiece[] = []
  patternProjectIds.forEach((patternProjectId, slotIndex) => {
    const pieces = piecesByProjectId.get(patternProjectId) ?? []
    for (const piece of pieces) {
      const instanceKey = `${slotIndex}:${piece.id}`
      result.push({
        ...piece,
        id: instanceKey,
        instanceKey,
        slotIndex,
        sourcePieceId: piece.id,
      })
    }
  })
  return result
}

export function isExpandedLayoutPiece(piece: Piece): piece is ExpandedLayoutPiece {
  return 'instanceKey' in piece && 'sourcePieceId' in piece
}
