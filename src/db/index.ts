import Dexie, { type EntityTable } from 'dexie'
import type { Photo, Piece, Project, LayoutProject, PatternProject, PlacedPiece } from '../types'
import { isLayoutProject } from '../types'
import { expandPatternSlots } from '../lib/layout/expandPieces'
import { buildSlotLegend } from '../lib/layout/slotLegend'
import {
  prunePlacedPieces,
  remapPlacedPieces,
  remapSlotsAfterRemoval,
} from '../lib/layout/cascade'
import { isLegacyStagingPlacement } from '../lib/nesting/stackLayout'

class KatagamiDB extends Dexie {
  projects!: EntityTable<Project, 'id'>
  photos!: EntityTable<Photo, 'id'>
  pieces!: EntityTable<Piece, 'id'>

  constructor() {
    super('katagami')
    this.version(1).stores({
      projects: 'id, name, updatedAt',
      photos: 'id, projectId, createdAt',
      pieces: 'id, photoId, projectId',
    })
    this.version(2)
      .stores({
        projects: 'id, name, updatedAt',
        photos: 'id, projectId, createdAt',
        pieces: 'id, photoId, projectId',
      })
      .upgrade(async (tx) => {
        const pieces = await tx.table('pieces').toArray()
        for (const piece of pieces) {
          if (piece.cutMode === undefined) {
            await tx.table('pieces').update(piece.id, { cutMode: 'normal' })
          }
        }
      })
    this.version(3)
      .stores({
        projects: 'id, name, updatedAt',
        photos: 'id, projectId, createdAt',
        pieces: 'id, photoId, projectId',
      })
      .upgrade(async (tx) => {
        const pieces = await tx.table('pieces').toArray()
        for (const piece of pieces) {
          const legacy = piece as Piece & { foldEdgeIndex?: number }
          if (!('foldEdgeIndex' in legacy)) continue
          const next = { ...legacy } as Piece & { foldEdgeIndex?: number }
          delete next.foldEdgeIndex
          await tx.table('pieces').update(piece.id, next)
        }
      })
    this.version(4)
      .stores({
        projects: 'id, kind, name, updatedAt',
        photos: 'id, projectId, createdAt',
        pieces: 'id, photoId, projectId',
      })
      .upgrade(async (tx) => {
        const projects = await tx.table('projects').toArray()
        for (const raw of projects) {
          const legacy = raw as {
            id: string
            name: string
            createdAt: number
            updatedAt: number
            kind?: string
          }
          if (legacy.kind === 'pattern' || legacy.kind === 'layout') continue

          const pattern: PatternProject = {
            id: legacy.id,
            name: legacy.name,
            kind: 'pattern',
            createdAt: legacy.createdAt,
            updatedAt: legacy.updatedAt,
          }
          await tx.table('projects').put(pattern)
        }
      })
    this.version(5)
      .stores({
        projects: 'id, kind, name, updatedAt',
        photos: 'id, projectId, createdAt',
        pieces: 'id, photoId, projectId',
      })
      .upgrade(async (tx) => {
        const projects = await tx.table('projects').toArray()
        for (const raw of projects) {
          if (raw.kind !== 'layout' || !raw.layout) continue

          const layout = raw.layout
          const seen = new Set<string>()
          const placedPieces = layout.placedPieces.filter((placed: PlacedPiece) => {
            if (seen.has(placed.instanceKey)) return false
            if (isLegacyStagingPlacement(placed, layout.fabricHeightCm)) return false
            seen.add(placed.instanceKey)
            return true
          })

          if (placedPieces.length === layout.placedPieces.length) continue

          await tx.table('projects').update(raw.id, {
            layout: { ...raw.layout, placedPieces },
            updatedAt: Date.now(),
          })
        }
      })
  }
}

export const db = new KatagamiDB()

export async function getPiecesForPatternProject(projectId: string): Promise<Piece[]> {
  const photos = await db.photos.where('projectId').equals(projectId).toArray()
  const photoIds = photos.map((p) => p.id)
  if (photoIds.length === 0) return []
  return db.pieces.where('photoId').anyOf(photoIds).toArray()
}

export async function getPatternProjectWithDetails(projectId: string) {
  const project = await db.projects.get(projectId)
  if (!project || project.kind !== 'pattern') return null

  const photos = await db.photos.where('projectId').equals(projectId).sortBy('createdAt')
  const pieces = await getPiecesForPatternProject(projectId)

  return { project, photos, pieces }
}

export async function getLayoutProjectWithDetails(projectId: string) {
  const project = await db.projects.get(projectId)
  if (!project || !isLayoutProject(project)) return null

  const uniqueIds = [...new Set(project.patternProjectIds)]
  const patternProjects =
    uniqueIds.length > 0
      ? (await db.projects.where('id').anyOf(uniqueIds).toArray()).filter(
          (p): p is PatternProject => p.kind === 'pattern',
        )
      : []

  const piecesByProjectId = new Map<string, Piece[]>()
  for (const patternProject of patternProjects) {
    piecesByProjectId.set(patternProject.id, await getPiecesForPatternProject(patternProject.id))
  }

  const expandedPieces = expandPatternSlots(project.patternProjectIds, piecesByProjectId)
  const slotLegend = buildSlotLegend(project.patternProjectIds, patternProjects)
  const validKeys = new Set(expandedPieces.map((p) => p.instanceKey))
  const prunedLayout = project.layout
    ? {
        ...project.layout,
        placedPieces: prunePlacedPieces(project.layout.placedPieces, validKeys),
      }
    : null

  if (
    prunedLayout &&
    project.layout &&
    prunedLayout.placedPieces.length !== project.layout.placedPieces.length
  ) {
    await db.projects.update(projectId, {
      layout: prunedLayout,
      updatedAt: Date.now(),
    } as Partial<LayoutProject>)
  }

  return {
    project: prunedLayout ? { ...project, layout: prunedLayout } : project,
    patternProjects,
    expandedPieces,
    slotLegend,
  }
}

/** @deprecated Use getPatternProjectWithDetails or getLayoutProjectWithDetails */
export async function getProjectWithDetails(projectId: string) {
  return getPatternProjectWithDetails(projectId)
}

export async function deletePatternProject(projectId: string) {
  const photos = await db.photos.where('projectId').equals(projectId).toArray()
  const photoIds = photos.map((p) => p.id)

  await db.transaction('rw', db.projects, db.photos, db.pieces, async () => {
    if (photoIds.length > 0) {
      await db.pieces.where('photoId').anyOf(photoIds).delete()
    }
    await db.photos.where('projectId').equals(projectId).delete()
    await db.projects.delete(projectId)
  })

  await cascadeRemovePatternProject(projectId)
}

async function cascadeRemovePatternProject(deletedPatternProjectId: string) {
  const layouts = (await db.projects.toArray()).filter(isLayoutProject)
  const now = Date.now()

  await db.transaction('rw', db.projects, async () => {
    for (const layout of layouts) {
      if (!layout.patternProjectIds.includes(deletedPatternProjectId)) continue

      const { newIds, slotMap } = remapSlotsAfterRemoval(
        layout.patternProjectIds,
        deletedPatternProjectId,
      )
      const placedPieces = layout.layout
        ? remapPlacedPieces(layout.layout.placedPieces, slotMap)
        : []
      const nextLayout = layout.layout ? { ...layout.layout, placedPieces } : null

      await db.projects.update(layout.id, {
        patternProjectIds: newIds,
        layout: nextLayout,
        updatedAt: now,
      } as Partial<LayoutProject>)
    }
  })
}

export async function cascadeRemovePiece(pieceId: string) {
  const layouts = (await db.projects.toArray()).filter(isLayoutProject)
  const now = Date.now()

  await db.transaction('rw', db.projects, async () => {
    for (const layout of layouts) {
      if (!layout.layout) continue
      const placedPieces = layout.layout.placedPieces.filter((p) => p.pieceId !== pieceId)
      if (placedPieces.length === layout.layout.placedPieces.length) continue

      await db.projects.update(layout.id, {
        layout: { ...layout.layout, placedPieces },
        updatedAt: now,
      } as Partial<LayoutProject>)
    }
  })
}

export async function deleteLayoutProject(projectId: string) {
  await db.projects.delete(projectId)
}

/** @deprecated Use deletePatternProject or deleteLayoutProject */
export async function deleteProject(projectId: string) {
  const project = await db.projects.get(projectId)
  if (!project) return
  if (isLayoutProject(project)) {
    await deleteLayoutProject(projectId)
  } else {
    await deletePatternProject(projectId)
  }
}

export async function listPatternProjects(): Promise<PatternProject[]> {
  return (await db.projects.toArray()).filter(
    (p): p is PatternProject => p.kind === 'pattern',
  )
}

export async function listLayoutProjects(): Promise<LayoutProject[]> {
  return (await db.projects.toArray()).filter(isLayoutProject)
}
