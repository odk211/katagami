import type { Calibration, Point } from '../../types'
import { distance } from './point'

export function createCalibration(
  pointA: Point,
  pointB: Point,
  lengthCm: number,
): Calibration | null {
  const pixelDistance = distance(pointA, pointB)
  if (pixelDistance <= 0 || lengthCm <= 0) return null

  return {
    pointA,
    pointB,
    lengthCm,
    pixelsPerCm: pixelDistance / lengthCm,
  }
}
