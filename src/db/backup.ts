import { db } from '.'
import { isPatternProject } from '../types'
import type { KatagamiBackup } from '../lib/backup/format'

export async function exportBackup(now: number): Promise<KatagamiBackup> {
  return db.transaction('r', db.projects, db.photos, db.pieces, async () => ({
    format: 'katagami-backup',
    version: 1,
    exportedAt: now,
    projects: await db.projects.toArray(),
    photos: await db.photos.toArray(),
    pieces: await db.pieces.toArray(),
  }))
}

export async function importBackup(backup: KatagamiBackup): Promise<void> {
  const patternIds = backup.projects.filter(isPatternProject).map((p) => p.id)

  await db.transaction('rw', db.projects, db.photos, db.pieces, async () => {
    const stalePhotoIds = await db.photos.where('projectId').anyOf(patternIds).primaryKeys()
    // A file photo id may still own pieces in the DB under another project; clear those too
    // so each restored photo ends up with exactly the file's pieces.
    const photoIdsToClear = [...stalePhotoIds, ...backup.photos.map((p) => p.id)]
    await db.pieces.where('photoId').anyOf(photoIdsToClear).delete()
    await db.photos.bulkDelete(stalePhotoIds)
    await db.projects.bulkPut(backup.projects)
    await db.photos.bulkPut(backup.photos)
    await db.pieces.bulkPut(backup.pieces)
  })
}
