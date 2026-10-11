import type { FitResult, Piece, PlacedPiece } from '../../../types'
import { getLayoutPolygon } from '../../geometry/mirror'
import { polygonArea } from '../../geometry/polygon'
import { calculateShortage } from '../../nesting/shortage'
import { getPlacedBoundingBox, isFullyOnFabric } from '../../nesting/stackLayout'
import { computeLayoutIssues } from './issues'

export async function evaluateLayoutFit(input: {
  pieces: Piece[]
  placedPieces: PlacedPiece[]
  fabricWidthCm: number
  fabricHeightCm: number
  cuttingGapCm: number
  includeShortage?: boolean
}): Promise<FitResult> {
  const {
    pieces,
    placedPieces,
    fabricWidthCm,
    fabricHeightCm,
    cuttingGapCm,
    includeShortage = false,
  } = input

  const pieceMap = new Map(pieces.map((p) => [p.id, p]))
  const issues = await computeLayoutIssues(
    pieces,
    placedPieces,
    fabricWidthCm,
    fabricHeightCm,
    cuttingGapCm,
  )

  let onFabricArea = 0
  for (const placed of placedPieces) {
    const piece = pieceMap.get(placed.instanceKey)
    if (!piece) continue
    const box = getPlacedBoundingBox(placed, piece)
    if (isFullyOnFabric(box, fabricWidthCm, fabricHeightCm)) {
      onFabricArea += polygonArea(getLayoutPolygon(piece))
    }
  }

  const fabricArea = fabricWidthCm * fabricHeightCm
  const utilizationPercent = fabricArea > 0 ? (onFabricArea / fabricArea) * 100 : 0

  const allPlaced = placedPieces.length === pieces.length
  const fits = allPlaced && !issues.hasOverlap && !issues.hasOverflow

  let shortageWidthCm: number | null = null
  let shortageHeightCm: number | null = null

  if (!fits && includeShortage) {
    const shortage = await calculateShortage(pieces, fabricWidthCm, fabricHeightCm, cuttingGapCm)
    shortageWidthCm = shortage.shortageWidthCm
    shortageHeightCm = shortage.shortageHeightCm
  }

  return {
    fits,
    utilizationPercent,
    hasOverlap: issues.hasOverlap,
    hasOverflow: issues.hasOverflow,
    shortageWidthCm,
    shortageHeightCm,
  }
}
