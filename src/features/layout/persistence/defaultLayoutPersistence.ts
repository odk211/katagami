import { db } from '../../../db'
import { useProjectStore } from '../../../store/projectStore'
import type { Layout, LayoutProject } from '../../../types'
import type { LayoutPersistencePort } from '../../../lib/layout/session/types'

export const defaultLayoutPersistence: LayoutPersistencePort = {
  async save(projectId, layout) {
    await db.projects.update(projectId, {
      layout,
      updatedAt: Date.now(),
    } as Partial<LayoutProject>)
    useProjectStore.getState().setLayout(layout)
  },
}

export const noOpLayoutPersistence: LayoutPersistencePort = {
  async save() {},
}

export function layoutFromSnapshot(
  placedPieces: Layout['placedPieces'],
  fabricWidthCm: number,
  fabricHeightCm: number,
  cuttingGapCm: number,
): Layout {
  return { placedPieces, fabricWidthCm, fabricHeightCm, cuttingGapCm }
}
