import type { SlotLegendEntry } from '../lib/layout/slotLegend'

type Props = {
  entries: SlotLegendEntry[]
}

export function SlotLegend({ entries }: Props) {
  if (entries.length <= 1) return null

  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {entries.map((entry) => (
        <div key={entry.slotIndex} className="flex items-center gap-1.5 text-xs text-gray-600">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.label}</span>
        </div>
      ))}
    </div>
  )
}
