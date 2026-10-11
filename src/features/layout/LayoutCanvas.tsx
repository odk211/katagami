import { useProjectStore } from '../../store/projectStore'
import { isLayoutProject } from '../../types'
import type { Piece } from '../../types'
import type { SlotLegendEntry } from '../../lib/layout/slotLegend'
import { SlotLegend } from '../../components/SlotLegend'
import { UnplacedPieceList } from './UnplacedPieceList'
import { FabricStage } from './FabricStage'
import { useLayoutSession } from './useLayoutSession'
import { Button } from '../../components/ui/Button'

type Props = {
  projectId: string
  pieces: Piece[]
  slotLegend: SlotLegendEntry[]
  fabricWidthCm: number
  fabricHeightCm: number
  cuttingGapCm: number
  onLayoutReady: () => void
}

export function LayoutCanvas({
  projectId,
  pieces,
  slotLegend,
  fabricWidthCm,
  fabricHeightCm,
  cuttingGapCm,
  onLayoutReady,
}: Props) {
  const savedLayout = useProjectStore((s) =>
    s.project && isLayoutProject(s.project) ? s.project.layout : null,
  )

  const session = useLayoutSession({
    projectId,
    pieces,
    fabricWidthCm,
    fabricHeightCm,
    cuttingGapCm,
    savedLayout,
  })

  const {
    placedPieces,
    unplacedPieces,
    issues,
    selectedInstanceKey,
    isNesting,
    placeFromList,
    unplace,
    move,
    rotate,
    select,
    autoNestRemaining,
    viewport,
    containerRef,
  } = session

  const { scale, stageWidthPx, stageHeightPx } = viewport

  return (
    <div>
      <p className="mb-2 text-sm text-gray-600">
        未配置一覧からタップして生地に追加できます。生地上のパーツは「残りを自動配置」で動きません。
      </p>

      {(issues.hasOverlap || issues.hasOverflow) && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
          {issues.hasOverflow && <p>・生地からはみ出しているパーツがあります</p>}
          {issues.hasOverlap && <p>・生地上で重なっているパーツがあります（裁断余白込み）</p>}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => autoNestRemaining()}
          disabled={isNesting || unplacedPieces.length === 0}
          className="flex-1 min-w-[8rem] text-xs py-2"
        >
          {isNesting ? '配置中…' : '残りを自動配置'}
        </Button>
        {selectedInstanceKey && (
          <>
            <Button
              variant="ghost"
              className="flex-1 min-w-[4rem] text-xs py-2"
              onClick={() => rotate(selectedInstanceKey, -15)}
            >
              －15°
            </Button>
            <Button
              variant="ghost"
              className="flex-1 min-w-[4rem] text-xs py-2"
              onClick={() => rotate(selectedInstanceKey, 15)}
            >
              ＋15°
            </Button>
            <Button
              variant="ghost"
              className="flex-1 min-w-[6rem] text-xs py-2"
              onClick={() => unplace(selectedInstanceKey)}
            >
              未配置に戻す
            </Button>
          </>
        )}
      </div>

      <div
        ref={containerRef}
        className="canvas-container mb-4 w-full overflow-hidden rounded-lg border border-gray-200 bg-white"
      >
        <FabricStage
          pieces={pieces}
          placedPieces={placedPieces}
          scale={scale}
          stageWidthPx={stageWidthPx}
          stageHeightPx={stageHeightPx}
          selectedInstanceKey={selectedInstanceKey}
          interactive
          onSelect={(id) => select(id)}
          onDragEnd={(id, x, y) => void move(id, { x, y })}
        />
      </div>

      <UnplacedPieceList pieces={unplacedPieces} onAdd={(piece) => void placeFromList(piece)} />

      <SlotLegend entries={slotLegend} />

      <p className="mb-4 text-xs text-gray-500">
        生地に配置: {placedPieces.length} / {pieces.length} パーツ
        {unplacedPieces.length > 0 && (
          <span>（未配置 {unplacedPieces.length}）</span>
        )}
      </p>

      <Button fullWidth onClick={onLayoutReady}>
        結果を確認
      </Button>
    </div>
  )
}
