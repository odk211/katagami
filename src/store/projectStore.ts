import { create } from 'zustand'
import type { Photo, Piece, Project, Layout, LayoutProject } from '../types'
import { isLayoutProject } from '../types'

type ProjectState = {
  project: Project | null
  photos: Photo[]
  pieces: Piece[]
  activePhotoId: string | null
  setProject: (project: Project | null) => void
  setPhotos: (photos: Photo[]) => void
  setPieces: (pieces: Piece[]) => void
  setActivePhotoId: (id: string | null) => void
  updateProject: (updates: Partial<Project>) => void
  addPhoto: (photo: Photo) => void
  updatePhoto: (id: string, updates: Partial<Photo>) => void
  addPiece: (piece: Piece) => void
  updatePiece: (id: string, updates: Partial<Piece>) => void
  removePiece: (id: string) => void
  setLayout: (layout: Layout | null) => void
  reset: () => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  photos: [],
  pieces: [],
  activePhotoId: null,
  setProject: (project) => set({ project }),
  setPhotos: (photos) => set({ photos }),
  setPieces: (pieces) => set({ pieces }),
  setActivePhotoId: (activePhotoId) => set({ activePhotoId }),
  updateProject: (updates) =>
    set((s) =>
      s.project ? { project: { ...s.project, ...updates, updatedAt: Date.now() } as Project } : {},
    ),
  addPhoto: (photo) =>
    set((s) => ({
      photos: [...s.photos, photo],
      activePhotoId: photo.id,
    })),
  updatePhoto: (id, updates) =>
    set((s) => ({
      photos: s.photos.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  addPiece: (piece) => set((s) => ({ pieces: [...s.pieces, piece] })),
  updatePiece: (id, updates) =>
    set((s) => ({
      pieces: s.pieces.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  removePiece: (id) =>
    set((s) => ({ pieces: s.pieces.filter((p) => p.id !== id) })),
  setLayout: (layout) =>
    set((s) => {
      if (!s.project || !isLayoutProject(s.project)) return {}
      const project: LayoutProject = { ...s.project, layout, updatedAt: Date.now() }
      return { project }
    }),
  reset: () => set({ project: null, photos: [], pieces: [], activePhotoId: null }),
}))

export function usePatternProject() {
  return useProjectStore((s) => (s.project?.kind === 'pattern' ? s.project : null))
}

export function useLayoutProject() {
  return useProjectStore((s) => (s.project && isLayoutProject(s.project) ? s.project : null))
}
