import type { Piece, Point, Polygon } from '../../types'
import { boundingBox } from './polygon'

const EPS = 1e-6

export function reflectPointAcrossLine(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq < EPS) return { ...p }

  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  const projX = a.x + t * dx
  const projY = a.y + t * dy
  return {
    x: 2 * projX - p.x,
    y: 2 * projY - p.y,
  }
}

/** 先頭2点が折り線、以降が外周。点n→点1は暗黙の閉じ辺。 */
export function expandFoldCenter(half: Polygon): Polygon {
  const n = half.length
  if (n < 3) {
    throw new Error('折りセンター展開には3点以上の頂点が必要です')
  }

  const a = half[0]
  const b = half[1]
  const result: Polygon = [...half]

  const lastHalf = result[result.length - 1]
  if (lastHalf.x !== a.x || lastHalf.y !== a.y) {
    result.push({ ...a })
  }

  for (let i = n - 1; i >= 2; i--) {
    result.push(reflectPointAcrossLine(half[i], a, b))
  }

  let last = result[result.length - 1]
  if (last.x !== b.x || last.y !== b.y) {
    result.push({ ...b })
    last = b
  }
  if (last.x !== a.x || last.y !== a.y) {
    result.push({ ...a })
  }

  return result
}

export function mirrorCopyPolygon(poly: Polygon): Polygon {
  const box = boundingBox(poly)
  const midX = (box.minX + box.maxX) / 2
  return poly.map((p) => ({ x: 2 * midX - p.x, y: p.y }))
}

export function getLayoutPolygon(piece: Piece): Polygon {
  if (piece.cutMode === 'foldCenter') {
    return expandFoldCenter(piece.vertices)
  }
  return piece.vertices
}

export function getFoldCenterTraceHint(vertexCount: number): string {
  if (vertexCount === 0) return '折り線の始点をタップ（1/2）'
  if (vertexCount === 1) return '折り線の終点をタップ（2/2）'
  if (vertexCount === 2) return '外周をタップ。最後の点から点1へ自動で閉じます'
  return `外周: ${vertexCount - 2}点目`
}
