import type { FitResult, Layout, Piece, PlacedPiece } from '../../../types'

export type LayoutIssues = {
  hasOverlap: boolean
  hasOverflow: boolean
}

export type LayoutSessionStatus =
  | { kind: 'idle' }
  | { kind: 'nesting' }
  | { kind: 'persisting' }
  | { kind: 'evaluating' }
  | { kind: 'checking' }

export type LayoutSessionSnapshot = {
  layout: Layout
  pieces: Piece[]
  placedPieces: PlacedPiece[]
  unplacedPieces: Piece[]
  issues: LayoutIssues
  selectedInstanceKey: string | null
  status: LayoutSessionStatus
}

export type LayoutSessionConfig = {
  projectId: string
  pieces: Piece[]
  fabricWidthCm: number
  fabricHeightCm: number
  cuttingGapCm: number
  savedLayout: Layout | null
}

export interface LayoutPersistencePort {
  save(projectId: string, layout: Layout): Promise<void>
}

export type LayoutSessionActions = {
  placeFromList: (piece: Piece) => Promise<void>
  unplace: (instanceKey: string) => Promise<void>
  move: (instanceKey: string, position: { x: number; y: number }) => Promise<void>
  rotate: (instanceKey: string, deltaDeg: number) => Promise<void>
  select: (instanceKey: string | null) => void
  autoNestRemaining: () => Promise<void>
  evaluateFit: (options?: { includeShortage?: boolean }) => Promise<FitResult>
}

export type LayoutViewport = {
  scale: number
  stageWidthPx: number
  stageHeightPx: number
}

export interface LayoutSession {
  /** Same object until the session notifies subscribers, as useSyncExternalStore requires. */
  getSnapshot(): LayoutSessionSnapshot
  subscribe(listener: () => void): () => void
  actions: LayoutSessionActions
  viewport(containerWidthPx: number): LayoutViewport
}
