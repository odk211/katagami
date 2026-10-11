import { describe, it, expect } from 'vitest'
import { createCalibration } from './calibration'

describe('createCalibration', () => {
  it('computes pixels per cm from known dimension', () => {
    const result = createCalibration({ x: 0, y: 0 }, { x: 400, y: 0 }, 40)
    expect(result).not.toBeNull()
    expect(result!.pixelsPerCm).toBe(10)
    expect(result!.lengthCm).toBe(40)
  })

  it('returns null for invalid input', () => {
    expect(createCalibration({ x: 0, y: 0 }, { x: 0, y: 0 }, 40)).toBeNull()
    expect(createCalibration({ x: 0, y: 0 }, { x: 100, y: 0 }, 0)).toBeNull()
  })
})
