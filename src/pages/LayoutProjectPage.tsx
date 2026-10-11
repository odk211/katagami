import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db, getLayoutProjectWithDetails } from '../db'
import { useProjectStore } from '../store/projectStore'
import type { LayoutStep } from '../types'
import type { ExpandedLayoutPiece } from '../lib/layout/expandPieces'
import type { SlotLegendEntry } from '../lib/layout/slotLegend'
import { LayoutStepIndicator } from '../components/LayoutStepIndicator'
import { PatternSelectionView } from '../features/layout/PatternSelectionView'
import { FabricLayoutView } from '../features/fabric/FabricLayoutView'
import { ReportView } from '../features/report/ReportView'
import { EditableProjectName } from '../components/EditableProjectName'

export function LayoutProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [step, setStep] = useState<LayoutStep>('patterns')
  const [loading, setLoading] = useState(true)
  const [expandedPieces, setExpandedPieces] = useState<ExpandedLayoutPiece[]>([])
  const [slotLegend, setSlotLegend] = useState<SlotLegendEntry[]>([])

  const { project, setProject, reset } = useProjectStore()

  useEffect(() => {
    if (!projectId) return
    reset()
    getLayoutProjectWithDetails(projectId).then((data) => {
      if (!data) {
        navigate('/')
        return
      }
      setProject(data.project)
      setExpandedPieces(data.expandedPieces)
      setSlotLegend(data.slotLegend)
      setLoading(false)
    })
  }, [projectId, navigate, reset, setProject])

  useEffect(() => {
    if (!projectId || project?.kind !== 'layout') return
    getLayoutProjectWithDetails(projectId).then((data) => {
      if (data) {
        setExpandedPieces(data.expandedPieces)
        setSlotLegend(data.slotLegend)
      }
    })
  }, [projectId, project?.kind, project?.kind === 'layout' ? project.patternProjectIds.join('\0') : ''])

  if (loading || !project || project.kind !== 'layout' || !projectId) {
    return <p className="text-center text-sm text-gray-500 py-8">読み込み中…</p>
  }

  const hasFabric = project.fabricWidthCm !== null && project.fabricHeightCm !== null
  const hasPieces = expandedPieces.length > 0

  function goTo(next: LayoutStep) {
    setStep(next)
  }

  return (
    <div>
      <EditableProjectName
        prefix="配置"
        name={project.name}
        onSave={async (name) => {
          useProjectStore.getState().updateProject({ name })
          await db.projects.update(projectId, { name, updatedAt: Date.now() })
        }}
      />

      <LayoutStepIndicator current={step} onNavigate={goTo} />

      {step === 'patterns' && (
        <PatternSelectionView layoutProjectId={projectId} onReady={() => goTo('layout')} />
      )}

      {step === 'layout' && (
        <div>
          {!hasPieces ? (
            <p className="text-sm text-gray-500">先に型紙プロジェクトを選んでください。</p>
          ) : (
            <FabricLayoutView
              projectId={projectId}
              pieces={expandedPieces}
              slotLegend={slotLegend}
              onLayoutReady={() => goTo('report')}
            />
          )}
        </div>
      )}

      {step === 'report' && (
        <div>
          {project.layout && hasFabric ? (
            <ReportView
              pieces={expandedPieces}
              placedPieces={project.layout.placedPieces}
              slotLegend={slotLegend}
              fabricWidthCm={project.fabricWidthCm!}
              fabricHeightCm={project.fabricHeightCm!}
              cuttingGapCm={project.cuttingGapCm}
            />
          ) : (
            <p className="text-sm text-gray-500">先に配置を完了してください。</p>
          )}
        </div>
      )}

      {hasPieces && hasFabric && project.layout && step !== 'report' && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <button
            type="button"
            className="w-full text-sm text-primary py-2"
            onClick={() => goTo('report')}
          >
            結果をスキップ表示
          </button>
        </div>
      )}
    </div>
  )
}
