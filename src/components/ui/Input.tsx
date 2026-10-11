import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
}

export function Input({ label, className = '', id, ...props }: Props) {
  const inputId = id ?? label
  return (
    <label className="flex flex-col gap-1 text-sm text-gray-700">
      {label && <span className="font-medium">{label}</span>}
      <input
        id={inputId}
        className={`rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${className}`}
        {...props}
      />
    </label>
  )
}
