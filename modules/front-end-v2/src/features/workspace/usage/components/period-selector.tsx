import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import type { PeriodKey, PeriodOption, WorkspaceUsageFilter } from "../usage-types"
import { rangeLabel } from "../usage-utils"

export function PeriodSelector({
  isLoading,
  lang,
  options,
  selectedPeriod,
  usageFilter,
  onPeriodChange,
}: {
  isLoading: boolean
  lang: "en" | "zh"
  options: PeriodOption[]
  selectedPeriod: PeriodKey
  usageFilter: WorkspaceUsageFilter
  onPeriodChange: (value: PeriodKey) => void
}) {
  const selectedPeriodLabel =
    options.find((period) => period.value === selectedPeriod)?.label ??
    selectedPeriod

  return (
    <div className="flex min-h-10 flex-col justify-end gap-3 sm:flex-row sm:items-center">
      {isLoading ? (
        <Skeleton className="h-9 w-full sm:w-60" />
      ) : (
        <>
          <Select
            value={selectedPeriod}
            onValueChange={(value) => onPeriodChange(value as PeriodKey)}
          >
            <SelectTrigger className="h-9 w-full bg-background sm:w-56">
              <SelectValue>{selectedPeriodLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((period) => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground sm:min-w-52 sm:text-right">
            {rangeLabel(usageFilter, lang)}
          </span>
        </>
      )}
    </div>
  )
}
