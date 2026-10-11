import type Konva from 'konva'
import type { Point } from '../../types'

export const STAGE_DRAG_DISTANCE = 10

/** Konva name of the hit area of a draggable vertex; touches on it never scroll or add points. */
export const VERTEX_HANDLE_NAME = 'vertex-handle'

function pointerToImage(stage: Konva.Stage): Point | null {
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
  const { x, y } = clampView(
    { scale: stage.scaleX(), x: stage.x(), y: stage.y() },
    { width: viewportWidth, height: viewportHeight },
    { width: photoWidth, height: photoHeight },
  )
  stage.position({ x, y })
}

/** Scale and position of the stage: a photo pixel p is drawn at p * scale + (x, y). */
export type StageView = { scale: number; x: number; y: number }
type Size = { width: number; height: number }
export type TouchPair = readonly [Point, Point]

/** Photo pixel under a point given in stage-container coordinates. */
export function viewToImage(view: StageView, point: Point): Point {
  return {
    x: (point.x - view.x) / view.scale,
    y: (point.y - view.y) / view.scale,
  }
}

/** Keeps the photo covering the viewport when it is larger, and inside it when smaller. */
export function clampView(view: StageView, viewport: Size, photo: Size): StageView {
  const clampAxis = (pos: number, viewportLength: number, photoLength: number) => {
    const slack = viewportLength - photoLength * view.scale
    return Math.min(Math.max(slack, 0), Math.max(Math.min(slack, 0), pos))
  }
  return {
    scale: view.scale,
    x: clampAxis(view.x, viewport.width, photo.width),
    y: clampAxis(view.y, viewport.height, photo.height),
  }
}

function midpoint([a, b]: TouchPair): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function distance([a, b]: TouchPair): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/**
 * View after two fingers move from `from` to `to`, starting at `start`: the scale follows
 * the finger spread and the photo pixel that was under the midpoint stays under it.
 */
export function pinchView(start: StageView, from: TouchPair, to: TouchPair): StageView {
  const anchor = viewToImage(start, midpoint(from))
  const startDistance = distance(from)
  const ratio = startDistance > 0 ? distance(to) / startDistance : 1
  const scale = clampZoom(start.scale * ratio)
  const mid = midpoint(to)
  return { scale, x: mid.x - anchor.x * scale, y: mid.y - anchor.y * scale }
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

/** View that shows the whole photo as large as possible, centered on the axis it leaves room on. */
export function fitPhotoView(viewport: Size, photo: Size): StageView {
  const scale = Math.min(viewport.width / photo.width, viewport.height / photo.height)
  return {
    scale,
    x: (viewport.width - photo.width * scale) / 2,
    y: (viewport.height - photo.height * scale) / 2,
  }
}
