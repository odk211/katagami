import type { Piece, PlacedPiece, Polygon } from '../../types'
import { getLayoutPolygon } from '../geometry/mirror'
import { boundingBox, getPlacedPolygon, normalizePolygon } from '../geometry/polygon'
import { polygonsOverlap } from '../geometry/overlap'
import { offsetPolygon, offsetPolygons } from '../geometry/offset'
import { isExpandedLayoutPiece } from '../layout/expandPieces'

const POSITION_STEP_CM = 1

export function createPlacedPiece(
  piece: Piece,
  x: number,
  y: number,
  rotation = 0,
): PlacedPiece {
  return {
    instanceKey: piece.id,
    pieceId: isExpandedLayoutPiece(piece) ? piece.sourcePieceId : piece.id,
    slotIndex: isExpandedLayoutPiece(piece) ? piece.slotIndex : 0,
    x,
    y,
    rotation,
  }
}

export function getPlacedBoundingBox(placed: PlacedPiece, piece: Piece) {
  const polygon = getPlacedPolygon(
    getLayoutPolygon(piece),
    placed.x,
    placed.y,
    placed.rotation,
  )
  return boundingBox(polygon)
}

export function getPlacedPolygonForPiece(placed: PlacedPiece, piece: Piece): Polygon {
  return getPlacedPolygon(getLayoutPolygon(piece), placed.x, placed.y, placed.rotation)
}

export function isFullyOnFabric(
  box: { minX: number; minY: number; maxX: number; maxY: number },
  fabricWidthCm: number,
  fabricHeightCm: number,
): boolean {
  return (
    box.minX >= -0.01 &&
    box.minY >= -0.01 &&
    box.maxX <= fabricWidthCm + 0.01 &&
    box.maxY <= fabricHeightCm + 0.01
  )
}

export function isValidLayout(pieces: Piece[], placedPieces: PlacedPiece[]): boolean {
  const keys = new Set(pieces.map((p) => p.id))
  const seen = new Set<string>()
  for (const placed of placedPieces) {
    if (!keys.has(placed.instanceKey)) return false
    if (seen.has(placed.instanceKey)) return false
    seen.add(placed.instanceKey)
  }
  return true
}

export function sanitizePlacedPieces(
  placedPieces: PlacedPiece[],
  pieces: Piece[],
): PlacedPiece[] {
  const keys = new Set(pieces.map((p) => p.id))
  const seen = new Set<string>()
  const result: PlacedPiece[] = []
  for (const placed of placedPieces) {
    if (!keys.has(placed.instanceKey)) continue
    if (seen.has(placed.instanceKey)) continue
    seen.add(placed.instanceKey)
    result.push(placed)
  }
  return result
}

export function getUnplacedPieces(pieces: Piece[], placedPieces: PlacedPiece[]): Piece[] {
  const placedKeys = new Set(placedPieces.map((p) => p.instanceKey))
  return pieces.filter((p) => !placedKeys.has(p.id))
}

export async function findFirstOpenPosition(
  piece: Piece,
  placedPieces: PlacedPiece[],
  allPieces: Piece[],
  fabricWidthCm: number,
  fabricHeightCm: number,
  cuttingGapCm: number,
): Promise<{ x: number; y: number; rotation: number }> {
  const normalized = normalizePolygon(getLayoutPolygon(piece))
  const box = boundingBox(normalized)
  const shifted = normalized.map((p) => ({ x: p.x - box.minX, y: p.y - box.minY }))
  const finalBox = boundingBox(shifted)
  const gappedCandidateBase = await offsetPolygon(shifted, cuttingGapCm)

  const pieceMap = new Map(allPieces.map((p) => [p.id, p]))
  const placedVertices: Polygon[] = []
  const orderedPlaced: PlacedPiece[] = []

  for (const placed of placedPieces) {
    const existing = pieceMap.get(placed.instanceKey)
    if (!existing) continue
    placedVertices.push(getLayoutPolygon(existing))
    orderedPlaced.push(placed)
  }

  const offsetVerts = await offsetPolygons(placedVertices, cuttingGapCm)
  const existingPolys = orderedPlaced.map((placed, i) =>
    getPlacedPolygon(offsetVerts[i], placed.x, placed.y, placed.rotation),
  )

  if (finalBox.width > fabricWidthCm || finalBox.height > fabricHeightCm) {
    return { x: 0, y: 0, rotation: 0 }
  }

  for (let y = 0; y <= fabricHeightCm - finalBox.height; y += POSITION_STEP_CM) {
    for (let x = 0; x <= fabricWidthCm - finalBox.width; x += POSITION_STEP_CM) {
      const rawCandidate = shifted.map((p) => ({ x: p.x + x, y: p.y + y }))
      if (!isFullyOnFabric(boundingBox(rawCandidate), fabricWidthCm, fabricHeightCm)) continue

      const gappedCandidate = gappedCandidateBase.map((p) => ({ x: p.x + x, y: p.y + y }))
      if (!isFullyOnFabric(boundingBox(gappedCandidate), fabricWidthCm, fabricHeightCm)) continue

      let overlaps = false
      for (const placed of existingPolys) {
        if (polygonsOverlap(gappedCandidate, placed)) {
          overlaps = true
          break
        }
      }
      if (!overlaps) return { x, y, rotation: 0 }
    }
  }

  return { x: 0, y: 0, rotation: 0 }
}

/** Staging Y threshold used before v5 migration. */
export const LEGACY_STAGING_GAP_CM = 2

export function isLegacyStagingPlacement(
  placed: PlacedPiece,
  fabricHeightCm: number,
): boolean {
  return placed.y >= fabricHeightCm + LEGACY_STAGING_GAP_CM - 0.01
}
