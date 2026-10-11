import { describe, it, expect } from 'vitest'
import {
  canWheelPanStageY,
  clampStagePosition,
  clampView,
  clampZoom,
  fitPhotoView,
  pinchView,
  viewToImage,
} from './stageTransform'

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

describe('viewToImage', () => {
  it('inverts scale and position', () => {
    expect(viewToImage({ scale: 2, x: -100, y: 50 }, { x: 100, y: 150 })).toEqual({ x: 100, y: 50 })
  })
})

describe('clampView', () => {
  const viewport = { width: 400, height: 300 }
  const photo = { width: 1000, height: 800 }

  it('keeps a zoomed-in photo covering the viewport', () => {
    expect(clampView({ scale: 2, x: -2000, y: 50 }, viewport, photo)).toEqual({ scale: 2, x: -1600, y: 0 })
  })

  it('keeps a zoomed-out photo inside the viewport', () => {
    expect(clampView({ scale: 0.2, x: -10, y: 500 }, viewport, photo)).toEqual({ scale: 0.2, x: 0, y: 140 })
  })

  it('leaves a valid position alone', () => {
    expect(clampView({ scale: 1, x: -300, y: -200 }, viewport, photo)).toEqual({ scale: 1, x: -300, y: -200 })
  })
})

describe('pinchView', () => {
  const start = { scale: 0.5, x: -40, y: 10 }
  const pair = (ax: number, ay: number, bx: number, by: number) =>
    [{ x: ax, y: ay }, { x: bx, y: by }] as const

  it('scales by the finger spread and keeps the photo pixel under the midpoint fixed', () => {
    const from = pair(150, 200, 250, 200)
    const to = pair(100, 200, 300, 200)
    const next = pinchView(start, from, to)
    expect(next.scale).toBeCloseTo(1)
    const anchor = viewToImage(start, { x: 200, y: 200 })
    const after = viewToImage(next, { x: 200, y: 200 })
    expect(after.x).toBeCloseTo(anchor.x)
    expect(after.y).toBeCloseTo(anchor.y)
  })

  it('pans by the midpoint delta when the spread is unchanged', () => {
    const next = pinchView(start, pair(100, 100, 200, 100), pair(130, 80, 230, 80))
    expect(next.scale).toBeCloseTo(0.5)
    expect(next.x).toBeCloseTo(-10)
    expect(next.y).toBeCloseTo(-10)
  })

  it('moves the anchored photo pixel to the new midpoint while zooming', () => {
    const from = pair(100, 100, 200, 100)
    const to = pair(120, 160, 320, 160)
    const next = pinchView(start, from, to)
    const anchor = viewToImage(start, { x: 150, y: 100 })
    expect(next.scale).toBeCloseTo(1)
    expect(anchor.x * next.scale + next.x).toBeCloseTo(220)
    expect(anchor.y * next.scale + next.y).toBeCloseTo(160)
  })

  it('clamps the scale with clampZoom', () => {
    expect(pinchView(start, pair(0, 0, 10, 0), pair(0, 0, 1000, 0)).scale).toBe(10)
    expect(pinchView(start, pair(0, 0, 1000, 0), pair(0, 0, 1, 0)).scale).toBe(0.05)
  })

  it('keeps the scale when both fingers start on the same point', () => {
    expect(pinchView(start, pair(50, 50, 50, 50), pair(40, 50, 60, 50)).scale).toBe(0.5)
  })
})

describe('fitPhotoView', () => {
  it('fits a portrait photo in a height-capped viewport by height, centered horizontally', () => {
    const view = fitPhotoView({ width: 356, height: 432 }, { width: 3024, height: 4032 })
    expect(view.scale).toBeCloseTo(432 / 4032)
    expect(4032 * view.scale).toBeCloseTo(432)
    expect(view.x).toBeCloseTo((356 - 3024 * (432 / 4032)) / 2)
    expect(view.x).toBeGreaterThan(0)
    expect(view.y).toBeCloseTo(0)
  })

  it('fits a landscape photo in a tall viewport by width, centered vertically', () => {
    expect(fitPhotoView({ width: 400, height: 600 }, { width: 1000, height: 500 })).toEqual({
      scale: 0.4,
      x: 0,
      y: 200,
    })
  })

  it('fills the viewport with no offset when the aspect ratios match', () => {
    expect(fitPhotoView({ width: 480, height: 360 }, { width: 960, height: 720 })).toEqual({
      scale: 0.5,
      x: 0,
      y: 0,
    })
  })

  it('is a position clampView keeps, so the photo stays centered', () => {
    const viewport = { width: 356, height: 432 }
    const photo = { width: 3024, height: 4032 }
    const view = fitPhotoView(viewport, photo)
    expect(clampView(view, viewport, photo)).toEqual(view)
  })

  it('is a scale clampZoom leaves alone for a 48 MP photo on a phone', () => {
    const view = fitPhotoView({ width: 356, height: 432 }, { width: 6048, height: 8064 })
    expect(clampZoom(view.scale)).toBe(view.scale)
  })
})
