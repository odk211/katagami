import { useEffect, useRef, useState } from 'react'

type Props = {
  prefix: string
  name: string
  onSave: (name: string) => void | Promise<void>
}

function PencilIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4 shrink-0 text-gray-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export function EditableProjectName({ prefix, name, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  async function commit() {
    const trimmed = draft.trim()
    const next = trimmed || name
    setDraft(next)
    setEditing(false)
    if (next !== name) await onSave(next)
  }

  function cancel() {
    setDraft(name)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="mb-4 flex min-w-0 items-center gap-2">
        <span className="shrink-0 font-semibold text-gray-900">{prefix}:</span>
        <input
          ref={inputRef}
          className="min-w-0 flex-1 rounded-lg border border-primary bg-white px-2 py-1 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
          value={draft}
          aria-label={`${prefix}プロジェクト名`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            // IME key events report keyCode 229, including the Enter Safari sends after committing a conversion.
            if (e.keyCode === 229) return
            if (e.key === 'Enter') {
              e.preventDefault()
              void commit()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              cancel()
            }
          }}
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      className="mb-4 flex min-w-0 max-w-full items-center gap-2 text-left"
      aria-label={`${prefix}プロジェクト名を編集`}
      onClick={() => {
        setDraft(name)
        setEditing(true)
      }}
    >
      <h2 className="min-w-0 truncate font-semibold text-gray-900">
        {prefix}: {name}
      </h2>
      <PencilIcon />
    </button>
  )
}
