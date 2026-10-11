import type { Piece } from '../../types'
import { nestPieces } from './nest'

export type ShortageResult = {
  shortageWidthCm: number | null
  shortageHeightCm: number | null
}

export async function calculateShortage(
  pieces: Piece[],
  fabricWidthCm: number,
  fabricHeightCm: number,
  cuttingGapCm: number,
): Promise<ShortageResult> {
  const base = await nestPieces({
    pieces,
    allPieces: pieces,
    fabricWidthCm,
    fabricHeightCm,
    cuttingGapCm,
    timeoutMs: 5000,
  })

  if (base.allPlaced) {
    return { shortageWidthCm: null, shortageHeightCm: null }
  }

  const [shortageWidthCm, shortageHeightCm] = await Promise.all([
    findMinIncrease('width', pieces, fabricWidthCm, fabricHeightCm, cuttingGapCm),
    findMinIncrease('height', pieces, fabricWidthCm, fabricHeightCm, cuttingGapCm),
  ])

  return { shortageWidthCm, shortageHeightCm }
}

async function findMinIncrease(
  dimension: 'width' | 'height',
  pieces: Piece[],
  fabricWidthCm: number,
  fabricHeightCm: number,
  cuttingGapCm: number,
): Promise<number | null> {
  let low = 0
  let high = Math.max(fabricWidthCm, fabricHeightCm)
  let found: number | null = null

  for (let i = 0; i < 12; i++) {
    const mid = (low + high) / 2
    const width = dimension === 'width' ? fabricWidthCm + mid : fabricWidthCm
    const height = dimension === 'height' ? fabricHeightCm + mid : fabricHeightCm

    const result = await nestPieces({
      pieces,
      allPieces: pieces,
      fabricWidthCm: width,
      fabricHeightCm: height,
      cuttingGapCm,
      timeoutMs: 3000,
    })

    if (result.allPlaced) {
      found = mid
      high = mid
    } else {
      low = mid
    }
  }

  return found !== null ? Math.ceil(found * 10) / 10 : null
}
