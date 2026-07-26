import { Info } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  FeatureFlag,
  FlagRuleVariation,
  FlagVariation,
} from "../../flags-types"
import { ROLLOUT_MARKER_COLORS } from "./rollout-colors"
import {
  allocationPercentages,
  rolloutFromPercentages,
} from "./targeting-utils"

export function ServingSummary({
  flag,
  allocations,
}: {
  flag: FeatureFlag
  allocations: FlagRuleVariation[]
}) {
  const values = allocationPercentages(allocations)
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-2 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
        {values.map((item, index) => (
          <span
            key={item.id}
            className={
              ROLLOUT_MARKER_COLORS[index % ROLLOUT_MARKER_COLORS.length]
            }
            style={{ width: `${item.percentage}%` }}
          />
        ))}
      </div>
      <div className="flex min-w-0 items-center gap-3 overflow-hidden text-sm">
        {values.map((item, index) => {
          const variation = flag.variations?.find(
            (candidate) => candidate.id === item.id
          )
          return (
            <div key={item.id} className="flex shrink-0 items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${ROLLOUT_MARKER_COLORS[index % ROLLOUT_MARKER_COLORS.length]}`}
              />
              <span>
                {variation?.name || variation?.value || item.id}{" "}
                {item.percentage}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PercentageRolloutEditor({
  variations,
  value,
  dispatchKey,
  disabled,
  onCancel,
  onApply,
}: {
  variations: FlagVariation[]
  value: FlagRuleVariation[]
  dispatchKey?: string | null
  disabled?: boolean
  onCancel: () => void
  onApply: (value: FlagRuleVariation[], dispatchKey: string) => void
}) {
  const initial = useMemo(() => {
    const current = new Map(
      allocationPercentages(value).map((item) => [item.id, item.percentage])
    )
    return variations.map((variation) => ({
      id: variation.id,
      percentage: current.get(variation.id) ?? 0,
    }))
  }, [value, variations])
  const [items, setItems] = useState(initial)
  const [property, setProperty] = useState(dispatchKey || "keyId")
  const total = items.reduce((sum, item) => sum + item.percentage, 0)

  return (
    <div className="mt-2 rounded-md bg-muted/70 p-3.5">
      <div className="mb-4 flex items-start justify-between gap-6">
        <div>
          <h4 className="text-sm font-medium">Percentage rollout</h4>
          <p className="text-xs text-muted-foreground">
            Allocate exactly 100% across variations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Dispatch by</span>
          <Tooltip>
            <TooltipTrigger className="text-muted-foreground">
              <Info className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>
              Users with the same value are placed in the same stable percentage
              bucket.
            </TooltipContent>
          </Tooltip>
          <Select
            value={property}
            disabled={disabled}
            onValueChange={(value) => value && setProperty(value)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="keyId">keyId</SelectItem>
                <SelectItem value="name">name</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => {
          const variation = variations.find(
            (candidate) => candidate.id === item.id
          )
          return (
            <div
              key={item.id}
              className="grid max-w-3xl grid-cols-[11rem_minmax(8rem,26rem)_6.25rem] items-center gap-4"
            >
              <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <span
                  className={`size-2 shrink-0 rounded-full ${ROLLOUT_MARKER_COLORS[index % ROLLOUT_MARKER_COLORS.length]}`}
                />
                <span className="truncate">
                  {variation?.name || variation?.value || item.id}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${ROLLOUT_MARKER_COLORS[index % ROLLOUT_MARKER_COLORS.length]}`}
                  style={{ width: `${Math.min(100, item.percentage)}%` }}
                />
              </div>
              <div className="flex h-9 overflow-hidden rounded-md border bg-background">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={item.percentage}
                  disabled={disabled}
                  className="h-full rounded-none border-0 shadow-none"
                  onChange={(event) => {
                    const percentage = Math.max(
                      0,
                      Math.min(100, Number(event.target.value) || 0)
                    )
                    setItems((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, percentage } : entry
                      )
                    )
                  }}
                />
                <span className="flex w-9 items-center justify-center border-l text-xs text-muted-foreground">
                  %
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="flex items-center gap-4 text-xs">
          <span className="font-medium">{total}% allocated</span>
          <span
            className={
              total > 100 ? "text-destructive" : "text-muted-foreground"
            }
          >
            {total > 100
              ? `${total - 100}% over allocated`
              : `${100 - total}% remaining`}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={disabled || total !== 100}
            onClick={() => onApply(rolloutFromPercentages(items), property)}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  )
}
