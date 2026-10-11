import type { Piece, PlacedPiece, Polygon } from '../../types'
import { getLayoutPolygon } from '../geometry/mirror'
import { boundingBox, getPlacedPolygon, normalizePolygon, polygonArea } from '../geometry/polygon'
import { polygonsOverlap } from '../geometry/overlap'
import { offsetPolygons } from '../geometry/offset'
import { isExpandedLayoutPiece } from '../layout/expandPieces'

export type NestInput = {
  /** Pieces to auto-nest (those not yet placed on fabric). */
  pieces: Piece[]
  /** All layout pieces, used to resolve fixed placement geometry. */
  allPieces: Piece[]
  /** Placements on fabric that must not move; treated as obstacles. */
  fixedPlacements?: PlacedPiece[]
  fabricWidthCm: number
  fabricHeightCm: number
  cuttingGapCm: number
  timeoutMs?: number
}

export type NestResult = {
  placedPieces: PlacedPiece[]
  allPlaced: boolean
  utilizationPercent: number
}

const ROTATION_STEP = 15
const POSITION_STEP = 1

export async function nestPieces(input: NestInput): Promise<NestResult> {
  const {
    pieces,
    allPieces,
    fixedPlacements = [],
    fabricWidthCm,
    fabricHeightCm,
    cuttingGapCm,
    timeoutMs = 10000,
  } = input
  const start = Date.now()
  const pieceMap = new Map(allPieces.map((p) => [p.id, p]))

  const placedPolygons: Polygon[] = []

  if (fixedPlacements.length > 0) {
    const fixedVertices = fixedPlacements.map((fp) => {
      const piece = pieceMap.get(fp.instanceKey)
      if (!piece) throw new Error(`Unknown fixed piece: ${fp.instanceKey}`)
      return getLayoutPolygon(piece)
    })
    const fixedOffsets = await offsetPolygons(fixedVertices, cuttingGapCm)
    for (let i = 0; i < fixedPlacements.length; i++) {
      const fp = fixedPlacements[i]
      placedPolygons.push(getPlacedPolygon(fixedOffsets[i], fp.x, fp.y, fp.rotation))
    }
  }

  const sorted = [...pieces].sort(
    (a, b) => polygonArea(getLayoutPolygon(b)) - polygonArea(getLayoutPolygon(a)),
  )

  const offsetVerts = await offsetPolygons(
    sorted.map((p) => getLayoutPolygon(p)),
    cuttingGapCm,
  )

  const placedPieces: PlacedPiece[] = []

  for (let i = 0; i < sorted.length; i++) {
    if (Date.now() - start > timeoutMs) break

    const piece = sorted[i]
    const vertices = offsetVerts[i]
    const placement = findPlacement(
      vertices,
      fabricWidthCm,
      fabricHeightCm,
      placedPolygons,
      start,
      timeoutMs,
    )

    if (placement) {
      placedPieces.push({
        instanceKey: piece.id,
        pieceId: isExpandedLayoutPiece(piece) ? piece.sourcePieceId : piece.id,
        slotIndex: isExpandedLayoutPiece(piece) ? piece.slotIndex : 0,
        ...placement,
      })
      placedPolygons.push(getPlacedPolygon(vertices, placement.x, placement.y, placement.rotation))
    }
  }

  const nestedArea = placedPieces.reduce((sum, p) => {
    const piece = pieceMap.get(p.instanceKey)
    return piece ? sum + polygonArea(getLayoutPolygon(piece)) : sum
  }, 0)
  const fixedArea = fixedPlacements.reduce((sum, fp) => {
    const piece = pieceMap.get(fp.instanceKey)
    return piece ? sum + polygonArea(getLayoutPolygon(piece)) : sum
  }, 0)
  const fabricArea = fabricWidthCm * fabricHeightCm
  const utilizationPercent = fabricArea > 0 ? ((nestedArea + fixedArea) / fabricArea) * 100 : 0

  return {
    placedPieces,
    allPlaced: placedPieces.length === pieces.length,
    utilizationPercent,
  }
}

function findPlacement(
  vertices: Polygon,
  fabricWidthCm: number,
  fabricHeightCm: number,
  placedPolygons: Polygon[],
  startTime: number,
  timeoutMs: number,
): { x: number; y: number; rotation: number } | null {
  const normalized = normalizePolygon(vertices)

  for (let rotation = 0; rotation < 360; rotation += ROTATION_STEP) {
    if (Date.now() - startTime > timeoutMs) return null

    const rotated = normalized.map((p) => {
      const rad = (rotation * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }
    })
    const box = boundingBox(rotated)
    const shifted = rotated.map((p) => ({ x: p.x - box.minX, y: p.y - box.minY }))
    const finalBox = boundingBox(shifted)

    if (finalBox.width > fabricWidthCm || finalBox.height > fabricHeightCm) continue

    for (let y = 0; y <= fabricHeightCm - finalBox.height; y += POSITION_STEP) {
      for (let x = 0; x <= fabricWidthCm - finalBox.width; x += POSITION_STEP) {
        const candidate = shifted.map((p) => ({ x: p.x + x, y: p.y + y }))

        if (!fitsInFabric(candidate, fabricWidthCm, fabricHeightCm)) continue

        let overlaps = false
        for (const placed of placedPolygons) {
          if (polygonsOverlap(candidate, placed)) {
            overlaps = true
            break
          }
        }
        if (!overlaps) return { x, y, rotation }
      }
    }
  }

  return null
}

function fitsInFabric(polygon: Polygon, widthCm: number, heightCm: number): boolean {
  const box = boundingBox(polygon)
  return box.minX >= -0.01 && box.minY >= -0.01 && box.maxX <= widthCm + 0.01 && box.maxY <= heightCm + 0.01
}
