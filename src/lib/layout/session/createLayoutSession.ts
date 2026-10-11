import type { FitResult, Layout, Piece, PlacedPiece } from '../../../types'
import { nestPieces } from '../../nesting/nest'
import {
  createPlacedPiece,
  findFirstOpenPosition,
  getUnplacedPieces,
} from '../../nesting/stackLayout'
import { computeLayoutIssues } from './issues'
import { evaluateLayoutFit } from './evaluateFit'
import { initialPlacedPieces } from './restore'
import type {
  LayoutIssues,
  LayoutPersistencePort,
  LayoutSession,
  LayoutSessionConfig,
  LayoutSessionSnapshot,
  LayoutSessionStatus,
} from './types'

const EMPTY_ISSUES: LayoutIssues = { hasOverlap: false, hasOverflow: false }

function buildLayout(
  placedPieces: PlacedPiece[],
  fabricWidthCm: number,
  fabricHeightCm: number,
  cuttingGapCm: number,
): Layout {
  return { placedPieces, fabricWidthCm, fabricHeightCm, cuttingGapCm }
}

export function createLayoutSession(
  config: LayoutSessionConfig,
  persistence: LayoutPersistencePort,
): LayoutSession {
  const listeners = new Set<() => void>()

  let placedPieces = initialPlacedPieces(
    config.savedLayout,
    config.pieces,
    config.fabricWidthCm,
    config.fabricHeightCm,
    config.cuttingGapCm,
  )
  let selectedInstanceKey: string | null = null
  let status: LayoutSessionStatus = { kind: 'idle' }
  let issues: LayoutIssues = EMPTY_ISSUES
  let issuesGeneration = 0

  function notify() {
    for (const listener of listeners) listener()
  }

  function setStatus(next: LayoutSessionStatus) {
    status = next
    notify()
  }

  function getSnapshot(): LayoutSessionSnapshot {
    return {
      layout: buildLayout(
        placedPieces,
        config.fabricWidthCm,
        config.fabricHeightCm,
        config.cuttingGapCm,
      ),
      pieces: config.pieces,
      placedPieces,
      unplacedPieces: getUnplacedPieces(config.pieces, placedPieces),
      issues,
      selectedInstanceKey,
      status,
    }
  }

  async function refreshIssues() {
    const generation = ++issuesGeneration
    setStatus({ kind: 'checking' })
    const next = await computeLayoutIssues(
      config.pieces,
      placedPieces,
      config.fabricWidthCm,
      config.fabricHeightCm,
      config.cuttingGapCm,
    )
    if (generation !== issuesGeneration) return
    issues = next
    setStatus({ kind: 'idle' })
  }

  async function persist(next: PlacedPiece[]) {
    setStatus({ kind: 'persisting' })
    const layout = buildLayout(
      next,
      config.fabricWidthCm,
      config.fabricHeightCm,
      config.cuttingGapCm,
    )
    await persistence.save(config.projectId, layout)
    setStatus({ kind: 'idle' })
  }

  async function applyPlaced(next: PlacedPiece[]) {
    placedPieces = next
    notify()
    void refreshIssues()
    await persist(next)
  }

  void refreshIssues()

  const actions = {
    async placeFromList(piece: Piece) {
      const placement = await findFirstOpenPosition(
        piece,
        placedPieces,
        config.pieces,
        config.fabricWidthCm,
        config.fabricHeightCm,
        config.cuttingGapCm,
      )
      const placed = createPlacedPiece(piece, placement.x, placement.y, placement.rotation)
      selectedInstanceKey = piece.id
      await applyPlaced([...placedPieces, placed])
    },

    async unplace(instanceKey: string) {
      selectedInstanceKey = null
      await applyPlaced(placedPieces.filter((p) => p.instanceKey !== instanceKey))
    },

    async move(instanceKey: string, position: { x: number; y: number }) {
      const next = placedPieces.map((p) =>
        p.instanceKey === instanceKey ? { ...p, x: position.x, y: position.y } : p,
      )
      await applyPlaced(next)
    },

    async rotate(instanceKey: string, deltaDeg: number) {
      const next = placedPieces.map((p) =>
        p.instanceKey === instanceKey
          ? { ...p, rotation: (p.rotation + deltaDeg + 360) % 360 }
          : p,
      )
      await applyPlaced(next)
    },

    select(instanceKey: string | null) {
      selectedInstanceKey = instanceKey
      notify()
    },

    async autoNestRemaining() {
      const unplaced = getUnplacedPieces(config.pieces, placedPieces)
      if (unplaced.length === 0) return

      setStatus({ kind: 'nesting' })
      try {
        const result = await nestPieces({
          pieces: unplaced,
          allPieces: config.pieces,
          fixedPlacements: placedPieces,
          fabricWidthCm: config.fabricWidthCm,
          fabricHeightCm: config.fabricHeightCm,
          cuttingGapCm: config.cuttingGapCm,
        })
        await applyPlaced([...placedPieces, ...result.placedPieces])
      } finally {
        if (status.kind === 'nesting') setStatus({ kind: 'idle' })
      }
    },

    async evaluateFit(options?: { includeShortage?: boolean }): Promise<FitResult> {
      setStatus({ kind: 'evaluating' })
      try {
        return await evaluateLayoutFit({
          pieces: config.pieces,
          placedPieces,
          fabricWidthCm: config.fabricWidthCm,
          fabricHeightCm: config.fabricHeightCm,
          cuttingGapCm: config.cuttingGapCm,
          includeShortage: options?.includeShortage,
        })
      } finally {
        setStatus({ kind: 'idle' })
      }
    },
  }

  return {
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    actions,
    viewport(containerWidthPx) {
      const scale = containerWidthPx / config.fabricWidthCm
      return {
        scale,
        stageWidthPx: containerWidthPx,
        stageHeightPx: config.fabricHeightCm * scale,
      }
    },
  }
}
