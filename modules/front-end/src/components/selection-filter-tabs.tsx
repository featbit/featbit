import type { ReactNode } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
    <Tabs
      value={value}
      onValueChange={(nextValue) => onValueChange(nextValue as SelectionFilter)}
      className="gap-0"
    >
      <TabsList
        variant="line"
        className="w-full justify-start gap-5 rounded-none border-b px-3 pt-2 group-data-horizontal/tabs:h-auto"
      >
        <TabsTrigger
          value="all"
          className="h-auto flex-none rounded-none px-0.5 pt-0 pb-2"
        >
          {allLabel}
        </TabsTrigger>
        <TabsTrigger
          value="selected"
          className="h-auto flex-none rounded-none px-0.5 pt-0 pb-2"
          disabled={selectedCount === 0}
        >
          {selectedLabel(selectedCount)}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
