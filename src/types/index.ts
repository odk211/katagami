export type Point = { x: number; y: number }

export type Polygon = Point[]

export type Calibration = {
  pointA: Point
  pointB: Point
  lengthCm: number
  pixelsPerCm: number
}

export type PieceCutMode = 'normal' | 'foldCenter'

export type Piece = {
  id: string
  photoId: string
  name: string
  /** Traced vertices in cm. foldCenter: 点1–2=折り線, 点3..n=外周, 点n→点1は暗黙の閉じ辺 */
  vertices: Polygon
  cutMode: PieceCutMode
  /** Set on mirror-copy pieces; references the source piece id */
  mirrorSourceId?: string
  createdAt: number
}

export type Photo = {
  id: string
  projectId: string
  imageDataUrl: string
  width: number
  height: number
  calibration: Calibration | null
  createdAt: number
}

export type PlacedPiece = {
  instanceKey: string
  pieceId: string
  slotIndex: number
  x: number
  y: number
  rotation: number
}

export type Layout = {
  placedPieces: PlacedPiece[]
  fabricWidthCm: number
  fabricHeightCm: number
  cuttingGapCm: number
}

export type PatternProject = {
  id: string
  name: string
  kind: 'pattern'
  createdAt: number
  updatedAt: number
}

export type LayoutProject = {
  id: string
  name: string
  kind: 'layout'
  patternProjectIds: string[]
  fabricWidthCm: number | null
  fabricHeightCm: number | null
  cuttingGapCm: number
  layout: Layout | null
  createdAt: number
  updatedAt: number
}

export type Project = PatternProject | LayoutProject

export function isPatternProject(project: Project): project is PatternProject {
  return project.kind === 'pattern'
}

export function isLayoutProject(project: Project): project is LayoutProject {
  return project.kind === 'layout'
}

export type FitResult = {
  fits: boolean
  utilizationPercent: number
  hasOverlap: boolean
  hasOverflow: boolean
  shortageWidthCm: number | null
  shortageHeightCm: number | null
}

export type PatternStep = 'photos' | 'calibration' | 'trace'

export type LayoutStep = 'patterns' | 'layout' | 'report'

/** @deprecated Use PatternStep or LayoutStep */
export type ProjectStep = PatternStep | LayoutStep
