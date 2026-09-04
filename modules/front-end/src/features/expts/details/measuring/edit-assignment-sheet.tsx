import { Check, ChevronsUpDown, ListChecks, Plus, Trash2 } from "lucide-react"
import { useMemo, useRef, useState, type RefObject } from "react"
import { useTranslation } from "react-i18next"
import { StablePopoverContent } from "@/components/stable-popover-content"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { FlagVariation } from "@/features/flags/flags-types"
import type { Layer } from "@/features/expt-layers/layers-types"
import { cn } from "@/lib/utils"
import type {
  AudienceFilter,
  RunAssignmentUpdate,
  MeasuringRun,
} from "./measuring-types"
import {
  normalizedMethod,
  parseAudienceFilters,
  parseSamplingPlan,
  runVariants,
  serializeAudienceFilters,
  serializeSamplingPlan,
} from "./measuring-utils"

function variationLabel(variation: FlagVariation | undefined, id: string) {
  return variation?.name ?? id
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function selectedLayerLabel(layer: Layer) {
  return layer.name === layer.key ? layer.name : `${layer.name} (${layer.key})`
}

function LayerPicker({
  layers,
  value,
  portalContainer,
  onSelect,
}: {
  layers: Layer[]
  value: string
  portalContainer: RefObject<HTMLDivElement | null>
  onSelect: (layer: Layer) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const selectedLayer = layers.find((layer) => layer.key === value)
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const visibleLayers = normalizedSearch
    ? layers.filter((layer) =>
        `${layer.name} ${layer.key}`
          .toLocaleLowerCase()
          .includes(normalizedSearch)
      )
    : layers

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setSearch("")
      }}
    >
      <PopoverTrigger
        render={
          <Button
            id="assignment-layer-key"
            type="button"
            variant="outline"
            className="w-full justify-between px-3 font-normal"
          />
        }
      >
        <span
          className={cn(
            "min-w-0 truncate text-left",
            !selectedLayer && "text-muted-foreground"
          )}
        >
          {selectedLayer
            ? selectedLayerLabel(selectedLayer)
            : t(
                "releaseDecision.experiments.detailsPage.measuring.selectLayer"
              )}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <StablePopoverContent
        portalContainer={portalContainer}
        align="start"
        className="w-[var(--anchor-width)] min-w-72 p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={t(
              "releaseDecision.experiments.detailsPage.measuring.searchLayer"
            )}
          />
          <CommandList>
            <CommandEmpty>
              {t(
                "releaseDecision.experiments.detailsPage.measuring.noLayersFound"
              )}
            </CommandEmpty>
            <CommandGroup>
              {visibleLayers.map((layer) => (
                <CommandItem
                  key={layer.id}
                  value={`${layer.name} ${layer.key}`}
                  onSelect={() => {
                    onSelect(layer)
                    setOpen(false)
                    setSearch("")
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{layer.name}</span>
                    <code className="block truncate text-xs text-muted-foreground">
                      {layer.key}
                    </code>
                  </span>
                  <Check
                    className={cn(
                      "size-4 text-primary",
                      value === layer.key ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </StablePopoverContent>
    </Popover>
  )
}

export function EditAssignmentSheet({
  open,
  run,
  variations,
  layers,
  saving,
  saveError,
  onOpenChange,
  onSave,
}: {
  open: boolean
  run: MeasuringRun
  variations: FlagVariation[]
  layers: Layer[]
  saving: boolean
  saveError: boolean
  onOpenChange: (open: boolean) => void
  onSave: (update: RunAssignmentUpdate) => Promise<void>
}) {
  const { t } = useTranslation()
  const popoverPortalRef = useRef<HTMLDivElement>(null)
  const configuredVariants = useMemo(
    () =>
      runVariants(run).map((token) => {
        const match = variations.find(
          (variation) =>
            variation.id === token ||
            variation.value === token ||
            variation.name === token
        )
        return match?.id ?? token
      }),
    [run, variations]
  )
  const available = useMemo(() => {
    const fromFlag = variations.map((variation) => variation.id)
    return [...new Set([...fromFlag, ...configuredVariants])]
  }, [configuredVariants, variations])
  const variationMap = useMemo(
    () =>
      new Map(
        variations.flatMap((variation) => [
          [variation.id, variation] as const,
          [variation.value, variation] as const,
          [variation.name, variation] as const,
        ])
      ),
    [variations]
  )
  const [baseline, setBaseline] = useState(
    configuredVariants[0] ?? available[0] ?? ""
  )
  const [arms, setArms] = useState<string[]>(configuredVariants.slice(1))
  const [layerKey, setLayerKey] = useState(run.layerKey ?? "")
  const [assignmentUnit, setAssignmentUnit] = useState(
    run.assignmentUnitSelector ?? "user.keyId"
  )
  const [sliceStart, setSliceStart] = useState(run.sliceStart ?? 0)
  const [sliceEnd, setSliceEnd] = useState(run.sliceEnd ?? 100)
  const [sampling, setSampling] = useState<Record<string, number>>(() => {
    const raw = parseSamplingPlan(run)
    return Object.fromEntries(
      configuredVariants.map((variant, index) => [
        variant,
        raw[runVariants(run)[index]] ?? raw[variant] ?? 100,
      ])
    )
  })
  const [filters, setFilters] = useState<AudienceFilter[]>(() =>
    parseAudienceFilters(run.audienceFilters)
  )

  const included = [baseline, ...arms].filter(Boolean)
  const valid = Boolean(
    baseline &&
    arms.length > 0 &&
    assignmentUnit.trim() &&
    sliceStart >= 0 &&
    sliceEnd <= 100 &&
    sliceStart < sliceEnd &&
    included.every(
      (variant) =>
        (sampling[variant] ?? 100) >= 0 && (sampling[variant] ?? 100) <= 100
    )
  )
  const isBandit = normalizedMethod(run.method) === "bandit"
  const roleTitle = isBandit ? "baselineArms" : "controlTreatments"
  const primaryRole = isBandit ? "baseline" : "control"
  const comparisonRoles = isBandit ? "arms" : "treatments"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={popoverPortalRef}
        className="gap-0 p-0 data-[side=right]:w-[min(100vw,592px)] data-[side=right]:sm:max-w-[592px]"
      >
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle>
            {t(
              "releaseDecision.experiments.detailsPage.measuring.editAssignment"
            )}
          </SheetTitle>
          <SheetDescription className="mt-1.5 leading-5">
            {t(
              "releaseDecision.experiments.detailsPage.measuring.assignmentSubtitle",
              {
                run: run.slug,
              }
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5 divide-y">
            <section className="space-y-4 pb-5">
              <div className="space-y-1">
                <h3 className="font-medium">
                  {t(
                    `releaseDecision.experiments.detailsPage.measuring.${roleTitle}`
                  )}
                </h3>
                <p className="text-xs leading-5 text-muted-foreground">
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.rolesHelp"
                  )}
                </p>
              </div>
              <div className="space-y-3">
                <Label className="font-normal text-muted-foreground">
                  {t(
                    `releaseDecision.experiments.detailsPage.measuring.${primaryRole}`
                  )}
                </Label>
                <RadioGroup
                  value={baseline}
                  onValueChange={(value) => {
                    setBaseline(value)
                    setArms((current) =>
                      current.filter((item) => item !== value)
                    )
                  }}
                >
                  {available.map((id) => (
                    <label
                      key={id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <RadioGroupItem value={id} />
                      <span>{variationLabel(variationMap.get(id), id)}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <div className="space-y-3">
                <Label className="font-normal text-muted-foreground">
                  {t(
                    `releaseDecision.experiments.detailsPage.measuring.${comparisonRoles}`
                  )}
                </Label>
                {available
                  .filter((id) => id !== baseline)
                  .map((id) => (
                    <label
                      key={id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={arms.includes(id)}
                        onCheckedChange={(checked) =>
                          setArms((current) =>
                            checked
                              ? [...new Set([...current, id])]
                              : current.filter((item) => item !== id)
                          )
                        }
                      />
                      <span>{variationLabel(variationMap.get(id), id)}</span>
                    </label>
                  ))}
              </div>
            </section>

            <section className="space-y-4 py-5">
              <h3 className="font-medium">
                {t(
                  "releaseDecision.experiments.detailsPage.measuring.layerEligibility"
                )}
              </h3>
              <div className="grid grid-cols-[140px_1fr] items-center gap-x-4 gap-y-3">
                <Label
                  htmlFor="assignment-layer-key"
                  className="font-normal text-muted-foreground"
                >
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.layerKey"
                  )}
                </Label>
                <LayerPicker
                  layers={layers}
                  value={layerKey}
                  portalContainer={popoverPortalRef}
                  onSelect={(layer) => {
                    setLayerKey(layer.key)
                    setAssignmentUnit(layer.assignmentUnitSelector)
                  }}
                />
                <Label
                  htmlFor="assignment-unit"
                  className="font-normal text-muted-foreground"
                >
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.assignmentUnit"
                  )}
                </Label>
                <Input
                  id="assignment-unit"
                  value={assignmentUnit}
                  readOnly
                  className="bg-muted/40 text-muted-foreground"
                />
                <Label
                  htmlFor="assignment-start"
                  className="font-normal text-muted-foreground"
                >
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.bucketStart"
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="assignment-start"
                    type="number"
                    min={0}
                    max={99}
                    value={sliceStart}
                    className="pr-8"
                    onChange={(event) =>
                      setSliceStart(
                        clampNumber(Number(event.target.value), 0, 99)
                      )
                    }
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                    %
                  </span>
                </div>
                <Label
                  htmlFor="assignment-end"
                  className="font-normal text-muted-foreground"
                >
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.bucketEnd"
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="assignment-end"
                    type="number"
                    min={1}
                    max={100}
                    value={sliceEnd}
                    className="pr-8"
                    onChange={(event) =>
                      setSliceEnd(
                        clampNumber(Number(event.target.value), 1, 100)
                      )
                    }
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  "releaseDecision.experiments.detailsPage.measuring.activeRange",
                  {
                    start: sliceStart,
                    end: sliceEnd,
                    width: Math.max(0, sliceEnd - sliceStart),
                  }
                )}
              </p>
            </section>

            <section className="space-y-4 py-5">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-medium">
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.analysisSampling"
                  )}
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    included.length === 0 ||
                    included.every((id) => (sampling[id] ?? 100) === 100)
                  }
                  onClick={() =>
                    setSampling(
                      Object.fromEntries(included.map((id) => [id, 100]))
                    )
                  }
                >
                  <ListChecks />
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.setAll"
                  )}
                </Button>
              </div>
              <div className="space-y-3">
                {included.map((id) => (
                  <div
                    key={id}
                    className="grid grid-cols-[1fr_96px] items-center gap-4"
                  >
                    <Label
                      htmlFor={`sampling-${id}`}
                      className="truncate font-normal text-muted-foreground"
                    >
                      {variationLabel(variationMap.get(id), id)}
                    </Label>
                    <div className="relative">
                      <Input
                        id={`sampling-${id}`}
                        type="number"
                        min={0}
                        max={100}
                        value={sampling[id] ?? 100}
                        className="pr-8"
                        onChange={(event) =>
                          setSampling((current) => ({
                            ...current,
                            [id]: clampNumber(
                              Number(event.target.value),
                              0,
                              100
                            ),
                          }))
                        }
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2 pt-5">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-medium">
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.audienceFilters"
                  )}
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFilters((current) => [
                      ...current,
                      { property: "", op: "eq", value: "" },
                    ])
                  }
                >
                  <Plus />
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.addFilter"
                  )}
                </Button>
              </div>
              {filters.length ? (
                <div className="space-y-3 pt-2">
                  {filters.map((filter, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[minmax(0,1fr)_144px_minmax(0,1fr)_auto] items-center gap-2"
                    >
                      <Input
                        value={filter.property}
                        placeholder={t(
                          "releaseDecision.experiments.detailsPage.measuring.property"
                        )}
                        onChange={(event) =>
                          setFilters((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, property: event.target.value }
                                : item
                            )
                          )
                        }
                      />
                      <Select
                        value={filter.op}
                        onValueChange={(value) =>
                          setFilters((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, op: value as AudienceFilter["op"] }
                                : item
                            )
                          )
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {t(
                              `releaseDecision.experiments.detailsPage.measuring.filterOps.${filter.op}`
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {(["eq", "neq", "in", "nin"] as const).map((op) => (
                              <SelectItem key={op} value={op}>
                                {t(
                                  `releaseDecision.experiments.detailsPage.measuring.filterOps.${op}`
                                )}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <Input
                        value={filter.value}
                        placeholder={t(
                          "releaseDecision.experiments.detailsPage.measuring.filterValue"
                        )}
                        onChange={(event) =>
                          setFilters((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, value: event.target.value }
                                : item
                            )
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t(
                          "releaseDecision.experiments.detailsPage.measuring.removeFilter"
                        )}
                        onClick={() =>
                          setFilters((current) =>
                            current.filter(
                              (_, itemIndex) => itemIndex !== index
                            )
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="pt-1 text-sm text-muted-foreground">
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.noFilters"
                  )}
                </p>
              )}
            </section>
          </div>
        </div>

        <SheetFooter className="flex-row justify-end px-6 py-5">
          {saveError ? (
            <p className="mr-auto self-center text-sm text-destructive">
              {t(
                "releaseDecision.experiments.detailsPage.measuring.assignmentSaveFailed"
              )}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {t("releaseDecision.experiments.detailsPage.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!valid || saving}
            onClick={() =>
              void onSave({
                method: run.method,
                controlVariant: baseline,
                treatmentVariant: arms.join("|"),
                layerKey: layerKey.trim() || null,
                assignmentUnitSelector: assignmentUnit.trim(),
                sliceStart,
                sliceEnd,
                analysisSamplingPlan: serializeSamplingPlan(
                  baseline,
                  arms,
                  sampling,
                  Object.fromEntries(
                    variations.map((variation) => [
                      variation.id,
                      variation.name,
                    ])
                  )
                ),
                audienceFilters: serializeAudienceFilters(filters),
              })
            }
          >
            {t(
              saving
                ? "releaseDecision.experiments.detailsPage.measuring.saving"
                : "releaseDecision.experiments.detailsPage.measuring.saveChanges"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
