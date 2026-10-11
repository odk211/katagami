import type { Point, Polygon } from '../../types'
import { distance, rotatePoint, translatePolygon } from './point'

export const MIN_EDGE_LENGTH_CM = 0.1

export function isValidClosedPolygon(
  vertices: Polygon,
  minEdgeLength = MIN_EDGE_LENGTH_CM,
): boolean {
  if (vertices.length < 3) return false
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]
    const b = vertices[(i + 1) % vertices.length]
    if (distance(a, b) < minEdgeLength) return false
  }
  return true
}

export function polygonArea(polygon: Polygon): number {
  if (polygon.length < 3) return 0
  let area = 0
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length
    area += polygon[i].x * polygon[j].y
    area -= polygon[j].x * polygon[i].y
  }
  return Math.abs(area) / 2
}

export function boundingBox(polygon: Polygon) {
  if (polygon.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }
  const xs = polygon.map((p) => p.x)
  const ys = polygon.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

export function normalizePolygon(polygon: Polygon): Polygon {
  const box = boundingBox(polygon)
  return translatePolygon(polygon, -box.minX, -box.minY)
}

export function getPlacedPolygon(
  vertices: Polygon,
  x: number,
  y: number,
  rotationDeg: number,
): Polygon {
  const normalized = normalizePolygon(vertices)
  const rotated = normalized.map((p) => rotatePoint(p, rotationDeg, { x: 0, y: 0 }))
  return translatePolygon(rotated, x, y)
}

export function polygonToClipper(polygon: Polygon): [number, number][][] {
  const ring = polygon.map((p) => [p.x, p.y] as [number, number])
  return [ring]
}

export function pixelsToCm(pixelDistance: number, pixelsPerCm: number): number {
  return pixelDistance / pixelsPerCm
}

export function cmToPixels(cm: number, pixelsPerCm: number): number {
  return cm * pixelsPerCm
}

export function pixelPointToCm(point: Point, pixelsPerCm: number): Point {
  return { x: point.x / pixelsPerCm, y: point.y / pixelsPerCm }
}

export function cmPointToPixel(point: Point, pixelsPerCm: number): Point {
  return { x: point.x * pixelsPerCm, y: point.y * pixelsPerCm }
}

export function fabricRect(widthCm: number, heightCm: number): Polygon {
  return [
    { x: 0, y: 0 },
    { x: widthCm, y: 0 },
    { x: widthCm, y: heightCm },
    { x: 0, y: heightCm },
  ]
}

export function isInsideFabric(polygon: Polygon, widthCm: number, heightCm: number): boolean {
  const box = boundingBox(polygon)
  return box.minX >= 0 && box.minY >= 0 && box.maxX <= widthCm && box.maxY <= heightCm
}
