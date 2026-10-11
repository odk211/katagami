import { describe, it, expect } from 'vitest'
import {
  backupErrorMessage,
  backupFileName,
  parseBackup,
  summarizeBackup,
  type BackupError,
  type KatagamiBackup,
} from './format'

function validBackup(): KatagamiBackup {
  return {
    format: 'katagami-backup',
    version: 1,
    exportedAt: 1_760_000_000_000,
    projects: [
      { id: 'pat1', name: 'ブラウス', kind: 'pattern', createdAt: 1, updatedAt: 2 },
      {
        id: 'lay1',
        name: '配置',
        kind: 'layout',
        patternProjectIds: ['pat1', 'pat-not-in-file'],
        fabricWidthCm: 50,
        fabricHeightCm: null,
        cuttingGapCm: 1,
        layout: {
          placedPieces: [
            { instanceKey: '0:pc1', pieceId: 'pc1', slotIndex: 0, x: 1, y: 2, rotation: 90 },
          ],
          fabricWidthCm: 50,
          fabricHeightCm: 50,
          cuttingGapCm: 1,
        },
        createdAt: 3,
        updatedAt: 4,
      },
    ],
    photos: [
      {
        id: 'ph1',
        projectId: 'pat1',
        imageDataUrl: 'data:image/png;base64,AAAA',
        width: 960,
        height: 720,
        calibration: { pointA: { x: 0, y: 0 }, pointB: { x: 400, y: 0 }, lengthCm: 20, pixelsPerCm: 20 },
        createdAt: 5,
      },
      {
        id: 'ph2',
        projectId: 'pat1',
        imageDataUrl: 'data:image/jpeg;base64,BBBB',
        width: 10,
        height: 10,
        calibration: null,
        createdAt: 6,
      },
    ],
    pieces: [
      {
        id: 'pc1',
        photoId: 'ph1',
        name: '前身頃',
        vertices: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }],
        cutMode: 'normal',
        createdAt: 7,
      },
      {
        id: 'pc2',
        photoId: 'ph1',
        name: '前身頃（鏡像）',
        vertices: [{ x: 0, y: 0 }, { x: -20, y: 0 }, { x: -20, y: 20 }],
        cutMode: 'foldCenter',
        mirrorSourceId: 'pc1',
        createdAt: 8,
      },
    ],
  }
}

type Mutable = Record<string, unknown> & {
  projects: Record<string, unknown>[]
  photos: Record<string, unknown>[]
  pieces: Record<string, unknown>[]
}

function parseMutated(mutate: (b: Mutable) => void) {
  const raw = JSON.parse(JSON.stringify(validBackup())) as Mutable
  mutate(raw)
  return parseBackup(JSON.stringify(raw))
}

function errorOf(result: ReturnType<typeof parseBackup>): BackupError {
  if (result.ok) throw new Error('expected parse to fail')
  return result.error
}

describe('parseBackup', () => {
  it('round-trips a stringified backup', () => {
    const backup = validBackup()
    expect(parseBackup(JSON.stringify(backup))).toEqual({ ok: true, backup })
  })

  it('accepts a layout that references a pattern absent from the file', () => {
    expect(parseMutated((b) => (b.projects[1].patternProjectIds = ['gone'])).ok).toBe(true)
  })

  it('rejects text that is not JSON', () => {
    expect(errorOf(parseBackup('{"format":'))).toEqual({ kind: 'notJson' })
  })

  it.each([
    ['an array', '[]'],
    ['null', 'null'],
    ['a different format', JSON.stringify({ ...validBackup(), format: 'other-app' })],
    ['a missing table', JSON.stringify({ ...validBackup(), pieces: undefined })],
    ['a non-numeric exportedAt', JSON.stringify({ ...validBackup(), exportedAt: '2026' })],
  ])('rejects %s as notBackup', (_label, text) => {
    expect(errorOf(parseBackup(text))).toEqual({ kind: 'notBackup' })
  })

  it('rejects other versions and reports the version', () => {
    expect(errorOf(parseMutated((b) => (b.version = 2)))).toEqual({
      kind: 'unsupportedVersion',
      version: 2,
    })
  })

  it.each<[string, (b: Mutable) => void, BackupError]>([
    ['unknown project kind', (b) => (b.projects[0].kind = 'cutting'), { kind: 'invalidRecord', table: 'projects', index: 0 }],
    ['pattern without updatedAt', (b) => delete b.projects[0].updatedAt, { kind: 'invalidRecord', table: 'projects', index: 0 }],
    ['layout with non-string pattern id', (b) => (b.projects[1].patternProjectIds = [1]), { kind: 'invalidRecord', table: 'projects', index: 1 }],
    ['layout with string fabric width', (b) => (b.projects[1].fabricWidthCm = '50'), { kind: 'invalidRecord', table: 'projects', index: 1 }],
    ['layout without cuttingGapCm', (b) => delete b.projects[1].cuttingGapCm, { kind: 'invalidRecord', table: 'projects', index: 1 }],
    ['layout whose layout lacks cuttingGapCm', (b) => delete (b.projects[1].layout as Record<string, unknown>).cuttingGapCm, { kind: 'invalidRecord', table: 'projects', index: 1 }],
    ['layout with a malformed placed piece', (b) => ((b.projects[1].layout as { placedPieces: unknown[] }).placedPieces = [{ pieceId: 'pc1' }]), { kind: 'invalidRecord', table: 'projects', index: 1 }],
    ['photo with a non-data URL', (b) => (b.photos[1].imageDataUrl = 'https://example.com/a.png'), { kind: 'invalidRecord', table: 'photos', index: 1 }],
    ['photo with a non-image data URL', (b) => (b.photos[0].imageDataUrl = 'data:text/html,<p>'), { kind: 'invalidRecord', table: 'photos', index: 0 }],
    ['photo with string width', (b) => (b.photos[0].width = '960'), { kind: 'invalidRecord', table: 'photos', index: 0 }],
    ['photo with calibration missing pixelsPerCm', (b) => delete (b.photos[0].calibration as Record<string, unknown>).pixelsPerCm, { kind: 'invalidRecord', table: 'photos', index: 0 }],
    ['photo with undefined calibration', (b) => delete b.photos[1].calibration, { kind: 'invalidRecord', table: 'photos', index: 1 }],
    ['piece with a string coordinate', (b) => (b.pieces[0].vertices = [{ x: '0', y: 0 }]), { kind: 'invalidRecord', table: 'pieces', index: 0 }],
    ['piece with unknown cutMode', (b) => (b.pieces[1].cutMode = 'bias'), { kind: 'invalidRecord', table: 'pieces', index: 1 }],
    ['piece with numeric mirrorSourceId', (b) => (b.pieces[1].mirrorSourceId = 5), { kind: 'invalidRecord', table: 'pieces', index: 1 }],
  ])('rejects %s as invalidRecord', (_label, mutate, expected) => {
    expect(errorOf(parseMutated(mutate))).toEqual(expected)
  })

  it.each<[string, (b: Mutable) => void, BackupError]>([
    ['photo of a project not in the file', (b) => (b.photos[1].projectId = 'missing'), { kind: 'brokenReference', table: 'photos', id: 'ph2' }],
    ['photo attached to a layout project', (b) => (b.photos[0].projectId = 'lay1'), { kind: 'brokenReference', table: 'photos', id: 'ph1' }],
    ['piece of a photo not in the file', (b) => (b.pieces[1].photoId = 'missing'), { kind: 'brokenReference', table: 'pieces', id: 'pc2' }],
  ])('rejects %s as brokenReference', (_label, mutate, expected) => {
    expect(errorOf(parseMutated(mutate))).toEqual(expected)
  })
})

describe('backupErrorMessage', () => {
  it('names the table and the 1-based record number', () => {
    expect(backupErrorMessage({ kind: 'invalidRecord', table: 'photos', index: 1 })).toContain('写真（2件目）')
  })

  it('names the version it cannot read', () => {
    expect(backupErrorMessage({ kind: 'unsupportedVersion', version: 7 })).toContain('バージョン 7')
  })

  it('names the dangling record id', () => {
    expect(backupErrorMessage({ kind: 'brokenReference', table: 'pieces', id: 'pc9' })).toContain('pc9')
  })
})

describe('backupFileName', () => {
  it('uses zero-padded local date and time', () => {
    expect(backupFileName(new Date(2026, 0, 5, 9, 7, 59).getTime())).toBe('katagami-20260105-0907.json')
  })
})

describe('summarizeBackup', () => {
  it('counts projects by kind', () => {
    expect(summarizeBackup(validBackup())).toEqual({ patternProjects: 1, layoutProjects: 1 })
  })
})
