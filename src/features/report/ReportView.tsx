import { useEffect, useRef, useState } from 'react'
import type { Piece, PlacedPiece, FitResult } from '../../types'
import { evaluateLayoutFit } from '../../lib/layout/session/evaluateFit'
import { getPlacedBoundingBox, isFullyOnFabric } from '../../lib/nesting/stackLayout'
import type { SlotLegendEntry } from '../../lib/layout/slotLegend'
import { SlotLegend } from '../../components/SlotLegend'
import { FabricStage } from '../layout/FabricStage'
import { Card } from '../../components/ui/Card'

type Props = {
  pieces: Piece[]
  placedPieces: PlacedPiece[]
  slotLegend: SlotLegendEntry[]
  fabricWidthCm: number
  fabricHeightCm: number
  cuttingGapCm: number
}

export function ReportView({
  pieces,
  placedPieces,
  slotLegend,
  fabricWidthCm,
  fabricHeightCm,
  cuttingGapCm,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(320)
  const [result, setResult] = useState<FitResult | null>(null)
  const [loading, setLoading] = useState(true)

  const scale = containerWidth / fabricWidthCm
  const stageHeight = fabricHeightCm * scale
  const unplacedCount = pieces.length - placedPieces.length

  const visiblePlaced = placedPieces.filter((placed) => {
    const piece = pieces.find((p) => p.id === placed.instanceKey)
    if (!piece) return false
    return isFullyOnFabric(getPlacedBoundingBox(placed, piece), fabricWidthCm, fabricHeightCm)
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    async function compute() {
      setLoading(true)
      const evalResult = await evaluateLayoutFit({
        pieces,
        placedPieces,
        fabricWidthCm,
        fabricHeightCm,
        cuttingGapCm,
        includeShortage: true,
      })
      setResult(evalResult)
      setLoading(false)
    }
    void compute()
  }, [pieces, placedPieces, fabricWidthCm, fabricHeightCm, cuttingGapCm])

  if (loading || !result) {
    return <p className="text-center text-sm text-gray-500 py-8">判定中…</p>
  }

  return (
    <div>
      <Card className={`mb-4 ${result.fits ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <p className={`text-xl font-bold ${result.fits ? 'text-success' : 'text-danger'}`}>
          {result.fits ? '生地は足ります' : '生地が足りません'}
        </p>
        {!result.fits && (
          <ul className="mt-2 text-sm text-red-700 space-y-1">
            {result.hasOverflow && <li>・パーツが生地からはみ出しています</li>}
            {result.hasOverlap && <li>・パーツが重なっています</li>}
            {unplacedCount > 0 && (
              <li>・全パーツを配置できませんでした（{placedPieces.length}/{pieces.length}）</li>
            )}
          </ul>
        )}
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-gray-500">使用率</p>
          <p className="text-2xl font-bold text-gray-900">
            {result.utilizationPercent.toFixed(1)}%
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">生地サイズ</p>
          <p className="text-lg font-semibold text-gray-900">
            {fabricWidthCm} × {fabricHeightCm} cm
          </p>
        </Card>
      </div>

      {!result.fits && (result.shortageWidthCm !== null || result.shortageHeightCm !== null) && (
        <Card className="mb-4 bg-amber-50 border-amber-100">
          <p className="text-sm font-medium text-amber-900 mb-1">不足量の目安</p>
          {result.shortageWidthCm !== null && (
            <p className="text-sm text-amber-800">・幅を約 +{result.shortageWidthCm} cm 拡大</p>
          )}
          {result.shortageHeightCm !== null && (
            <p className="text-sm text-amber-800">・高さを約 +{result.shortageHeightCm} cm 拡大</p>
          )}
        </Card>
      )}

      <p className="mb-2 text-sm font-medium text-gray-700">配置図</p>
      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white"
      >
        <FabricStage
          pieces={pieces}
          placedPieces={visiblePlaced}
          scale={scale}
          stageWidthPx={containerWidth}
          stageHeightPx={stageHeight}
        />
      </div>
      <SlotLegend entries={slotLegend} />
    </div>
  )
}
