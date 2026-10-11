import { useState } from 'react'
import { db } from '../../db'
import { useProjectStore } from '../../store/projectStore'
import type { LayoutProject } from '../../types'
import { isLayoutProject } from '../../types'
import type { Piece } from '../../types'
import type { SlotLegendEntry } from '../../lib/layout/slotLegend'
import { LayoutCanvas } from '../layout/LayoutCanvas'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'

type Props = {
  projectId: string
  pieces: Piece[]
  slotLegend: SlotLegendEntry[]
  onLayoutReady: () => void
}

function parseFabric(
  width: string,
  height: string,
  gap: string,
): { fabricWidthCm: number; fabricHeightCm: number; cuttingGapCm: number } | null {
  const fabricWidthCm = parseFloat(width)
  const fabricHeightCm = parseFloat(height)
  const cuttingGapCm = parseFloat(gap)
  if (
    !width ||
    !height ||
    !gap ||
    fabricWidthCm <= 0 ||
    fabricHeightCm <= 0 ||
    cuttingGapCm < 0
  ) {
    return null
  }
  return { fabricWidthCm, fabricHeightCm, cuttingGapCm }
}

export function FabricLayoutView({ projectId, pieces, slotLegend, onLayoutReady }: Props) {
  const project = useProjectStore((s) => s.project)
  const updateProject = useProjectStore((s) => s.updateProject)
  const layoutProject = project && isLayoutProject(project) ? project : null

  const [width, setWidth] = useState(layoutProject?.fabricWidthCm?.toString() ?? '')
  const [height, setHeight] = useState(layoutProject?.fabricHeightCm?.toString() ?? '')
  const [gap, setGap] = useState(layoutProject?.cuttingGapCm?.toString() ?? '1')
  const [appliedFabric, setAppliedFabric] = useState(() => parseFabric(
    layoutProject?.fabricWidthCm?.toString() ?? '',
    layoutProject?.fabricHeightCm?.toString() ?? '',
    layoutProject?.cuttingGapCm?.toString() ?? '1',
  ))

  const pending = parseFabric(width, height, gap)
  const fabricChanged =
    appliedFabric !== null &&
    pending !== null &&
    (pending.fabricWidthCm !== appliedFabric.fabricWidthCm ||
      pending.fabricHeightCm !== appliedFabric.fabricHeightCm ||
      pending.cuttingGapCm !== appliedFabric.cuttingGapCm)

  async function applyFabric() {
    const fabric = parseFabric(width, height, gap)
    if (!fabric) return
    if (appliedFabric !== null && !fabricChanged) return

    const layout = layoutProject?.layout
      ? { ...layoutProject.layout, ...fabric }
      : null

    await db.projects.update(projectId, {
      ...fabric,
      layout,
      updatedAt: Date.now(),
    } as Partial<LayoutProject>)
    updateProject({ ...fabric, layout })
    setAppliedFabric(fabric)
  }

  return (
    <div>
      <Card className="mb-4">
        <p className="mb-3 text-sm text-gray-600">
          生地サイズを入力し、パーツの配置・調整を行います。
        </p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Input
            label="幅（cm）"
            type="number"
            inputMode="decimal"
            placeholder="110"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
          />
          <Input
            label="高さ（cm）"
            type="number"
            inputMode="decimal"
            placeholder="200"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>
        <Input
          label="裁断余白（cm）"
          type="number"
          inputMode="decimal"
          placeholder="1"
          value={gap}
          onChange={(e) => setGap(e.target.value)}
          className="mb-3"
        />
        <Button fullWidth disabled={!pending || (appliedFabric !== null && !fabricChanged)} onClick={applyFabric}>
          反映
        </Button>
      </Card>

      {appliedFabric ? (
        <LayoutCanvas
          projectId={projectId}
          pieces={pieces}
          slotLegend={slotLegend}
          fabricWidthCm={appliedFabric.fabricWidthCm}
          fabricHeightCm={appliedFabric.fabricHeightCm}
          cuttingGapCm={appliedFabric.cuttingGapCm}
          onLayoutReady={onLayoutReady}
        />
      ) : (
        <p className="text-sm text-gray-500 text-center py-6">
          生地サイズを入力して「反映」を押してください。
        </p>
      )}
    </div>
  )
}
