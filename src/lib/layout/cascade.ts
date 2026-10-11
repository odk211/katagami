import type { LayoutProject, PatternProject, PlacedPiece } from '../../types'

export function prunePlacedPieces(
  placedPieces: PlacedPiece[],
  validInstanceKeys: Set<string>,
): PlacedPiece[] {
  return placedPieces.filter((p) => validInstanceKeys.has(p.instanceKey))
}

export function createPatternProject(name: string, now = Date.now()): PatternProject {
  return {
    id: crypto.randomUUID(),
    name,
    kind: 'pattern',
    createdAt: now,
    updatedAt: now,
  }
}

export function createLayoutProject(name: string, now = Date.now()): LayoutProject {
  return {
    id: crypto.randomUUID(),
    name,
    kind: 'layout',
    patternProjectIds: [],
    fabricWidthCm: null,
    fabricHeightCm: null,
    cuttingGapCm: 1,
    layout: null,
    createdAt: now,
    updatedAt: now,
  }
}

export function remapSlotsAfterRemoval(
  patternProjectIds: string[],
  removedPatternProjectId: string,
): { newIds: string[]; slotMap: Map<number, number> } {
  const newIds: string[] = []
  const slotMap = new Map<number, number>()
  patternProjectIds.forEach((id, oldSlot) => {
    if (id === removedPatternProjectId) return
    slotMap.set(oldSlot, newIds.length)
    newIds.push(id)
  })
  return { newIds, slotMap }
}

export function remapPlacedPieces(
  placedPieces: PlacedPiece[],
  slotMap: Map<number, number>,
): PlacedPiece[] {
  return placedPieces
    .filter((p) => slotMap.has(p.slotIndex))
    .map((p) => {
      const slotIndex = slotMap.get(p.slotIndex)!
      return {
        ...p,
        slotIndex,
        instanceKey: `${slotIndex}:${p.pieceId}`,
      }
    })
}
