import type { PatternStep } from '../types'

const STEPS: { key: PatternStep; label: string }[] = [
  { key: 'photos', label: '写真' },
  { key: 'calibration', label: '校正' },
  { key: 'trace', label: 'トレース' },
]

type Props = {
  current: PatternStep
  onNavigate: (step: PatternStep) => void
}

export function PatternStepIndicator({ current, onNavigate }: Props) {
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
            className={`min-h-11 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors ${
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
