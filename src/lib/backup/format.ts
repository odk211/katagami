import type {
  Calibration,
  Layout,
  Photo,
  Piece,
  PieceCutMode,
  PlacedPiece,
  Point,
  Project,
} from '../../types'
import { isPatternProject } from '../../types'

export type KatagamiBackup = {
  format: 'katagami-backup'
  version: 1
  exportedAt: number
  projects: Project[]
  photos: Photo[]
  pieces: Piece[]
}

type BackupTable = 'projects' | 'photos' | 'pieces'

export type BackupError =
  | { kind: 'notJson' }
  | { kind: 'notBackup' }
  | { kind: 'unsupportedVersion'; version: unknown }
  | { kind: 'invalidRecord'; table: BackupTable; index: number }
  | { kind: 'brokenReference'; table: 'photos' | 'pieces'; id: string }

export type ParseBackupResult =
  | { ok: true; backup: KatagamiBackup }
  | { ok: false; error: BackupError }

type Fields = Record<string, unknown>

const isObject = (v: unknown): v is Fields =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isString = (v: unknown): v is string => typeof v === 'string'
const isNumberOrNull = (v: unknown) => v === null || isNumber(v)
const isArrayOf = <T>(v: unknown, item: (x: unknown) => x is T): v is T[] =>
  Array.isArray(v) && v.every(item)

const isPoint = (v: unknown): v is Point => isObject(v) && isNumber(v.x) && isNumber(v.y)

const isCalibration = (v: unknown): v is Calibration =>
  isObject(v) &&
  isPoint(v.pointA) &&
  isPoint(v.pointB) &&
  isNumber(v.lengthCm) &&
  isNumber(v.pixelsPerCm)

const isPlacedPiece = (v: unknown): v is PlacedPiece =>
  isObject(v) &&
  isString(v.instanceKey) &&
  isString(v.pieceId) &&
  isNumber(v.slotIndex) &&
  isNumber(v.x) &&
  isNumber(v.y) &&
  isNumber(v.rotation)

const isLayout = (v: unknown): v is Layout =>
  isObject(v) &&
  isArrayOf(v.placedPieces, isPlacedPiece) &&
  isNumber(v.fabricWidthCm) &&
  isNumber(v.fabricHeightCm) &&
  isNumber(v.cuttingGapCm)

const hasProjectBase = (v: Fields) =>
  isString(v.id) && isString(v.name) && isNumber(v.createdAt) && isNumber(v.updatedAt)

const projectFieldsByKind: Record<Project['kind'], (v: Fields) => boolean> = {
  pattern: hasProjectBase,
  layout: (v) =>
    hasProjectBase(v) &&
    isArrayOf(v.patternProjectIds, isString) &&
    isNumberOrNull(v.fabricWidthCm) &&
    isNumberOrNull(v.fabricHeightCm) &&
    isNumber(v.cuttingGapCm) &&
    (v.layout === null || isLayout(v.layout)),
}

const isProject = (v: unknown): v is Project =>
  isObject(v) &&
  Object.hasOwn(projectFieldsByKind, v.kind as string) &&
  projectFieldsByKind[v.kind as Project['kind']](v)

const isPhoto = (v: unknown): v is Photo =>
  isObject(v) &&
  isString(v.id) &&
  isString(v.projectId) &&
  isString(v.imageDataUrl) &&
  v.imageDataUrl.startsWith('data:image/') &&
  isNumber(v.width) &&
  isNumber(v.height) &&
  (v.calibration === null || isCalibration(v.calibration)) &&
  isNumber(v.createdAt)

const cutModes: readonly PieceCutMode[] = ['normal', 'foldCenter']

const isPiece = (v: unknown): v is Piece =>
  isObject(v) &&
  isString(v.id) &&
  isString(v.photoId) &&
  isString(v.name) &&
  isArrayOf(v.vertices, isPoint) &&
  cutModes.includes(v.cutMode as PieceCutMode) &&
  (v.mirrorSourceId === undefined || isString(v.mirrorSourceId)) &&
  isNumber(v.createdAt)

const recordChecks = {
  projects: isProject,
  photos: isPhoto,
  pieces: isPiece,
} satisfies Record<BackupTable, (v: unknown) => boolean>

function findInvalidRecord(raw: Record<BackupTable, unknown[]>): BackupError | null {
  for (const table of Object.keys(recordChecks) as BackupTable[]) {
    const index = raw[table].findIndex((record) => !recordChecks[table](record))
    if (index !== -1) return { kind: 'invalidRecord', table, index }
  }
  return null
}

function findBrokenReference(backup: KatagamiBackup): BackupError | null {
  const patternIds = new Set(backup.projects.filter(isPatternProject).map((p) => p.id))
  const orphanPhoto = backup.photos.find((photo) => !patternIds.has(photo.projectId))
  if (orphanPhoto) return { kind: 'brokenReference', table: 'photos', id: orphanPhoto.id }

  const photoIds = new Set(backup.photos.map((photo) => photo.id))
  const orphanPiece = backup.pieces.find((piece) => !photoIds.has(piece.photoId))
  if (orphanPiece) return { kind: 'brokenReference', table: 'pieces', id: orphanPiece.id }

  return null
}

export function parseBackup(text: string): ParseBackupResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: { kind: 'notJson' } }
  }

  if (!isObject(raw) || raw.format !== 'katagami-backup') {
    return { ok: false, error: { kind: 'notBackup' } }
  }
  if (raw.version !== 1) {
    return { ok: false, error: { kind: 'unsupportedVersion', version: raw.version } }
  }
  const { exportedAt, projects, photos, pieces } = raw
  if (
    !isNumber(exportedAt) ||
    !Array.isArray(projects) ||
    !Array.isArray(photos) ||
    !Array.isArray(pieces)
  ) {
    return { ok: false, error: { kind: 'notBackup' } }
  }

  const invalid = findInvalidRecord({ projects, photos, pieces })
  if (invalid) return { ok: false, error: invalid }

  const backup: KatagamiBackup = {
    format: 'katagami-backup',
    version: 1,
    exportedAt,
    projects: projects as Project[],
    photos: photos as Photo[],
    pieces: pieces as Piece[],
  }
  const broken = findBrokenReference(backup)
  if (broken) return { ok: false, error: broken }

  return { ok: true, backup }
}

const tableLabels: Record<BackupTable, string> = {
  projects: 'プロジェクト',
  photos: '写真',
  pieces: 'パーツ',
}

const errorMessages: {
  [K in BackupError['kind']]: (error: Extract<BackupError, { kind: K }>) => string
} = {
  notJson: () => 'ファイルを読み取れませんでした。JSON形式のファイルを選んでください。',
  notBackup: () => '型紙チェックのバックアップファイルではありません。',
  unsupportedVersion: (e) =>
    `このバックアップの形式（バージョン ${String(e.version)}）には対応していません。`,
  invalidRecord: (e) =>
    `バックアップの${tableLabels[e.table]}（${e.index + 1}件目）の内容が壊れています。`,
  brokenReference: (e) =>
    `バックアップの${tableLabels[e.table]}（ID: ${e.id}）の参照先がファイルに含まれていません。`,
}

export function backupErrorMessage(error: BackupError): string {
  const format = errorMessages[error.kind] as (e: BackupError) => string
  return format(error)
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export function backupFileName(now: number): string {
  const d = new Date(now)
  const date = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
  const time = `${pad2(d.getHours())}${pad2(d.getMinutes())}`
  return `katagami-${date}-${time}.json`
}

export function summarizeBackup(backup: KatagamiBackup) {
  const patternProjects = backup.projects.filter(isPatternProject).length
  return { patternProjects, layoutProjects: backup.projects.length - patternProjects }
}
