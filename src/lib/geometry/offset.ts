import {
  loadNativeClipperLibInstanceAsync,
  NativeClipperLibRequestedFormat,
  JoinType,
  EndType,
  type ClipperLibWrapper,
} from 'js-angusj-clipper/web'
import type { Polygon } from '../../types'

const SCALE = 1000

let clipperInstance: ClipperLibWrapper | null = null

async function getClipper(): Promise<ClipperLibWrapper> {
  if (!clipperInstance) {
    clipperInstance = await loadNativeClipperLibInstanceAsync(
      NativeClipperLibRequestedFormat.WasmWithAsmJsFallback,
    )
  }
  return clipperInstance
}

function toClipperPath(polygon: Polygon) {
  return polygon.map((p) => ({
    x: Math.round(p.x * SCALE),
    y: Math.round(p.y * SCALE),
  }))
}

function fromClipperPath(path: { x: number; y: number }[]): Polygon {
  return path.map((p) => ({ x: p.x / SCALE, y: p.y / SCALE }))
}

export async function offsetPolygon(polygon: Polygon, gapCm: number): Promise<Polygon> {
  if (polygon.length < 3 || gapCm <= 0) return polygon

  const clipper = await getClipper()
  const offset = Math.round((gapCm / 2) * SCALE)
  const result = clipper.offsetToPaths({
    delta: offset,
    offsetInputs: [
      {
        data: toClipperPath(polygon),
        joinType: JoinType.Miter,
        endType: EndType.ClosedPolygon,
      },
    ],
  })

  if (!result || result.length === 0) return polygon
  return fromClipperPath(result[0])
}

export async function offsetPolygons(polygons: Polygon[], gapCm: number): Promise<Polygon[]> {
  return Promise.all(polygons.map((p) => offsetPolygon(p, gapCm)))
}
