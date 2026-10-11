import { describe, it, expect } from 'vitest'
import { computeLayoutIssues } from './issues'
import type { Piece, PlacedPiece } from '../../../types'

function rectPiece(id: string, width: number, height: number): Piece {
  return {
    id,
    name: id,
    cutMode: 'normal',
    vertices: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    photoId: 'photo-1',
    createdAt: 0,
  }
}

function placed(instanceKey: string, x: number, y: number): PlacedPiece {
  return { instanceKey, pieceId: instanceKey, slotIndex: 0, x, y, rotation: 0 }
}

describe('computeLayoutIssues', () => {
  it('returns no issues for an empty layout', async () => {
    const issues = await computeLayoutIssues([], [], 100, 100, 1)
    expect(issues).toEqual({ hasOverlap: false, hasOverflow: false })
  })

  it('detects overflow when a piece extends past the fabric edge', async () => {
    const pieces = [rectPiece('a', 20, 20)]
    const placedPieces = [placed('a', 90, 90)]

    const issues = await computeLayoutIssues(pieces, placedPieces, 100, 100, 0)
    expect(issues.hasOverflow).toBe(true)
    expect(issues.hasOverlap).toBe(false)
  })

  it('detects overlap when gapped polygons intersect', async () => {
    const pieces = [rectPiece('a', 20, 20), rectPiece('b', 20, 20)]
    const placedPieces = [placed('a', 0, 0), placed('b', 15, 0)]

    const issues = await computeLayoutIssues(pieces, placedPieces, 100, 100, 2)
    expect(issues.hasOverlap).toBe(true)
  })

  it('allows separated pieces with enough cutting gap clearance', async () => {
    const pieces = [rectPiece('a', 20, 20), rectPiece('b', 20, 20)]
    const placedPieces = [placed('a', 0, 0), placed('b', 22, 0)]

    const issues = await computeLayoutIssues(pieces, placedPieces, 100, 100, 2)
    expect(issues).toEqual({ hasOverlap: false, hasOverflow: false })
  })
})
