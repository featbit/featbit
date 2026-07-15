import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type SelectionFilter = "all" | "selected"

export function SelectionFilterTabs({
  value,
  onValueChange,
  allLabel,
  selectedLabel,
  selectedCount,
}: {
  value: SelectionFilter
  onValueChange: (value: SelectionFilter) => void
  allLabel: ReactNode
  selectedLabel: (count: number) => ReactNode
  selectedCount: number
}) {
  return (
    <div className="flex gap-5 border-b px-3 pt-2">
      {(["all", "selected"] as const).map((filter) => {
        const disabled = filter === "selected" && selectedCount === 0
        return (
          <button
            key={filter}
            type="button"
            aria-pressed={value === filter}
            className={cn(
              "border-b-2 px-0.5 pb-2 text-sm font-medium",
              value === filter
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground",
              disabled && "cursor-not-allowed opacity-50"
            )}
            disabled={disabled}
            onClick={() => onValueChange(filter)}
          >
            {filter === "all" ? allLabel : selectedLabel(selectedCount)}
          </button>
        )
      })}
    </div>
  )
}
