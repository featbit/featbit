import { Info } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
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
import { variationMarkerColor } from "../../variation-colors"
import type { SegmentUserProperty } from "@/features/segments/segments-types"
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
    <div
      data-slot="serving-summary"
      className="flex min-w-0 w-full flex-col items-start gap-2 xl:w-auto xl:flex-row xl:items-center"
    >
      <div className="flex h-2 w-full max-w-72 shrink-0 overflow-hidden rounded-full bg-muted xl:w-24">
        {values.map((item, index) => (
          <span
            key={item.id}
            className={variationMarkerColor(index)}
            style={{ width: `${item.percentage}%` }}
          />
        ))}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {values.map((item, index) => {
          const variation = flag.variations?.find(
            (candidate) => candidate.id === item.id
          )
          return (
            <div key={item.id} className="flex shrink-0 items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${variationMarkerColor(index)}`}
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
  properties,
  disabled,
  onCancel,
  onApply,
}: {
  variations: FlagVariation[]
  value: FlagRuleVariation[]
  dispatchKey?: string | null
  properties: SegmentUserProperty[]
  disabled?: boolean
  onCancel: () => void
  onApply: (value: FlagRuleVariation[], dispatchKey: string) => void
}) {
  const { t } = useTranslation()
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
  const dispatchKeys = useMemo(
    () => [
      ...new Set([
        "keyId",
        "name",
        ...properties.map((property) => property.name).filter(Boolean),
      ]),
    ],
    [properties]
  )
  const [property, setProperty] = useState(() =>
    dispatchKey && dispatchKeys.includes(dispatchKey) ? dispatchKey : "keyId"
  )
  const total = items.reduce((sum, item) => sum + item.percentage, 0)

  return (
    <div className="mt-2 rounded-md bg-muted/70 p-3.5">
      <div className="mb-4">
        <div>
          <h4 className="text-sm font-medium">
            {t("featureFlags.detailsPage.rollout.title")}
          </h4>
          <p className="text-xs text-muted-foreground">
            {t("featureFlags.detailsPage.rollout.help")}
          </p>
        </div>
      </div>
      <div
        data-slot="rollout-variations"
        className="w-full max-w-3xl space-y-3"
      >
        {items.map((item, index) => {
          const variation = variations.find(
            (candidate) => candidate.id === item.id
          )
          return (
            <div
              key={item.id}
              className="grid grid-cols-[11rem_minmax(8rem,1fr)_6.25rem] items-center gap-4"
            >
              <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <span
                  className={`size-2 shrink-0 rounded-full ${variationMarkerColor(index)}`}
                />
                <span className="truncate">
                  {variation?.name || variation?.value || item.id}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${variationMarkerColor(index)}`}
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
      <div
        data-slot="rollout-footer"
        className="mt-4 flex w-full max-w-3xl items-end justify-between gap-4"
      >
        <div className="space-y-3">
          <div data-slot="rollout-dispatch" className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {t("featureFlags.detailsPage.rollout.dispatchBy")}
            </span>
            <Tooltip>
              <TooltipTrigger className="text-muted-foreground">
                <Info className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>
                {t("featureFlags.detailsPage.rollout.dispatchHelp")}
              </TooltipContent>
            </Tooltip>
            <Select
              value={property}
              disabled={disabled}
              onValueChange={(value) => value && setProperty(value)}
            >
              <SelectTrigger
                className="w-44"
                aria-label={t("featureFlags.detailsPage.rollout.dispatchLabel")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {dispatchKeys.map((key) => (
                    <SelectItem key={key} value={key}>
                      {key}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="font-medium">
              {t("featureFlags.detailsPage.rollout.allocated", {
                count: total,
              })}
            </span>
            <span
              className={
                total > 100 ? "text-destructive" : "text-muted-foreground"
              }
            >
              {total > 100
                ? t("featureFlags.detailsPage.rollout.overAllocated", {
                    count: total - 100,
                  })
                : t("featureFlags.detailsPage.rollout.remaining", {
                    count: 100 - total,
                  })}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={onCancel}
          >
            {t("featureFlags.detailsPage.rollout.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={disabled || total !== 100}
            onClick={() => onApply(rolloutFromPercentages(items), property)}
          >
            {t("featureFlags.detailsPage.rollout.apply")}
          </Button>
        </div>
      </div>
    </div>
  )
}
