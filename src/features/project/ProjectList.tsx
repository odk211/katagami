import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  db,
  deletePatternProject,
  deleteLayoutProject,
  listPatternProjects,
  listLayoutProjects,
} from '../../db'
import { createPatternProject, createLayoutProject } from '../../lib/layout/cascade'
import type { LayoutProject, PatternProject } from '../../types'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ConfirmDialog'

type PendingDelete =
  | { kind: 'pattern'; id: string; name: string }
  | { kind: 'layout'; id: string; name: string }

function ProjectSection<T extends { id: string; name: string; updatedAt: number }>({
  projects,
  linkPrefix,
  onDelete,
  emptyMessage,
}: {
  projects: T[]
  linkPrefix: string
  onDelete: (id: string) => void
  emptyMessage: string
}) {
  if (projects.length === 0) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>
  }

  return (
    <div className="space-y-3">
      {projects.map((project) => (
        <Card key={project.id} className="hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <Link to={`${linkPrefix}/${project.id}`} className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900">{project.name}</h3>
              <p className="text-xs text-gray-500">
                更新: {new Date(project.updatedAt).toLocaleString('ja-JP')}
              </p>
            </Link>
            <button
              type="button"
              onClick={() => onDelete(project.id)}
              className="shrink-0 rounded px-2 py-1 text-xs text-danger hover:bg-red-50"
            >
              削除
            </button>
          </div>
        </Card>
      ))}
    </div>
  )
}

export function ProjectList() {
  const [patternProjects, setPatternProjects] = useState<PatternProject[]>([])
  const [layoutProjects, setLayoutProjects] = useState<LayoutProject[]>([])
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    listPatternProjects().then(setPatternProjects)
    listLayoutProjects().then(setLayoutProjects)
  }, [])

  async function createPattern() {
    const now = Date.now()
    const project = createPatternProject(
      `型紙 ${new Date(now).toLocaleDateString('ja-JP')}`,
      now,
    )
    await db.projects.add(project)
    navigate(`/patterns/${project.id}`)
  }

  async function createLayout() {
    const now = Date.now()
    const project = createLayoutProject(
      `配置 ${new Date(now).toLocaleDateString('ja-JP')}`,
      now,
    )
    await db.projects.add(project)
    navigate(`/layouts/${project.id}`)
  }

  function requestDeletePattern(id: string) {
    const project = patternProjects.find((p) => p.id === id)
    if (!project) return
    setPendingDelete({ kind: 'pattern', id, name: project.name })
  }

  function requestDeleteLayout(id: string) {
    const project = layoutProjects.find((p) => p.id === id)
    if (!project) return
    setPendingDelete({ kind: 'layout', id, name: project.name })
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    try {
      if (pendingDelete.kind === 'pattern') {
        await deletePatternProject(pendingDelete.id)
        setPatternProjects((prev) => prev.filter((p) => p.id !== pendingDelete.id))
        setLayoutProjects(await listLayoutProjects())
      } else {
        await deleteLayoutProject(pendingDelete.id)
        setLayoutProjects((prev) => prev.filter((p) => p.id !== pendingDelete.id))
      }
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const deleteMessage =
    pendingDelete?.kind === 'pattern'
      ? '型紙・パーツ・写真がすべて消え、関連する配置プロジェクトからも除去されます。'
      : pendingDelete?.kind === 'layout'
        ? '配置結果もすべて消えます。'
        : ''

  return (
    <div>
      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `「${pendingDelete.name}」を削除しますか？` : ''}
        message={deleteMessage}
        confirmLabel={deleting ? '削除中…' : '削除'}
        confirmDisabled={deleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deleting) setPendingDelete(null)
        }}
      />

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold text-gray-900">型紙プロジェクト</h2>
        <p className="mb-3 text-sm text-gray-600">
          裁縫本の型紙ページを撮影し、パーツをトレースして登録します。
        </p>
        <Button fullWidth onClick={createPattern} className="mb-4">
          型紙プロジェクトを作成
        </Button>
        <ProjectSection
          projects={patternProjects}
          linkPrefix="/patterns"
          onDelete={requestDeletePattern}
          emptyMessage="型紙プロジェクトはまだありません"
        />
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-gray-900">配置プロジェクト</h2>
        <p className="mb-3 text-sm text-gray-600">
          登録済みの型紙を選び、生地に収まるか確認します。
        </p>
        <Button fullWidth onClick={createLayout} className="mb-4">
          配置プロジェクトを作成
        </Button>
        <ProjectSection
          projects={layoutProjects}
          linkPrefix="/layouts"
          onDelete={requestDeleteLayout}
          emptyMessage="配置プロジェクトはまだありません"
        />
      </section>
    </div>
  )
}
