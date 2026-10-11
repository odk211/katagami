import { Stage, Layer, Rect, Line, Text, Group } from 'react-konva'
import type { Piece, PlacedPiece } from '../../types'
import { getLayoutPolygon } from '../../lib/geometry/mirror'
import { normalizePolygon, boundingBox } from '../../lib/geometry/polygon'
import { slotColor } from '../../lib/layout/slotLegend'

type Props = {
  pieces: Piece[]
  placedPieces: PlacedPiece[]
  scale: number
  stageWidthPx: number
  stageHeightPx: number
  selectedInstanceKey?: string | null
  interactive?: boolean
  onSelect?: (instanceKey: string) => void
  onDragEnd?: (instanceKey: string, x: number, y: number) => void
}

export function FabricStage({
  pieces,
  placedPieces,
  scale,
  stageWidthPx,
  stageHeightPx,
  selectedInstanceKey = null,
  interactive = false,
  onSelect,
  onDragEnd,
}: Props) {
  return (
    <Stage width={stageWidthPx} height={stageHeightPx}>
      <Layer>
        <Rect
          x={0}
          y={0}
          width={stageWidthPx}
          height={stageHeightPx}
          fill="#f5f0ff"
          stroke="#7c3aed"
          strokeWidth={2}
        />
        {placedPieces.map((placed) => {
          const piece = pieces.find((p) => p.id === placed.instanceKey)
          if (!piece) return null

          const normalized = normalizePolygon(getLayoutPolygon(piece))
          const localPoints = normalized.flatMap((p) => [p.x * scale, p.y * scale])
          const box = boundingBox(normalized)
          const color = slotColor(placed.slotIndex)
          const isSelected = selectedInstanceKey === placed.instanceKey

          return (
            <Group
              key={placed.instanceKey}
              x={placed.x * scale}
              y={placed.y * scale}
              rotation={placed.rotation}
              draggable={interactive}
              onClick={interactive ? () => onSelect?.(placed.instanceKey) : undefined}
              onTap={interactive ? () => onSelect?.(placed.instanceKey) : undefined}
              onDragEnd={
                interactive
                  ? (e) => {
                      const node = e.target
                      onDragEnd?.(placed.instanceKey, node.x() / scale, node.y() / scale)
                    }
                  : undefined
              }
            >
              <Line
                points={localPoints}
                closed
                fill={isSelected ? `${color}88` : `${color}${interactive ? '44' : '55'}`}
                stroke={color}
                strokeWidth={isSelected ? 2 : interactive ? 1 : 1.5}
              />
              <Text
                x={0}
                y={0}
                width={box.width * scale}
                height={box.height * scale}
                text={piece.name}
                fontSize={interactive ? 11 : 10}
                fill={color}
                align="center"
                verticalAlign="middle"
                listening={false}
              />
            </Group>
          )
        })}
      </Layer>
    </Stage>
  )
}
