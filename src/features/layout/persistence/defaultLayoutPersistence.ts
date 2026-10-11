import { db } from '../../../db'
import { useProjectStore } from '../../../store/projectStore'
import type { LayoutProject } from '../../../types'
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
