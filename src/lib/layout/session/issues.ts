import type { Piece, PlacedPiece, Polygon } from '../../../types'
import { getLayoutPolygon } from '../../geometry/mirror'
import { boundingBox, getPlacedPolygon } from '../../geometry/polygon'
import { anyOverlap } from '../../geometry/overlap'
import { offsetPolygons } from '../../geometry/offset'
import { getPlacedBoundingBox, isFullyOnFabric } from '../../nesting/stackLayout'
import type { LayoutIssues } from './types'

const EMPTY_ISSUES: LayoutIssues = { hasOverlap: false, hasOverflow: false }

export async function computeLayoutIssues(
  pieces: Piece[],
  placedPieces: PlacedPiece[],
  fabricWidthCm: number,
  fabricHeightCm: number,
  cuttingGapCm: number,
): Promise<LayoutIssues> {
  if (placedPieces.length === 0) return EMPTY_ISSUES

  const pieceMap = new Map(pieces.map((p) => [p.id, p]))
  const vertices: Polygon[] = []
  const orderedPlaced: PlacedPiece[] = []

  for (const placed of placedPieces) {
    const piece = pieceMap.get(placed.instanceKey)
    if (!piece) continue
    vertices.push(getLayoutPolygon(piece))
    orderedPlaced.push(placed)
  }

  if (vertices.length === 0) return EMPTY_ISSUES

  const offsetVerts = await offsetPolygons(vertices, cuttingGapCm)
  const gappedPolys = orderedPlaced.map((placed, i) =>
    getPlacedPolygon(offsetVerts[i], placed.x, placed.y, placed.rotation),
  )

  let hasOverflow = false
  for (let i = 0; i < orderedPlaced.length; i++) {
    const piece = pieceMap.get(orderedPlaced[i].instanceKey)!
    const rawBox = getPlacedBoundingBox(orderedPlaced[i], piece)
    if (!isFullyOnFabric(rawBox, fabricWidthCm, fabricHeightCm)) {
      hasOverflow = true
      break
    }
    const gappedBox = boundingBox(gappedPolys[i])
    if (!isFullyOnFabric(gappedBox, fabricWidthCm, fabricHeightCm)) {
      hasOverflow = true
      break
    }
  }

  return {
    hasOverlap: anyOverlap(gappedPolys),
    hasOverflow,
  }
}
