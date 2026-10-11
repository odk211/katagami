import { describe, it, expect } from 'vitest'
import { polygonArea, boundingBox, getPlacedPolygon } from './polygon'

describe('polygonArea', () => {
  it('calculates rectangle area', () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ]
    expect(polygonArea(rect)).toBe(50)
  })
})

describe('boundingBox', () => {
  it('returns correct dimensions', () => {
    const poly = [
      { x: 2, y: 3 },
      { x: 8, y: 3 },
      { x: 8, y: 7 },
    ]
    const box = boundingBox(poly)
    expect(box.width).toBe(6)
    expect(box.height).toBe(4)
  })
})

describe('getPlacedPolygon', () => {
  it('translates and rotates polygon', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ]
    const placed = getPlacedPolygon(square, 5, 10, 0)
    const box = boundingBox(placed)
    expect(box.minX).toBeCloseTo(5)
    expect(box.minY).toBeCloseTo(10)
  })
})
