export const SLOT_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#db2777']

export type SlotLegendEntry = {
  slotIndex: number
  label: string
  color: string
}

export function slotColor(slotIndex: number): string {
  return SLOT_COLORS[slotIndex % SLOT_COLORS.length]
}

export function buildSlotLegend(
  patternProjectIds: string[],
  patternProjects: { id: string; name: string }[],
): SlotLegendEntry[] {
  const names = new Map(patternProjects.map((p) => [p.id, p.name]))
  const totalById = new Map<string, number>()
  for (const id of patternProjectIds) {
    totalById.set(id, (totalById.get(id) ?? 0) + 1)
  }

  const seenById = new Map<string, number>()
  return patternProjectIds.map((id, slotIndex) => {
    const n = (seenById.get(id) ?? 0) + 1
    seenById.set(id, n)
    const name = names.get(id) ?? '（削除済み）'
    const label = (totalById.get(id) ?? 0) > 1 ? `${name} (${n})` : name
    return { slotIndex, label, color: slotColor(slotIndex) }
  })
}
