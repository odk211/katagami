import type { Layout, Piece, PlacedPiece } from '../../../types'
import { isValidLayout, sanitizePlacedPieces } from '../../nesting/stackLayout'

export function canRestoreLayout(
  layout: Layout | null | undefined,
  pieces: Piece[],
  fabricWidthCm: number,
  fabricHeightCm: number,
  cuttingGapCm: number,
): layout is Layout {
  if (!layout) return false
  if (layout.fabricWidthCm !== fabricWidthCm) return false
  if (layout.fabricHeightCm !== fabricHeightCm) return false
  if (layout.cuttingGapCm !== cuttingGapCm) return false
  return isValidLayout(pieces, layout.placedPieces)
}

export function initialPlacedPieces(
  savedLayout: Layout | null | undefined,
  pieces: Piece[],
  fabricWidthCm: number,
  fabricHeightCm: number,
  cuttingGapCm: number,
): PlacedPiece[] {
  if (!savedLayout) return []
  const saved = savedLayout.placedPieces
  if (canRestoreLayout(savedLayout, pieces, fabricWidthCm, fabricHeightCm, cuttingGapCm)) {
    return saved
  }
  return sanitizePlacedPieces(saved, pieces)
}
