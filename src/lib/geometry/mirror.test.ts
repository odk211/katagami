import { describe, it, expect } from 'vitest'
import { expandFoldCenter, mirrorCopyPolygon, getLayoutPolygon } from './mirror'
import { isValidClosedPolygon } from './polygon'
import { polygonArea } from './polygon'
import type { Piece } from '../../types'

describe('expandFoldCenter', () => {
  const half = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 5 },
    { x: 0, y: 5 },
  ]

  it('doubles a rectangle half across the fold edge (点1→点2)', () => {
    const full = expandFoldCenter(half)
    expect(polygonArea(full)).toBeCloseTo(100, 1)
  })

  it('throws for fewer than 3 vertices', () => {
    expect(() =>
      expandFoldCenter([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
    ).toThrow()
  })
})

describe('isValidClosedPolygon', () => {
  it('rejects zero-length fold edge', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 5 },
    ]
    expect(isValidClosedPolygon(vertices)).toBe(false)
  })

  it('accepts a valid triangle', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 8 },
    ]
    expect(isValidClosedPolygon(vertices)).toBe(true)
  })
})

describe('mirrorCopyPolygon', () => {
  it('reflects across vertical center of bounding box', () => {
    const poly = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
    ]
    const mirrored = mirrorCopyPolygon(poly)
    expect(mirrored[0].x).toBeCloseTo(4)
    expect(mirrored[1].x).toBeCloseTo(0)
  })
})

describe('getLayoutPolygon', () => {
  it('expands fold center pieces', () => {
    const piece: Piece = {
      id: '1',
      photoId: 'p',
      name: 'test',
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
        { x: 0, y: 5 },
      ],
      cutMode: 'foldCenter',
      createdAt: 0,
    }
    expect(polygonArea(getLayoutPolygon(piece))).toBeCloseTo(100, 1)
  })

  it('returns vertices for normal pieces', () => {
    const piece: Piece = {
      id: '1',
      photoId: 'p',
      name: 'test',
      vertices: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }],
      cutMode: 'normal',
      createdAt: 0,
    }
    expect(getLayoutPolygon(piece)).toEqual(piece.vertices)
  })
})
