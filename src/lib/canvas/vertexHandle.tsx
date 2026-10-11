import { Group, Circle, Text } from 'react-konva'
import type Konva from 'konva'
import { VERTEX_HANDLE_NAME } from './stageTransform'

const VISUAL_RADIUS_PX = 3.5
const SELECTED_VISUAL_RADIUS_PX = 5
const HIT_RADIUS_PX = 14

type Props = {
  x: number
  y: number
  stageScale: number
  selected?: boolean
  index?: number
  draggable?: boolean
  onSelect?: () => void
  onDragMove?: (x: number, y: number) => void
  onDragEnd?: (x: number, y: number) => void
}

export function VertexHandle({
  x,
  y,
  stageScale,
  selected = false,
  index,
  draggable = true,
  onSelect,
  onDragMove,
  onDragEnd,
}: Props) {
  const visualRadius = (selected ? SELECTED_VISUAL_RADIUS_PX : VISUAL_RADIUS_PX) / stageScale
  const hitRadius = HIT_RADIUS_PX / stageScale
  const strokeWidth = 1.5 / stageScale
  const fontSize = 10 / stageScale
  const labelOffset = 3 / stageScale

  function handleDrag(e: Konva.KonvaEventObject<DragEvent>, handler?: (x: number, y: number) => void) {
    const node = e.target
    handler?.(node.x(), node.y())
  }

  return (
    <Group
      x={x}
      y={y}
      draggable={draggable}
      onDragStart={(e) => {
        e.cancelBubble = true
      }}
      onClick={(e) => {
        e.cancelBubble = true
        onSelect?.()
      }}
      onTap={(e) => {
        e.cancelBubble = true
        onSelect?.()
      }}
      onDragMove={(e) => handleDrag(e, onDragMove)}
      onDragEnd={(e) => handleDrag(e, onDragEnd)}
    >
      <Circle name={VERTEX_HANDLE_NAME} radius={hitRadius} fill="transparent" />
      <Circle
        radius={visualRadius}
        fill={selected ? '#5b21b6' : '#7c3aed'}
        stroke="white"
        strokeWidth={strokeWidth}
        listening={false}
      />
      {selected && index !== undefined && (
        <Text
          text={String(index + 1)}
          x={visualRadius + labelOffset}
          y={-fontSize / 2}
          fontSize={fontSize}
          fontStyle="bold"
          fill="#5b21b6"
          listening={false}
        />
      )}
    </Group>
  )
}
