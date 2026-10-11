import { describe, it, expect } from 'vitest'
import { canWheelPanStageY, clampStagePosition, clampZoom } from './stageTransform'

describe('clampZoom', () => {
  it('clamps scale within bounds', () => {
    expect(clampZoom(0.01)).toBe(0.05)
    expect(clampZoom(20)).toBe(10)
    expect(clampZoom(2)).toBe(2)
  })
})

describe('clampStagePosition', () => {
  function mockStage(x: number, y: number, scale: number) {
    const state = { x, y, scale }
    return {
      scaleX: () => state.scale,
      x: () => state.x,
      y: () => state.y,
      position: (pos: { x: number; y: number }) => {
        state.x = pos.x
        state.y = pos.y
      },
    }
  }

  it('prevents panning beyond image when zoomed in', () => {
    const stage = mockStage(-2000, -2000, 2)
    clampStagePosition(stage as never, 400, 300, 1000, 800)
    expect(stage.x()).toBe(-1600)
    expect(stage.y()).toBe(-1300)
  })

  it('keeps image within viewport when smaller than viewport', () => {
    const stage = mockStage(200, 200, 0.2)
    clampStagePosition(stage as never, 400, 300, 1000, 800)
    expect(stage.x()).toBeGreaterThanOrEqual(0)
    expect(stage.x()).toBeLessThanOrEqual(200)
    expect(stage.y()).toBeGreaterThanOrEqual(0)
    expect(stage.y()).toBeLessThanOrEqual(140)
  })
})

describe('canWheelPanStageY', () => {
  function mockStage(y: number, scale: number) {
    return { scaleX: () => scale, y: () => y }
  }

  it('blocks scroll-up handoff when image can still move up', () => {
    const stage = mockStage(-100, 2)
    expect(canWheelPanStageY(stage as never, 300, 800, -10)).toBe(true)
  })

  it('hands off scroll-up to page at top edge', () => {
    const stage = mockStage(0, 2)
    expect(canWheelPanStageY(stage as never, 300, 800, -10)).toBe(false)
  })

  it('hands off scroll-down to page at bottom edge', () => {
    const stage = mockStage(-1300, 2)
    expect(canWheelPanStageY(stage as never, 300, 800, 10)).toBe(false)
  })
})
