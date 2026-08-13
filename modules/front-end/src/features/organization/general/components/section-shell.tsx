import type React from "react"
import { cn } from "@/lib/utils"

export function Section({
  title,
  children,
  className,
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn("border-b py-8 first:pt-7 last:border-b-0", className)}
    >
      {title ? (
        <h2 className="mb-5 text-lg font-semibold tracking-normal">{title}</h2>
      ) : null}
      {children}
    </section>
  )
}

export function SectionFooter({
  helper,
  children,
}: {
  helper: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <p className="min-w-0 text-sm text-muted-foreground">{helper}</p>
      {children}
    </div>
  )
}
