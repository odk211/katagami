import { useMemo, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva'
import { db, cascadeRemovePiece } from '../../db'
import { useProjectStore } from '../../store/projectStore'
import type { Photo, Piece, PieceCutMode, Point } from '../../types'
import {
  pixelPointToCm,
  cmPointToPixel,
  isValidClosedPolygon,
} from '../../lib/geometry/polygon'
import {
  expandFoldCenter,
  getFoldCenterTraceHint,
  mirrorCopyPolygon,
} from '../../lib/geometry/mirror'
import { usePhotoImage } from '../../lib/image/usePhotoImage'
import { useZoomablePhotoStage } from '../../hooks/useZoomablePhotoStage'
import { VertexHandle } from '../../lib/canvas/vertexHandle'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { BottomActionBar } from '../../components/BottomActionBar'

type Props = {
  photo: Photo
  existingPieces: Piece[]
  onPieceAdded: () => void
}

function pieceBadges(piece: Piece): string[] {
  const badges: string[] = []
  if (piece.cutMode === 'foldCenter') badges.push('折')
  if (piece.mirrorSourceId) badges.push('反')
  return badges
}

export function TraceCanvas({ photo, existingPieces, onPieceAdded }: Props) {
  const [vertices, setVertices] = useState<Point[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [pieceName, setPieceName] = useState('')
  const [cutMode, setCutMode] = useState<PieceCutMode>('normal')
  const [editingPieceId, setEditingPieceId] = useState<string | null>(null)
  const [editSnapshot, setEditSnapshot] = useState<{
    pieceName: string
    vertices: Point[]
    cutMode: PieceCutMode
  } | null>(null)
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const addPiece = useProjectStore((s) => s.addPiece)
  const updatePiece = useProjectStore((s) => s.updatePiece)
  const removePiece = useProjectStore((s) => s.removePiece)
  const image = usePhotoImage(photo.imageDataUrl)

  const calibration = photo.calibration
  const { containerRef, stageRef, viewport, stageScale, fitView, zoomIn, zoomOut, stageProps } =
    useZoomablePhotoStage(photo.width, photo.height, (point) => {
      if (!calibration) return
      setVertices((prev) => {
        setSelectedIndex(prev.length)
        return [...prev, point]
      })
    })

  const strokeSize = 2 / stageScale

  const cmVertices = useMemo(() => {
    if (!calibration) return null
    return vertices.map((v) => pixelPointToCm(v, calibration.pixelsPerCm))
  }, [calibration, vertices])

  const expansionPreview = useMemo(() => {
    if (cutMode !== 'foldCenter' || !calibration || !cmVertices) return null
    if (!isValidClosedPolygon(cmVertices)) return null
    try {
      const expanded = expandFoldCenter(cmVertices)
      return expanded.map((p) => cmPointToPixel(p, calibration.pixelsPerCm))
    } catch {
      return null
    }
  }, [cutMode, calibration, cmVertices])

  const selectedPiece = useMemo(
    () => existingPieces.find((p) => p.id === selectedPieceId && p.photoId === photo.id) ?? null,
    [existingPieces, selectedPieceId, photo.id],
  )

  const selectedExpansionPreview = useMemo(() => {
    if (!selectedPiece || selectedPiece.cutMode !== 'foldCenter' || !calibration) return null
    if (!isValidClosedPolygon(selectedPiece.vertices)) return null
    try {
      const expanded = expandFoldCenter(selectedPiece.vertices)
      return expanded.map((p) => cmPointToPixel(p, calibration.pixelsPerCm))
    } catch {
      return null
    }
  }, [selectedPiece, calibration])

  const selectedFoldLinePreview = useMemo(() => {
    if (!selectedPiece || selectedPiece.cutMode !== 'foldCenter' || !calibration) return null
    if (selectedPiece.vertices.length < 2) return null
    return selectedPiece.vertices
      .slice(0, 2)
      .map((v) => cmPointToPixel(v, calibration.pixelsPerCm))
  }, [selectedPiece, calibration])

  function updateVertex(index: number, point: Point) {
    setVertices((prev) => prev.map((v, i) => (i === index ? point : v)))
  }

  function undoVertex() {
    setVertices((prev) => prev.slice(0, -1))
    setSelectedIndex(null)
  }

  function clearVertices() {
    setVertices([])
    setSelectedIndex(null)
    setEditingPieceId(null)
    setEditSnapshot(null)
    setSelectedPieceId(null)
  }

  function resetNewTrace() {
    setVertices([])
    setSelectedIndex(null)
    setPieceName('')
    setEditingPieceId(null)
    setEditSnapshot(null)
    setCutMode('normal')
    setSelectedPieceId(null)
  }

  function hasUnsavedEdits(
    currentVertices: Point[],
    currentName: string,
    currentCutMode: PieceCutMode,
    snapshot: {
      pieceName: string
      vertices: Point[]
      cutMode: PieceCutMode
    } | null,
  ): boolean {
    if (!snapshot) return false
    if (currentName.trim() !== snapshot.pieceName) return true
    if (currentCutMode !== snapshot.cutMode) return true
    if (currentVertices.length !== snapshot.vertices.length) return true
    return currentVertices.some(
      (v, i) => v.x !== snapshot.vertices[i].x || v.y !== snapshot.vertices[i].y,
    )
  }

  function cancelEditing() {
    if (hasUnsavedEdits(vertices, pieceName, cutMode, editSnapshot)) {
      if (!window.confirm('未保存の変更を破棄しますか？')) return
    }
    resetNewTrace()
  }

  function startEditing(piece: Piece) {
    if (!calibration) return
    if (editingPieceId === piece.id) return

    const hasDraft = vertices.length > 0 || editingPieceId !== null
    if (hasDraft) {
      const discardUnsaved = hasUnsavedEdits(vertices, pieceName, cutMode, editSnapshot)
      const message = discardUnsaved
        ? '未保存の変更を破棄して、別のパーツを編集しますか？'
        : editingPieceId !== null
          ? '編集を終了して、別のパーツを編集しますか？'
          : '編集中の新規トレースを破棄して、このパーツを編集しますか？'
      if (!window.confirm(message)) return
    }

    const pixelVertices = piece.vertices.map((v) => cmPointToPixel(v, calibration.pixelsPerCm))
    setVertices(pixelVertices)
    setPieceName(piece.name)
    setCutMode(piece.cutMode)
    setEditingPieceId(piece.id)
    setEditSnapshot({
      pieceName: piece.name,
      vertices: pixelVertices,
      cutMode: piece.cutMode,
    })
    setSelectedIndex(null)
    setSelectedPieceId(null)
  }

  function selectPiece(piece: Piece) {
    if (isEditing || vertices.length > 0) return
    setSelectedPieceId((prev) => (prev === piece.id ? null : piece.id))
  }

  async function copySelectedPiece(mirror: boolean) {
    const source = existingPieces.find(
      (p) => p.id === selectedPieceId && p.photoId === photo.id,
    )
    if (!source) return

    const now = Date.now()
    const id = crypto.randomUUID()
    const copy: Piece = {
      id,
      photoId: photo.id,
      name: mirror ? `${source.name}（反）` : `${source.name}（コピー）`,
      vertices: mirror
        ? mirrorCopyPolygon(source.vertices)
        : source.vertices.map((v) => ({ x: v.x, y: v.y })),
      cutMode: source.cutMode,
      mirrorSourceId: mirror ? source.id : undefined,
      createdAt: now,
    }

    await db.pieces.add(copy)
    addPiece(copy)
    setSelectedPieceId(id)
    onPieceAdded()
  }

  async function savePiece() {
    if (!calibration || !cmVertices || !pieceName.trim()) return
    if (!isValidClosedPolygon(cmVertices)) return

    const name = pieceName.trim()

    if (editingPieceId) {
      const source = existingPieces.find((p) => p.id === editingPieceId)
      if (!source) return

      const next: Piece = {
        ...source,
        name,
        vertices: cmVertices,
        cutMode,
      }

      await db.pieces.put(next)
      updatePiece(editingPieceId, next)
      resetNewTrace()
      onPieceAdded()
      return
    }

    const piece: Piece = {
      id: crypto.randomUUID(),
      photoId: photo.id,
      name,
      vertices: cmVertices,
      cutMode,
      createdAt: Date.now(),
    }

    await db.pieces.add(piece)
    addPiece(piece)
    resetNewTrace()
    onPieceAdded()
  }

  function clampImagePoint(x: number, y: number): Point {
    return {
      x: Math.max(0, Math.min(photo.width, x)),
      y: Math.max(0, Math.min(photo.height, y)),
    }
  }

  async function deleteSelectedPiece() {
    const source = existingPieces.find(
      (p) => p.id === selectedPieceId && p.photoId === photo.id,
    )
    if (!source) return
    await deletePiece(source)
  }

  async function deletePiece(piece: Piece) {
    const mirrorChildren = existingPieces.filter((p) => p.mirrorSourceId === piece.id)
    const idsToDelete =
      !piece.mirrorSourceId && mirrorChildren.length > 0
        ? [piece.id, ...mirrorChildren.map((p) => p.id)]
        : [piece.id]

    const names = idsToDelete
      .map((id) => existingPieces.find((p) => p.id === id)?.name)
      .filter((name): name is string => Boolean(name))
      .join('、')

    if (!window.confirm(`「${names}」を削除しますか？\nこの操作は取り消せません。`)) return

    await db.pieces.bulkDelete(idsToDelete)
    for (const id of idsToDelete) {
      removePiece(id)
      await cascadeRemovePiece(id)
    }

    if (editingPieceId && idsToDelete.includes(editingPieceId)) {
      resetNewTrace()
    }

    if (selectedPieceId && idsToDelete.includes(selectedPieceId)) {
      setSelectedPieceId(null)
    }
  }

  const photoPieces = existingPieces.filter((p) => p.photoId === photo.id)
  const isEditing = editingPieceId !== null
  const unsavedEdits = hasUnsavedEdits(vertices, pieceName, cutMode, editSnapshot)
  const linePoints = vertices.flatMap((p) => [p.x, p.y])
  const traceOutlineClosed = vertices.length >= 3
  const foldLinePreview =
    cutMode === 'foldCenter' && vertices.length >= 2
      ? [vertices[0], vertices[1]]
      : null
  const isTracing = isEditing || vertices.length > 0
  const displayedExpansionPreview = isTracing ? expansionPreview : selectedExpansionPreview
  const displayedFoldLinePreview = isTracing ? foldLinePreview : selectedFoldLinePreview
  const previewPoints = displayedExpansionPreview?.flatMap((p) => [p.x, p.y]) ?? []
  const canSave =
    Boolean(cmVertices && isValidClosedPolygon(cmVertices)) && (!isEditing || unsavedEdits)

  function handlePrimary() {
    if (pieceName.trim()) {
      void savePiece()
      return
    }
    nameInputRef.current?.focus({ preventScroll: true })
    nameInputRef.current?.scrollIntoView({ block: 'center' })
  }

  const traceStatusMessage =
    cutMode === 'foldCenter'
      ? getFoldCenterTraceHint(vertices.length)
      : `頂点: ${vertices.length}点（3点以上で保存可能）`

  return (
    <div>
      <p className="mb-2 text-sm text-gray-600">
        輪郭の頂点をタップして追加。保存済みパーツはタップで選択し、コピー・削除できます。
      </p>

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

      <div
        ref={containerRef}
        className="canvas-container mb-4 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
      >
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
              {calibration &&
                photoPieces.map((p) => {
                  if (p.id === editingPieceId) return null
                  const pts = p.vertices.map((v) => cmPointToPixel(v, calibration.pixelsPerCm))
                  const isPieceSelected = p.id === selectedPieceId
                  return (
                    <Line
                      key={p.id}
                      points={pts.flatMap((pt) => [pt.x, pt.y])}
                      stroke={isPieceSelected ? '#7c3aed' : '#9ca3af'}
                      strokeWidth={isPieceSelected ? strokeSize * 1.5 : strokeSize}
                      closed={p.vertices.length >= 3}
                      listening={false}
                    />
                  )
                })}
              {displayedExpansionPreview && previewPoints.length >= 6 && (
                <Line
                  points={previewPoints}
                  stroke="#059669"
                  strokeWidth={strokeSize}
                  closed
                  fill="rgba(5, 150, 105, 0.2)"
                  listening={false}
                />
              )}
              {vertices.length >= 2 && (
                <Line
                  points={linePoints}
                  stroke="#7c3aed"
                  strokeWidth={strokeSize}
                  closed={traceOutlineClosed}
                  listening={false}
                />
              )}
              {displayedFoldLinePreview && (
                <Line
                  points={[
                    displayedFoldLinePreview[0].x,
                    displayedFoldLinePreview[0].y,
                    displayedFoldLinePreview[1].x,
                    displayedFoldLinePreview[1].y,
                  ]}
                  stroke="#d97706"
                  strokeWidth={strokeSize * 2}
                  listening={false}
                />
              )}
              {vertices.map((v, i) => (
                <VertexHandle
                  key={i}
                  x={v.x}
                  y={v.y}
                  stageScale={stageScale}
                  selected={selectedIndex === i}
                  index={i}
                  onSelect={() => setSelectedIndex(i)}
                  onDragMove={(x, y) => updateVertex(i, clampImagePoint(x, y))}
                  onDragEnd={(x, y) => updateVertex(i, clampImagePoint(x, y))}
                />
              ))}
            </Layer>
          </Stage>
        )}
      </div>

      <p className="mb-2 text-xs text-gray-500">
        {isEditing ? (
          <>
            「{pieceName}」を編集中 — 点をドラッグで調整し「変更を保存」
            {unsavedEdits && <span className="text-amber-700">（未保存）</span>}
            {selectedIndex !== null && ` — 点 ${selectedIndex + 1} 選択中`}
            {cutMode === 'foldCenter' && (
              <span className="mt-1 block">{getFoldCenterTraceHint(vertices.length)}</span>
            )}
          </>
        ) : (
          <>
            {traceStatusMessage}
            {selectedIndex !== null && ` — 点 ${selectedIndex + 1} 選択中（ドラッグで調整）`}
          </>
        )}
      </p>

      {photoPieces.length > 0 && (
        <div className="mb-3 rounded-lg bg-gray-50 p-3">
          <p className="text-xs font-medium text-gray-700 mb-1">この写真のパーツ:</p>
          <ul className="text-xs text-gray-600 space-y-1">
            {photoPieces.map((p) => {
              const badges = pieceBadges(p)
              const isActive = editingPieceId === p.id
              const isPieceSelected = selectedPieceId === p.id
              return (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => selectPiece(p)}
                    disabled={isEditing || vertices.length > 0}
                    className={`min-w-0 flex-1 text-left rounded px-1 py-0.5 ${
                      isActive
                        ? 'font-medium text-violet-700 bg-violet-50'
                        : isPieceSelected
                          ? 'font-medium text-violet-700 bg-violet-50'
                          : ''
                    } disabled:cursor-default`}
                  >
                    ・{p.name}
                    {badges.length > 0 && (
                      <span className="ml-1 text-violet-700">
                        {badges.map((b) => `[${b}]`).join('')}
                      </span>
                    )}
                  </button>
                  <span className="flex shrink-0 gap-1">
                    {isActive ? (
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="rounded px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                        aria-label={`${p.name}の編集をキャンセル`}
                      >
                        キャンセル
                      </button>
                    ) : (
                      !isEditing &&
                      vertices.length === 0 && (
                        <button
                          type="button"
                          onClick={() => startEditing(p)}
                          className="rounded px-2 py-0.5 text-xs text-violet-700 hover:bg-violet-50"
                          aria-label={`${p.name}を編集`}
                        >
                          編集
                        </button>
                      )
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
          {selectedPieceId && !isEditing && vertices.length === 0 && (
            <div className="mt-2 space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1 text-xs py-2"
                  onClick={() => copySelectedPiece(false)}
                >
                  コピー
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1 text-xs py-2"
                  onClick={() => copySelectedPiece(true)}
                >
                  鏡像コピー
                </Button>
              </div>
              <Button
                variant="ghost"
                fullWidth
                className="text-xs py-2 text-danger hover:bg-red-50"
                onClick={deleteSelectedPiece}
              >
                選択したパーツを削除
              </Button>
            </div>
          )}
        </div>
      )}

      <Input
        ref={nameInputRef}
        label="パーツ名"
        placeholder="例: 前身頃"
        value={pieceName}
        onChange={(e) => setPieceName(e.target.value)}
        className="mb-4"
      />

      <div className="mb-4">
        <p className="mb-2 text-sm font-medium text-gray-700">裁断タイプ</p>
        <div className="flex gap-2">
          <Button
            variant={cutMode === 'normal' ? 'primary' : 'ghost'}
            className="flex-1 text-xs py-2"
            onClick={() => setCutMode('normal')}
          >
            通常
          </Button>
          <Button
            variant={cutMode === 'foldCenter' ? 'primary' : 'ghost'}
            className="flex-1 text-xs py-2"
            onClick={() => setCutMode('foldCenter')}
          >
            折りセンター
          </Button>
        </div>
        {cutMode === 'foldCenter' && (
          <p className="mt-2 text-xs text-gray-500">
            点1・点2で折り線、点3以降で外周をトレースします。最後の点から点1へ自動で閉じます。
          </p>
        )}
      </div>

      <BottomActionBar>
        <Button variant="secondary" onClick={undoVertex} className="flex-1 whitespace-nowrap px-2">
          1点戻す
        </Button>
        <Button
          variant="secondary"
          onClick={isEditing ? cancelEditing : clearVertices}
          className="flex-1 whitespace-nowrap px-2"
        >
          {isEditing ? 'キャンセル' : 'クリア'}
        </Button>
        <Button className="flex-[2] whitespace-nowrap" disabled={!canSave} onClick={handlePrimary}>
          {isEditing ? '変更を保存' : 'パーツを保存'}
        </Button>
      </BottomActionBar>
    </div>
  )
}
