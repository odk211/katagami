import type { ReactNode } from 'react'

/** The step's core actions, fixed to the bottom of the viewport so they never need a scroll. */
export function BottomActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="bottom-action-bar fixed inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-lg gap-2 px-4 py-2">{children}</div>
    </div>
  )
}
