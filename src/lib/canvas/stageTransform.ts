import type Konva from 'konva'
import type { Point } from '../../types'

export const STAGE_DRAG_DISTANCE = 10

export function pointerToImage(stage: Konva.Stage): Point | null {
  const pos = stage.getPointerPosition()
  if (!pos) return null
  const transform = stage.getAbsoluteTransform().copy()
  transform.invert()
  return transform.point(pos)
}

export function isPointerOverImage(
  stage: Konva.Stage,
  photoWidth: number,
  photoHeight: number,
): boolean {
  const point = pointerToImage(stage)
  if (!point) return false
  return (
    point.x >= 0 &&
    point.x <= photoWidth &&
    point.y >= 0 &&
    point.y <= photoHeight
  )
}

export function isClientPointOverImage(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  stage: Konva.Stage,
  photoWidth: number,
  photoHeight: number,
): boolean {
  const scale = stage.scaleX()
  const imageX = (clientX - containerRect.left - stage.x()) / scale
  const imageY = (clientY - containerRect.top - stage.y()) / scale
  return (
    imageX >= 0 &&
    imageX <= photoWidth &&
    imageY >= 0 &&
    imageY <= photoHeight
  )
}

export function clampZoom(scale: number): number {
  return Math.min(10, Math.max(0.05, scale))
}

export function isClientPointInRect(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): boolean {
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  )
}

export function getStagePositionBounds(
  stage: Konva.Stage,
  viewportWidth: number,
  viewportHeight: number,
  photoWidth: number,
  photoHeight: number,
) {
  const scale = stage.scaleX()
  const scaledW = photoWidth * scale
  const scaledH = photoHeight * scale
  return {
    lowX: Math.min(viewportWidth - scaledW, 0),
    highX: Math.max(viewportWidth - scaledW, 0),
    lowY: Math.min(viewportHeight - scaledH, 0),
    highY: Math.max(viewportHeight - scaledH, 0),
  }
}

const PAN_EDGE_EPS = 0.5

/** Returns false when vertical wheel should scroll the page instead of panning the image. */
export function canWheelPanStageY(
  stage: Konva.Stage,
  viewportHeight: number,
  photoHeight: number,
  deltaY: number,
): boolean {
  const scale = stage.scaleX()
  const scaledH = photoHeight * scale
  const lowY = Math.min(viewportHeight - scaledH, 0)
  const highY = Math.max(viewportHeight - scaledH, 0)
  const y = stage.y()
  const nextY = Math.min(highY, Math.max(lowY, y - deltaY))

  if (deltaY < 0 && y >= highY - PAN_EDGE_EPS && nextY >= y - PAN_EDGE_EPS) {
    return false
  }
  if (deltaY > 0 && y <= lowY + PAN_EDGE_EPS && nextY <= y + PAN_EDGE_EPS) {
    return false
  }
  return true
}

export function clampStagePosition(
  stage: Konva.Stage,
  viewportWidth: number,
  viewportHeight: number,
  photoWidth: number,
  photoHeight: number,
): void {
  const { lowX, highX, lowY, highY } = getStagePositionBounds(
    stage,
    viewportWidth,
    viewportHeight,
    photoWidth,
    photoHeight,
  )

  stage.position({
    x: Math.min(highX, Math.max(lowX, stage.x())),
    y: Math.min(highY, Math.max(lowY, stage.y())),
  })
}

export function zoomStageAtPoint(
  stage: Konva.Stage,
  anchorX: number,
  anchorY: number,
  factor: number,
): number {
  const oldScale = stage.scaleX()
  const newScale = clampZoom(oldScale * factor)
  const anchor = {
    x: (anchorX - stage.x()) / oldScale,
    y: (anchorY - stage.y()) / oldScale,
  }
  stage.scale({ x: newScale, y: newScale })
  stage.position({
    x: anchorX - anchor.x * newScale,
    y: anchorY - anchor.y * newScale,
  })
  stage.batchDraw()
  return newScale
}

export function zoomStageAtCenter(
  stage: Konva.Stage,
  viewportWidth: number,
  viewportHeight: number,
  factor: number,
): void {
  zoomStageAtPoint(stage, viewportWidth / 2, viewportHeight / 2, factor)
}

export function fitStageToPhoto(
  stage: Konva.Stage,
  photoWidth: number,
  viewportWidth: number,
): void {
  const scale = viewportWidth / photoWidth
  stage.scale({ x: scale, y: scale })
  stage.position({ x: 0, y: 0 })
  stage.batchDraw()
}
