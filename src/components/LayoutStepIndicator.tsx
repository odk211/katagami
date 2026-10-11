import type { LayoutStep } from '../types'

const STEPS: { key: LayoutStep; label: string }[] = [
  { key: 'patterns', label: '型紙選択' },
  { key: 'layout', label: '生地・配置' },
  { key: 'report', label: '結果' },
]

type Props = {
  current: LayoutStep
  onNavigate: (step: LayoutStep) => void
}

export function LayoutStepIndicator({ current, onNavigate }: Props) {
  const currentIndex = STEPS.findIndex((s) => s.key === current)

  return (
    <nav aria-label="作業ステップ" className="mb-4 flex gap-1 overflow-x-auto pb-1">
      {STEPS.map((step, i) => {
        const isCurrent = i === currentIndex
        const isPast = i < currentIndex

        return (
          <button
            key={step.key}
            type="button"
            aria-current={isCurrent ? 'step' : undefined}
            onClick={() => onNavigate(step.key)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              isCurrent
                ? 'bg-primary text-white'
                : isPast
                  ? 'bg-primary/20 text-primary hover:bg-primary/30'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {step.label}
          </button>
        )
      })}
    </nav>
  )
}
