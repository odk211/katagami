import { useCallback, useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import type { Point } from '../types'
import {
  STAGE_DRAG_DISTANCE,
  canWheelPanStageY,
  clampStagePosition,
  fitStageToPhoto,
  isClientPointInRect,
  isClientPointOverImage,
  isPointerOverImage,
  pointerToImage,
  zoomStageAtCenter,
} from '../lib/canvas/stageTransform'

export function useZoomablePhotoStage(photoWidth: number, photoHeight: number) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const wasStageDraggedRef = useRef(false)
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
    fitStageToPhoto(stage, photoWidth, viewport.width)
    clampStagePosition(stage, viewport.width, viewport.height, photoWidth, photoHeight)
    syncScale()
  }, [photoWidth, photoHeight, viewport.width, viewport.height, syncScale])

  useEffect(() => {
    fitView()
  }, [fitView, viewport.width])

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

  const handleStagePointerDown = useCallback(() => {
    wasStageDraggedRef.current = false
  }, [])

  const handleStageDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const stage = stageRef.current
      if (!stage || !isPointerOverImage(stage, photoWidth, photoHeight)) {
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

  const getImagePoint = useCallback((): Point | null => {
    const stage = stageRef.current
    if (!stage) return null
    const point = pointerToImage(stage)
    if (!point) return null
    return {
      x: Math.max(0, Math.min(photoWidth, point.x)),
      y: Math.max(0, Math.min(photoHeight, point.y)),
    }
  }, [photoWidth, photoHeight])

  return {
    containerRef,
    stageRef,
    viewport,
    stageScale,
    stageDraggable: true,
    stageDragDistance: STAGE_DRAG_DISTANCE,
    wasStageDraggedRef,
    fitView,
    zoomIn,
    zoomOut,
    handleStagePointerDown,
    handleStageDragStart,
    handleStageDragMove,
    handleStageDragEnd,
    syncScale,
    getImagePoint,
  }
}
