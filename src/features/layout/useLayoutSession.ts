import { useEffect, useReducer, useRef, useState } from 'react'
import { createLayoutSession } from '../../lib/layout/session/createLayoutSession'
import type {
  LayoutPersistencePort,
  LayoutSession,
  LayoutSessionConfig,
} from '../../lib/layout/session/types'
import type { Layout } from '../../types'
import { sanitizePlacedPieces } from '../../lib/nesting/stackLayout'
import {
  defaultLayoutPersistence,
  layoutFromSnapshot,
} from './persistence/defaultLayoutPersistence'

export type UseLayoutSessionOptions = LayoutSessionConfig & {
  persistence?: LayoutPersistencePort
}

export function useLayoutSession(options: UseLayoutSessionOptions) {
  const {
    projectId,
    pieces,
    fabricWidthCm,
    fabricHeightCm,
    cuttingGapCm,
    savedLayout,
    persistence = defaultLayoutPersistence,
  } = options

  const bootstrapLayoutRef = useRef<Layout | null | undefined>(undefined)
  const [hydrationGeneration, setHydrationGeneration] = useState(0)

  if (bootstrapLayoutRef.current === undefined) {
    bootstrapLayoutRef.current = savedLayout
  }

  useEffect(() => {
    if (bootstrapLayoutRef.current === null && savedLayout) {
      bootstrapLayoutRef.current = savedLayout
      setHydrationGeneration((n) => n + 1)
    }
  }, [savedLayout])

  const bootstrapLayout = bootstrapLayoutRef.current ?? null

  const sessionRef = useRef<LayoutSession>(
    createLayoutSession(
      {
        projectId,
        pieces,
        fabricWidthCm,
        fabricHeightCm,
        cuttingGapCm,
        savedLayout: bootstrapLayout,
      },
      persistence,
    ),
  )
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(320)

  const piecesKey = pieces.map((p) => p.id).join('\0')

  useEffect(() => {
    const prev = sessionRef.current.getSnapshot()
    const carriedLayout = layoutFromSnapshot(
      sanitizePlacedPieces(prev.placedPieces, pieces),
      fabricWidthCm,
      fabricHeightCm,
      cuttingGapCm,
    )

    const savedForSession =
      carriedLayout.placedPieces.length > 0 ? carriedLayout : bootstrapLayoutRef.current ?? null

    const session = createLayoutSession(
      {
        projectId,
        pieces,
        fabricWidthCm,
        fabricHeightCm,
        cuttingGapCm,
        savedLayout: savedForSession,
      },
      persistence,
    )

    sessionRef.current = session
    const unsub = session.subscribe(() => rerender())
    rerender()
    return unsub
    // savedLayout is bootstrap-only; persist updates must not recreate the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, fabricWidthCm, fabricHeightCm, cuttingGapCm, piecesKey, hydrationGeneration])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const snapshot = sessionRef.current.getSnapshot()
  const viewport = sessionRef.current.viewport(containerWidth)

  return {
    ...snapshot,
    ...sessionRef.current.actions,
    viewport,
    containerRef,
    isBusy:
      snapshot.status.kind === 'nesting' ||
      snapshot.status.kind === 'persisting' ||
      snapshot.status.kind === 'evaluating' ||
      snapshot.status.kind === 'checking',
    isNesting: snapshot.status.kind === 'nesting',
  }
}
