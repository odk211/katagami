import { useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva'
import { db } from '../../db'
import { useProjectStore } from '../../store/projectStore'
import type { Calibration, Photo, Point } from '../../types'
import { createCalibration } from '../../lib/geometry/calibration'
import { usePhotoImage } from '../../lib/image/usePhotoImage'
import { useZoomablePhotoStage } from '../../hooks/useZoomablePhotoStage'
import { VertexHandle } from '../../lib/canvas/vertexHandle'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { BottomActionBar } from '../../components/BottomActionBar'

type Props = {
  photo: Photo
  onComplete: () => void
  initialCalibration?: Calibration | null
  isRedo?: boolean
  onCancel?: () => void
}

export function CalibrationCanvas({
  photo,
  onComplete,
  initialCalibration = null,
  isRedo = false,
  onCancel,
}: Props) {
  const [points, setPoints] = useState<Point[]>(() =>
    initialCalibration ? [initialCalibration.pointA, initialCalibration.pointB] : [],
  )
  const [lengthCm, setLengthCm] = useState(() =>
    initialCalibration ? String(initialCalibration.lengthCm) : '',
  )
  const [saving, setSaving] = useState(false)
  const updatePhoto = useProjectStore((s) => s.updatePhoto)
  const updatePiece = useProjectStore((s) => s.updatePiece)
  const image = usePhotoImage(photo.imageDataUrl)

  const { containerRef, stageRef, viewport, stageScale, fitView, zoomIn, zoomOut, stageProps } =
    useZoomablePhotoStage(photo.width, photo.height, (point) => {
      if (points.length >= 2 || saving) return
      setPoints((prev) => [...prev, point])
    })

  const strokeSize = 2 / stageScale

  async function handleSave() {
    if (points.length !== 2 || !lengthCm || saving) return
    const calibration = createCalibration(points[0], points[1], parseFloat(lengthCm))
    if (!calibration) return

    const oldCalibration = photo.calibration

    setSaving(true)
    try {
      await db.photos.update(photo.id, { calibration })
      updatePhoto(photo.id, { calibration })

      if (oldCalibration) {
        const ratio = oldCalibration.pixelsPerCm / calibration.pixelsPerCm
        const piecesForPhoto = useProjectStore
          .getState()
          .pieces.filter((p) => p.photoId === photo.id)

        if (piecesForPhoto.length > 0 && ratio !== 1) {
          for (const piece of piecesForPhoto) {
            const vertices = piece.vertices.map((v) => ({
              x: v.x * ratio,
              y: v.y * ratio,
            }))
            await db.pieces.update(piece.id, { vertices })
            updatePiece(piece.id, { vertices })
          }
        }
      }

      onComplete()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <p className="mb-3 text-sm text-gray-600">
        {isRedo
          ? '校正をやり直します。2本指（マウスはドラッグ）で移動、ピンチか＋／－ボタンで拡大縮小できます。'
          : '寸法ラベル付き辺の両端をタップし、実寸（cm）を入力してください。2本指（マウスはドラッグ）で移動、ピンチか＋／－ボタンで拡大縮小できます。'}
      </p>
      {isRedo && (
        <p className="mb-3 text-xs text-amber-700 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
          保存すると、この写真のパーツ寸法を新しいスケールに合わせて更新します。配置プロジェクトの配置位置はそのまま、形状は最新の寸法に追随します。
        </p>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={zoomIn} className="flex-1 min-w-[4rem] text-xs py-2">
          ＋ 拡大
        </Button>
        <Button variant="secondary" onClick={zoomOut} className="flex-1 min-w-[4rem] text-xs py-2">
          － 縮小
        </Button>
        <Button variant="ghost" onClick={fitView} className="flex-1 min-w-[4rem] text-xs py-2">
          全体表示
        </Button>
      </div>

      <div ref={containerRef} className="canvas-container mb-4 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
        {!image ? (
          <div
            className="flex items-center justify-center text-sm text-gray-500"
            style={{ height: viewport.height }}
          >
            画像読み込み中…
          </div>
        ) : (
          <Stage
            ref={stageRef}
            width={viewport.width}
            height={viewport.height}
            {...stageProps}
          >
            <Layer>
              <KonvaImage
                image={image}
                preventDefault={false}
                width={photo.width}
                height={photo.height}
              />
              {points.length === 2 && (
                <Line
                  points={points.flatMap((p) => [p.x, p.y])}
                  stroke="#7c3aed"
                  strokeWidth={strokeSize}
                  dash={[6 / stageScale, 4 / stageScale]}
                  listening={false}
                />
              )}
              {points.map((p, i) => (
                <VertexHandle
                  key={i}
                  x={p.x}
                  y={p.y}
                  stageScale={stageScale}
                  draggable={!saving}
                  onDragEnd={(x, y) => {
                    setPoints((prev) =>
                      prev.map((pt, idx) =>
                        idx === i
                          ? {
                              x: Math.max(0, Math.min(photo.width, x)),
                              y: Math.max(0, Math.min(photo.height, y)),
                            }
                          : pt,
                      ),
                    )
                  }}
                />
              ))}
            </Layer>
          </Stage>
        )}
      </div>

      <p className="mb-2 text-xs text-gray-500">
        選択点: {points.length} / 2
        {points.length === 2 && ' — 寸法を入力して保存'}
      </p>

      <Input
        label="実寸（cm）"
        type="number"
        inputMode="decimal"
        placeholder="例: 40"
        value={lengthCm}
        onChange={(e) => setLengthCm(e.target.value)}
        className="mb-4"
      />

      <BottomActionBar>
        {onCancel && (
          <Button variant="ghost" className="flex-1" onClick={onCancel}>
            キャンセル
          </Button>
        )}
        <Button
          className="flex-[2]"
          disabled={points.length !== 2 || !lengthCm || parseFloat(lengthCm) <= 0 || saving}
          onClick={handleSave}
        >
          {saving ? '保存中…' : isRedo ? '校正を更新' : '校正を保存'}
        </Button>
      </BottomActionBar>
    </div>
  )
}
