import polygonClipping from 'polygon-clipping'
import type { Polygon } from '../../types'
import { polygonToClipper } from './polygon'

export function polygonsOverlap(a: Polygon, b: Polygon, tolerance = 0.01): boolean {
  if (a.length < 3 || b.length < 3) return false

  try {
    const intersection = polygonClipping.intersection(
      polygonToClipper(a),
      polygonToClipper(b),
    )
    if (!intersection || intersection.length === 0) return false

    let area = 0
    for (const poly of intersection) {
      for (const ring of poly) {
        area += ringArea(ring)
      }
    }
    return area > tolerance
  } catch {
    return false
  }
}

function ringArea(ring: [number, number][]): number {
  if (ring.length < 3) return 0
  let area = 0
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length
    area += ring[i][0] * ring[j][1]
    area -= ring[j][0] * ring[i][1]
  }
  return Math.abs(area) / 2
}

export function anyOverlap(polygons: Polygon[]): boolean {
  for (let i = 0; i < polygons.length; i++) {
    for (let j = i + 1; j < polygons.length; j++) {
      if (polygonsOverlap(polygons[i], polygons[j])) return true
    }
  }
  return false
}
