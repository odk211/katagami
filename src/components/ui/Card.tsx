import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-white p-4 shadow-sm border border-gray-100 ${className}`}>
      {children}
    </div>
  )
}
