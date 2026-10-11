import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  db,
  deletePatternProject,
  deleteLayoutProject,
  listPatternProjects,
  listLayoutProjects,
} from '../../db'
import { exportBackup, importBackup } from '../../db/backup'
import { createPatternProject, createLayoutProject } from '../../lib/layout/cascade'
import {
  backupErrorMessage,
  backupFileName,
  parseBackup,
  summarizeBackup,
  type KatagamiBackup,
} from '../../lib/backup/format'
import type { LayoutProject, PatternProject } from '../../types'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ConfirmDialog'

type PendingAction =
  | { kind: 'deletePattern'; id: string; name: string }
  | { kind: 'deleteLayout'; id: string; name: string }
  | { kind: 'import'; backup: KatagamiBackup }

type BackupNotice = { kind: 'error'; message: string } | { kind: 'imported' }

const importFailedMessage = '読み込みに失敗しました。端末の空き容量を確認して、もう一度お試しください。'

function dialogContent(action: PendingAction, busy: boolean) {
  switch (action.kind) {
    case 'deletePattern':
      return {
        title: `「${action.name}」を削除しますか？`,
        message: '型紙・パーツ・写真がすべて消え、関連する配置プロジェクトからも除去されます。',
        confirmLabel: busy ? '削除中…' : '削除',
      }
    case 'deleteLayout':
      return {
        title: `「${action.name}」を削除しますか？`,
        message: '配置結果もすべて消えます。',
        confirmLabel: busy ? '削除中…' : '削除',
      }
    case 'import': {
      const summary = summarizeBackup(action.backup)
      return {
        title: 'バックアップを読み込みますか？',
        message: `型紙プロジェクト ${summary.patternProjects}件・配置プロジェクト ${summary.layoutProjects}件を読み込みます。\n同じIDのプロジェクトは上書きされます。`,
        confirmLabel: busy ? '読み込み中…' : '読み込む',
      }
    }
  }
}

function downloadJson(value: unknown, fileName: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  // Safari can still be reading the blob right after click(); revoking at once cancels the download.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

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
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [backupNotice, setBackupNotice] = useState<BackupNotice | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
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
    setPending({ kind: 'deletePattern', id, name: project.name })
  }

  function requestDeleteLayout(id: string) {
    const project = layoutProjects.find((p) => p.id === id)
    if (!project) return
    setPending({ kind: 'deleteLayout', id, name: project.name })
  }

  async function runPending(action: PendingAction) {
    switch (action.kind) {
      case 'deletePattern':
        await deletePatternProject(action.id)
        setPatternProjects((prev) => prev.filter((p) => p.id !== action.id))
        setLayoutProjects(await listLayoutProjects())
        return
      case 'deleteLayout':
        await deleteLayoutProject(action.id)
        setLayoutProjects((prev) => prev.filter((p) => p.id !== action.id))
        return
      case 'import':
        try {
          await importBackup(action.backup)
        } catch {
          setBackupNotice({ kind: 'error', message: importFailedMessage })
          return
        }
        setPatternProjects(await listPatternProjects())
        setLayoutProjects(await listLayoutProjects())
        setBackupNotice({ kind: 'imported' })
        return
    }
  }

  async function confirmPending() {
    if (!pending || busy) return
    setBusy(true)
    try {
      await runPending(pending)
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  async function exportAll() {
    const now = Date.now()
    downloadJson(await exportBackup(now), backupFileName(now))
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBackupNotice(null)
    const result = parseBackup(await file.text())
    if (result.ok) {
      setPending({ kind: 'import', backup: result.backup })
    } else {
      setBackupNotice({ kind: 'error', message: backupErrorMessage(result.error) })
    }
  }

  const dialog = pending ? dialogContent(pending, busy) : null
  const hasProjects = patternProjects.length + layoutProjects.length > 0

  return (
    <div>
      <ConfirmDialog
        open={dialog !== null}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        confirmLabel={dialog?.confirmLabel}
        confirmDisabled={busy}
        onConfirm={confirmPending}
        onCancel={() => {
          if (!busy) setPending(null)
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

      <section className="mt-8">
        <h2 className="mb-2 text-base font-semibold text-gray-900">バックアップ</h2>
        <p className="mb-3 text-sm text-gray-600">
          すべてのプロジェクトをファイルに書き出し、別の端末やブラウザで読み込めます。
        </p>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImportFile}
        />
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={exportAll} disabled={!hasProjects}>
            エクスポート
          </Button>
          <Button variant="secondary" fullWidth onClick={() => importInputRef.current?.click()}>
            インポート
          </Button>
        </div>
        {backupNotice?.kind === 'error' && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {backupNotice.message}
          </p>
        )}
        <p role="status" className="mt-3 text-sm text-gray-600 empty:hidden">
          {backupNotice?.kind === 'imported' ? '読み込みました' : ''}
        </p>
      </section>
    </div>
  )
}
