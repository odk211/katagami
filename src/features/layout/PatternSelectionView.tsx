import { useEffect, useState } from 'react'
import { db, listPatternProjects, getPiecesForPatternProject } from '../../db'
import { useProjectStore } from '../../store/projectStore'
import type { PatternProject, LayoutProject } from '../../types'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'

type Props = {
  layoutProjectId: string
  onReady: () => void
}

type PatternSummary = PatternProject & { pieceCount: number }

// Kept out of the component: the React Compiler assumes a handler that a `.map` render callback
// wraps with a render value (`() => removeAt(index)`) may run during render, and rejects Date.now() in it.
async function saveSelection(
  layoutProjectId: string,
  changes: Pick<LayoutProject, 'patternProjectIds'> & Partial<Pick<LayoutProject, 'layout'>>,
) {
  await db.projects.update(layoutProjectId, {
    ...changes,
    updatedAt: Date.now(),
  } as Partial<LayoutProject>)
  useProjectStore.getState().updateProject(changes)
}

export function PatternSelectionView({ layoutProjectId, onReady }: Props) {
  const project = useProjectStore((s) => (s.project?.kind === 'layout' ? s.project : null))
  const [available, setAvailable] = useState<PatternSummary[]>([])

  useEffect(() => {
    async function load() {
      const patterns = await listPatternProjects()
      const summaries = await Promise.all(
        patterns.map(async (p) => ({
          ...p,
          pieceCount: (await getPiecesForPatternProject(p.id)).length,
        })),
      )
      setAvailable(summaries)
    }
    load()
  }, [])

  if (!project || project.kind !== 'layout') return null

  const layoutProject = project
  const selectedIds = layoutProject.patternProjectIds
  const totalPieces = selectedIds.reduce((sum, id) => {
    const found = available.find((p) => p.id === id)
    return sum + (found?.pieceCount ?? 0)
  }, 0)

  function addPattern(patternProjectId: string) {
    return saveSelection(layoutProjectId, {
      patternProjectIds: [...layoutProject.patternProjectIds, patternProjectId],
    })
  }

  function removeAt(index: number) {
    return saveSelection(layoutProjectId, {
      patternProjectIds: layoutProject.patternProjectIds.filter((_, i) => i !== index),
      layout: null,
    })
  }

  return (
    <div>
      <Card className="mb-4">
        <p className="mb-3 text-sm text-gray-600">
          配置に使う型紙プロジェクトを選びます。同じプロジェクトを複数回選ぶと、パーツが複数セット載ります。
        </p>
        {selectedIds.length === 0 ? (
          <p className="text-sm text-gray-500">まだ選択されていません</p>
        ) : (
          <ul className="space-y-2 mb-3">
            {selectedIds.map((id, index) => {
              const pattern = available.find((p) => p.id === id)
              return (
                <li
                  key={`${id}-${index}`}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                >
                  <span>
                    {pattern?.name ?? '（削除済み）'}
                    {pattern && (
                      <span className="ml-2 text-xs text-gray-500">{pattern.pieceCount} パーツ</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    className="text-xs text-danger px-2 py-1"
                  >
                    削除
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-xs text-gray-500">
          合計 {totalPieces} パーツ
        </p>
      </Card>

      <p className="mb-2 text-sm font-medium text-gray-700">型紙プロジェクトを追加</p>
      {available.length === 0 ? (
        <p className="text-sm text-gray-500">型紙プロジェクトがありません。先に型紙を登録してください。</p>
      ) : (
        <div className="space-y-2 mb-4">
          {available.map((pattern) => (
            <Card key={pattern.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{pattern.name}</p>
                <p className="text-xs text-gray-500">{pattern.pieceCount} パーツ</p>
              </div>
              <Button
                variant="secondary"
                className="text-xs py-1.5 px-3"
                disabled={pattern.pieceCount === 0}
                onClick={() => addPattern(pattern.id)}
              >
                追加
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Button fullWidth disabled={totalPieces < 1} onClick={onReady}>
        次へ: 生地・配置
      </Button>
    </div>
  )
}
