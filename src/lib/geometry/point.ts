import type { Point, Polygon } from '../../types'

export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function rotatePoint(point: Point, angleDeg: number, origin: Point = { x: 0, y: 0 }): Point {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  }
}

export function translatePolygon(polygon: Polygon, dx: number, dy: number): Polygon {
  return polygon.map((p) => ({ x: p.x + dx, y: p.y + dy }))
}

export function rotatePolygon(polygon: Polygon, angleDeg: number, origin?: Point): Polygon {
  const center = origin ?? centroid(polygon)
  return polygon.map((p) => rotatePoint(p, angleDeg, center))
}

export function centroid(polygon: Polygon): Point {
  if (polygon.length === 0) return { x: 0, y: 0 }
  const sum = polygon.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  )
  return { x: sum.x / polygon.length, y: sum.y / polygon.length }
}
