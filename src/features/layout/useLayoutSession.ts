import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createLayoutSession } from '../../lib/layout/session/createLayoutSession'
import type {
  LayoutPersistencePort,
  LayoutSessionConfig,
} from '../../lib/layout/session/types'
import { defaultLayoutPersistence } from './persistence/defaultLayoutPersistence'

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

  // savedLayout is left out: every persist writes it back to the store, so including it would
  // recreate the session (and drop the selection) after each edit.
  const key = [projectId, fabricWidthCm, fabricHeightCm, cuttingGapCm, ...pieces.map((p) => p.id)]
    .join('\0')
  const create = () => ({
    key,
    session: createLayoutSession(
      { projectId, pieces, fabricWidthCm, fabricHeightCm, cuttingGapCm, savedLayout },
      persistence,
    ),
  })
  const [current, setCurrent] = useState(create)
  if (current.key !== key) setCurrent(create())
  const { session } = current

  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(320)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return {
    ...snapshot,
    ...session.actions,
    viewport: session.viewport(containerWidth),
    containerRef,
    isBusy:
      snapshot.status.kind === 'nesting' ||
      snapshot.status.kind === 'persisting' ||
      snapshot.status.kind === 'evaluating' ||
      snapshot.status.kind === 'checking',
    isNesting: snapshot.status.kind === 'nesting',
  }
}
