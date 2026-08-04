import type { ReactNode } from "react"

export function EmptyState({ title }: { title: ReactNode }) {
  return (
    <div className="flex min-h-44 items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
      {title}
    </div>
  )
}
