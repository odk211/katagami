import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import type Konva from 'konva'
import type { Point } from '../types'
import {
  STAGE_DRAG_DISTANCE,
  VERTEX_HANDLE_NAME,
  canWheelPanStageY,
  clampStagePosition,
  clampView,
  fitPhotoView,
  isClientPointInRect,
  isClientPointOverImage,
  isPointerOverImage,
  pinchView,
  viewToImage,
  zoomStageAtCenter,
  type StageView,
  type TouchPair,
} from '../lib/canvas/stageTransform'

/**
 * Touch gestures on the photo. One finger on the background is left to the browser
 * (touch-action: pan-y scrolls the page) and only becomes a tap if it barely moves;
 * one finger on a vertex handle is Konva's drag; two fingers pinch-zoom and pan the stage.
 */
type TouchGesture =
  | { kind: 'idle' }
  | { kind: 'pending-tap'; start: Point }
  | { kind: 'scrolling' }
  | { kind: 'dragging-handle' }
  | { kind: 'pinching'; startView: StageView; from: TouchPair }
  | { kind: 'pinch-ending' }

function clientPoint(touch: Touch): Point {
  return { x: touch.clientX, y: touch.clientY }
}

export function useZoomablePhotoStage(
  photoWidth: number,
  photoHeight: number,
  onBackgroundTap: (point: Point) => void,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const wasStageDraggedRef = useRef(false)
  const gestureRef = useRef<TouchGesture>({ kind: 'idle' })
  const viewportRef = useRef({ width: 300, height: 400 })
  const [viewport, setViewport] = useState({ width: 300, height: 400 })
  const [stageScale, setStageScale] = useState(1)

  const aspect = photoHeight / photoWidth

  const syncScale = useCallback(() => {
    const stage = stageRef.current
    if (stage) setStageScale(stage.scaleX())
  }, [])

  const clampStage = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const { width, height } = viewportRef.current
    clampStagePosition(stage, width, height, photoWidth, photoHeight)
    stage.batchDraw()
  }, [photoWidth, photoHeight])

  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width
      const maxHeight = Math.min(window.innerHeight * 0.65, width * aspect)
      setViewport({ width, height: maxHeight })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [aspect])

  const fitView = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const view = fitPhotoView(
      { width: viewport.width, height: viewport.height },
      { width: photoWidth, height: photoHeight },
    )
    stage.scale({ x: view.scale, y: view.scale })
    stage.position({ x: view.x, y: view.y })
    stage.batchDraw()
    syncScale()
  }, [photoWidth, photoHeight, viewport.width, viewport.height, syncScale])

  useEffect(() => {
    fitView()
  }, [fitView])

  const zoomIn = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    zoomStageAtCenter(stage, viewport.width, viewport.height, 1.4)
    clampStagePosition(stage, viewport.width, viewport.height, photoWidth, photoHeight)
    syncScale()
  }, [photoWidth, photoHeight, viewport.width, viewport.height, syncScale])

  const zoomOut = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    zoomStageAtCenter(stage, viewport.width, viewport.height, 1 / 1.4)
    clampStagePosition(stage, viewport.width, viewport.height, photoWidth, photoHeight)
    syncScale()
  }, [photoWidth, photoHeight, viewport.width, viewport.height, syncScale])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function onWheel(e: WheelEvent) {
      const stage = stageRef.current
      const containerEl = containerRef.current
      if (!stage || !containerEl) return

      const rect = containerEl.getBoundingClientRect()
      if (!isClientPointInRect(e.clientX, e.clientY, rect)) return

      if (
        !isClientPointOverImage(
          e.clientX,
          e.clientY,
          rect,
          stage,
          photoWidth,
          photoHeight,
        )
      ) {
        return
      }

      if (
        !canWheelPanStageY(
          stage,
          viewportRef.current.height,
          photoHeight,
          e.deltaY,
        )
      ) {
        return
      }

      e.preventDefault()
      stage.position({
        x: stage.x(),
        y: stage.y() - e.deltaY,
      })
      clampStagePosition(
        stage,
        viewportRef.current.width,
        viewportRef.current.height,
        photoWidth,
        photoHeight,
      )
      stage.batchDraw()
    }

    container.addEventListener('wheel', onWheel, { passive: false, capture: true })

    return () => {
      container.removeEventListener('wheel', onWheel, { capture: true })
    }
  }, [photoWidth, photoHeight])

  const imagePointAt = useCallback(
    (stagePoint: Point): Point | null => {
      const stage = stageRef.current
      if (!stage) return null
      const point = viewToImage({ scale: stage.scaleX(), x: stage.x(), y: stage.y() }, stagePoint)
      return {
        x: Math.max(0, Math.min(photoWidth, point.x)),
        y: Math.max(0, Math.min(photoHeight, point.y)),
      }
    },
    [photoWidth, photoHeight],
  )

  const handleTouch = useEffectEvent((e: TouchEvent) => {
    const stage = stageRef.current
    if (!stage) return
    const origin = stage.content.getBoundingClientRect()
    const toStage = (touch: Touch): Point => ({
      x: touch.clientX - origin.left,
      y: touch.clientY - origin.top,
    })
    const startPinch = (touches: TouchList) => {
      for (const node of stage.find((n: Konva.Node) => n.isDragging())) node.stopDrag()
      gestureRef.current = {
        kind: 'pinching',
        startView: { scale: stage.scaleX(), x: stage.x(), y: stage.y() },
        from: [toStage(touches[0]), toStage(touches[1])],
      }
    }
    const gesture = gestureRef.current

    if (e.type === 'touchstart') {
      if (e.touches.length >= 2) {
        e.preventDefault()
        e.stopPropagation()
        startPinch(e.touches)
        return
      }
      const hit = stage.getIntersection(toStage(e.touches[0]))
      gestureRef.current = hit?.hasName(VERTEX_HANDLE_NAME)
        ? { kind: 'dragging-handle' }
        : { kind: 'pending-tap', start: clientPoint(e.touches[0]) }
      return
    }

    if (e.type === 'touchmove') {
      if (gesture.kind === 'pinching' && e.touches.length >= 2) {
        e.preventDefault()
        e.stopPropagation()
        const view = clampView(
          pinchView(gesture.startView, gesture.from, [toStage(e.touches[0]), toStage(e.touches[1])]),
          viewportRef.current,
          { width: photoWidth, height: photoHeight },
        )
        stage.scale({ x: view.scale, y: view.scale })
        stage.position({ x: view.x, y: view.y })
        stage.batchDraw()
        setStageScale(view.scale)
      } else if (gesture.kind === 'pinching' || gesture.kind === 'pinch-ending') {
        e.preventDefault()
        e.stopPropagation()
      } else if (gesture.kind === 'pending-tap') {
        const now = clientPoint(e.touches[0])
        const moved = Math.hypot(now.x - gesture.start.x, now.y - gesture.start.y)
        if (moved > STAGE_DRAG_DISTANCE) gestureRef.current = { kind: 'scrolling' }
      }
      return
    }

    if (gesture.kind === 'pinching' || gesture.kind === 'pinch-ending') {
      e.preventDefault()
      if (e.touches.length >= 2) startPinch(e.touches)
      else gestureRef.current = e.touches.length === 1 ? { kind: 'pinch-ending' } : { kind: 'idle' }
      return
    }
    if (e.touches.length > 0) return
    if (gesture.kind === 'pending-tap' && e.type === 'touchend') {
      // Cancelling touchend stops the compatibility mouse events, so Konva sees no click.
      e.preventDefault()
      // iOS Safari may stop sending touchmove once it scrolls natively, so a swipe can end here.
      const end = clientPoint(e.changedTouches[0])
      if (Math.hypot(end.x - gesture.start.x, end.y - gesture.start.y) <= STAGE_DRAG_DISTANCE) {
        const point = imagePointAt(toStage(e.changedTouches[0]))
        if (point) onBackgroundTap(point)
      }
    }
    gestureRef.current = { kind: 'idle' }
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const listener = (e: TouchEvent) => handleTouch(e)
    const types = ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const
    for (const type of types) {
      container.addEventListener(type, listener, { passive: false, capture: true })
    }
    return () => {
      for (const type of types) container.removeEventListener(type, listener, { capture: true })
    }
  }, [])

  const handleStagePointerDown = useCallback(() => {
    wasStageDraggedRef.current = false
  }, [])

  const handleStageDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const stage = stageRef.current
      const isMouse = e.evt instanceof MouseEvent
      if (!stage || !isMouse || !isPointerOverImage(stage, photoWidth, photoHeight)) {
        e.target.stopDrag()
        return
      }
      wasStageDraggedRef.current = false
    },
    [photoWidth, photoHeight],
  )

  const handleStageDragMove = useCallback(() => {
    clampStage()
  }, [clampStage])

  const handleStageDragEnd = useCallback(() => {
    clampStage()
    wasStageDraggedRef.current = true
    syncScale()
  }, [clampStage, syncScale])

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (wasStageDraggedRef.current) return
    const className = e.target.getClassName()
    if (className !== 'Image' && className !== 'Stage') return
    const pointer = stageRef.current?.getPointerPosition()
    const point = pointer && imagePointAt(pointer)
    if (point) onBackgroundTap(point)
  }

  return {
    containerRef,
    stageRef,
    viewport,
    stageScale,
    fitView,
    zoomIn,
    zoomOut,
    stageProps: {
      draggable: true,
      dragDistance: STAGE_DRAG_DISTANCE,
      onPointerDown: handleStagePointerDown,
      onDragStart: handleStageDragStart,
      onDragMove: handleStageDragMove,
      onDragEnd: handleStageDragEnd,
      onClick: handleStageClick,
    },
  }
}
