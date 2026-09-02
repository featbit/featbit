import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { fetchFeatureFlag } from "@/features/flags/flags-api"
import type { FlagVariation } from "@/features/flags/flags-types"
import { fetchLayers } from "@/features/expt-layers/layers-api"
import type { Layer } from "@/features/expt-layers/layers-types"
import { cn } from "@/lib/utils"
import type { ExperimentDetail } from "../experiment-details-types"
import { EditAssignmentSheet } from "./edit-assignment-sheet"
import {
  analyzeExperimentRun,
  createExperimentRun,
  deleteExperimentRun,
  updateExperimentRunAssignment,
  updateExperimentRunSetup,
} from "./measuring-api"
import type {
  AnalysisMethod,
  AnalysisRow,
  AnalysisSection,
  MeasuringRun,
  NewRunSetup,
} from "./measuring-types"
import {
  formatPercent,
  normalizedDecision,
  normalizedMethod,
  orderedRuns,
  parseAnalysis,
  parseAudienceFilters,
  parseExperimentVariantNames,
  parseSamplingPlan,
  runVariants,
} from "./measuring-utils"

function normalizeNewRunVariants(
  controlVariant: string,
  treatmentVariants: string[],
  variations: FlagVariation[]
) {
  const variationIds = variations.map((variation) => variation.id)
  const validIds = new Set(variationIds)
  const control = validIds.has(controlVariant)
    ? controlVariant
    : (variationIds[0] ?? "")
  const availableTreatments = variationIds.filter((id) => id !== control)
  const selectedTreatments = treatmentVariants.filter(
    (id, index, values) =>
      id !== control && validIds.has(id) && values.indexOf(id) === index
  )

  return {
    control,
    treatments:
      selectedTreatments.length > 0 ? selectedTreatments : availableTreatments,
  }
}

function VariationIdCopy({ value }: { value: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-5 shrink-0 text-muted-foreground"
            aria-label={t(
              copied
                ? "releaseDecision.experiments.detailsPage.copied"
                : "releaseDecision.experiments.detailsPage.measuring.copyVariationId"
            )}
            onClick={() => {
              void navigator.clipboard
                .writeText(value)
                .then(() => {
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1400)
                })
                .catch(() =>
                  toast.error(
                    t(
                      "releaseDecision.experiments.detailsPage.measuring.copyVariationIdFailed"
                    )
                  )
                )
            }}
          />
        }
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      </TooltipTrigger>
      <TooltipContent>
        {t(
          copied
            ? "releaseDecision.experiments.detailsPage.copied"
            : "releaseDecision.experiments.detailsPage.measuring.copyVariationId"
        )}
      </TooltipContent>
    </Tooltip>
  )
}

function StatusBadge({
  value,
  kind = "status",
}: {
  value: string
  kind?: "status" | "decision"
}) {
  const { t } = useTranslation()
  const normalized = value
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_")
  const dot =
    kind === "decision"
      ? normalized.includes("continue")
        ? "bg-emerald-600"
        : normalized.includes("rollback")
          ? "bg-rose-600"
          : "bg-amber-500"
      : normalized === "decided"
        ? "bg-emerald-600"
        : normalized === "collecting" ||
            normalized === "running" ||
            normalized === "active"
          ? "bg-blue-600"
          : "bg-zinc-400"
  return (
    <Badge variant="outline" className="gap-2 font-normal">
      <span className={cn("size-1.5 rounded-full", dot)} />
      {t(
        `releaseDecision.experiments.detailsPage.measuring.${kind === "decision" ? "decisions" : "statuses"}.${normalized}`,
        {
          defaultValue: kind === "decision" ? normalizedDecision(value) : value,
        }
      )}
    </Badge>
  )
}

function formatDate(value: string | null | undefined, language: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat(language, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatNumber(value: number | undefined, percent = false) {
  if (value === undefined) return "—"
  if (percent) return formatPercent(value)
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(
    value
  )
}

function DecisionPanel({ run }: { run: MeasuringRun }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const decision = normalizedDecision(run.decision)
  const key = decision.toLowerCase().replaceAll(" ", "_")
  const methodKey = `${normalizedMethod(run.method)}_${key}`
  const title = t(
    `releaseDecision.experiments.detailsPage.measuring.decisionCopy.${methodKey}.title`,
    {
      defaultValue: t(
        `releaseDecision.experiments.detailsPage.measuring.decisionCopy.${key}.title`,
        {
          defaultValue:
            run.decisionSummary ||
            t(
              "releaseDecision.experiments.detailsPage.measuring.decisionPending"
            ),
        }
      ),
    }
  )
  const action = t(
    `releaseDecision.experiments.detailsPage.measuring.decisionCopy.${methodKey}.action`,
    {
      defaultValue: t(
        `releaseDecision.experiments.detailsPage.measuring.decisionCopy.${key}.action`,
        {
          defaultValue: t(
            "releaseDecision.experiments.detailsPage.measuring.decisionPendingHelp"
          ),
        }
      ),
    }
  )

  if (!run.decision && !run.decisionSummary && !run.decisionReason) return null

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="space-y-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">{title}</h3>
          {run.decision ? (
            <StatusBadge value={run.decision} kind="decision" />
          ) : null}
        </div>
        <p className="text-sm leading-5">{action}</p>
        <p className="text-xs leading-5 text-muted-foreground">
          {t(
            "releaseDecision.experiments.detailsPage.measuring.decisionGuidance"
          )}
        </p>
      </div>
      {run.decisionSummary ? (
        <div className="border-t px-4 py-3">
          <p className="mb-1 text-sm font-medium">
            {t(
              "releaseDecision.experiments.detailsPage.measuring.evidenceSummary"
            )}
          </p>
          <p className="text-sm leading-5 text-muted-foreground">
            {run.decisionSummary}
          </p>
        </div>
      ) : null}
      {run.decisionReason ? (
        <button
          type="button"
          className="flex w-full items-start gap-2 border-t px-4 py-3 text-left hover:bg-muted/30"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? (
            <ChevronUp className="mt-0.5 size-4 shrink-0" />
          ) : (
            <ChevronDown className="mt-0.5 size-4 shrink-0" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">
              {t(
                "releaseDecision.experiments.detailsPage.measuring.evidenceRationale"
              )}
            </span>
            <span
              className={cn(
                "mt-1 block text-xs leading-5 text-muted-foreground",
                !expanded && "line-clamp-2"
              )}
            >
              {run.decisionReason}
            </span>
          </span>
          <span className="mt-0.5 shrink-0 text-xs text-muted-foreground">
            {t(
              expanded
                ? "releaseDecision.experiments.detailsPage.measuring.showLess"
                : "releaseDecision.experiments.detailsPage.measuring.showFullRationale"
            )}
          </span>
        </button>
      ) : null}
    </div>
  )
}

function AnalysisTable({
  section,
  run,
  bandit,
  variantNames,
}: {
  section: AnalysisSection
  run: MeasuringRun
  bandit: boolean
  variantNames: Record<string, string>
}) {
  const { t } = useTranslation()
  const variants = runVariants(run)
  const control = variants[0]
  const binary = section.rows.some(
    (row) => row.conversions !== undefined || row.rate !== undefined
  )
  const role = (row: AnalysisRow, index: number) => {
    if (bandit)
      return index === 0
        ? t("releaseDecision.experiments.detailsPage.measuring.baseline")
        : t("releaseDecision.experiments.detailsPage.measuring.arm")
    return row.variant === control
      ? t("releaseDecision.experiments.detailsPage.measuring.control")
      : t("releaseDecision.experiments.detailsPage.measuring.treatment", {
          number: Math.max(1, variants.indexOf(row.variant)),
        })
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          {bandit ? (
            <TableRow className="hover:bg-transparent">
              <TableHead />
              <TableHead
                colSpan={binary ? 3 : 2}
                className="text-center text-xs"
              >
                {t(
                  "releaseDecision.experiments.detailsPage.measuring.observedPerformance"
                )}
              </TableHead>
              <TableHead colSpan={2} className="text-center text-xs">
                {t(
                  "releaseDecision.experiments.detailsPage.measuring.banditRecommendation"
                )}
              </TableHead>
            </TableRow>
          ) : null}
          <TableRow className="hover:bg-transparent">
            <TableHead>
              {t("releaseDecision.experiments.detailsPage.measuring.variant")}
            </TableHead>
            <TableHead className="text-right">
              {t("releaseDecision.experiments.detailsPage.measuring.samples")}
            </TableHead>
            {binary ? (
              <TableHead className="text-right">
                {t("releaseDecision.experiments.detailsPage.measuring.events")}
              </TableHead>
            ) : null}
            <TableHead className="text-right">
              {t(
                `releaseDecision.experiments.detailsPage.measuring.${binary ? "rate" : "mean"}`
              )}
            </TableHead>
            {bandit ? (
              <>
                <TableHead className="text-right">
                  {t("releaseDecision.experiments.detailsPage.measuring.pBest")}
                </TableHead>
                <TableHead className="text-right">
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.recommendedWeight"
                  )}
                </TableHead>
              </>
            ) : (
              <>
                <TableHead className="text-right">
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.relativeLift"
                  )}
                </TableHead>
                <TableHead className="text-right">
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.interval"
                  )}
                </TableHead>
                <TableHead className="text-right">
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.signal"
                  )}
                </TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {section.rows.map((row, index) => (
            <TableRow key={`${section.label}-${row.variant}`}>
              <TableCell>
                <span className="font-medium">
                  {variantNames[row.variant] ?? row.variant}
                </span>
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({role(row, index)})
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.n}</TableCell>
              {binary ? (
                <TableCell className="text-right tabular-nums">
                  {formatNumber(row.conversions)}
                </TableCell>
              ) : null}
              <TableCell className="text-right tabular-nums">
                {formatNumber(binary ? row.rate : row.mean, binary)}
              </TableCell>
              {bandit ? (
                <>
                  <TableCell className="text-right tabular-nums">
                    {formatPercent(row.pBest)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercent(row.recommendedWeight)}
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell className="text-right tabular-nums">
                    {row.variant === control
                      ? t(
                          "releaseDecision.experiments.detailsPage.measuring.baselineValue"
                        )
                      : formatPercent(row.relDelta)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.ciLower === undefined || row.ciUpper === undefined
                      ? "—"
                      : `${formatPercent(row.ciLower)} – ${formatPercent(row.ciUpper)}`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.signalLabel && row.signal !== undefined
                      ? `${t(`releaseDecision.experiments.detailsPage.measuring.${row.signalLabel}`)} ${formatPercent(row.signal)}`
                      : "—"}
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {section.verdict ? (
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {t("releaseDecision.experiments.detailsPage.measuring.verdict")}
          </span>
          <span className="mx-2">·</span>
          {section.verdict}
        </div>
      ) : null}
    </div>
  )
}

function FullAnalysis({
  run,
  variantNames,
}: {
  run: MeasuringRun
  variantNames: Record<string, string>
}) {
  const { t, i18n } = useTranslation()
  const analysis = useMemo(
    () => parseAnalysis(run.analysisResult),
    [run.analysisResult]
  )
  const observed = analysis.srm
    ? Object.values(analysis.srm.observed).reduce(
        (sum, value) => sum + value,
        0
      )
    : 0
  const hasRows = Boolean(
    analysis.primary?.rows.length ||
    analysis.guardrails.some((section) => section.rows.length)
  )
  const bandit = normalizedMethod(run.method) === "bandit"

  return (
    <section className="space-y-3">
      <h3 className="font-medium">
        {t("releaseDecision.experiments.detailsPage.measuring.fullAnalysis")}
      </h3>
      <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-muted-foreground">
        <span>
          <strong className="font-medium text-foreground">
            {t("releaseDecision.experiments.detailsPage.measuring.window")}:
          </strong>{" "}
          {formatDate(run.observationStart, i18n.language)} →{" "}
          {formatDate(run.observationEnd, i18n.language)}
        </span>
        {bandit ? (
          <span>
            <strong className="font-medium text-foreground">
              {t("releaseDecision.experiments.detailsPage.measuring.algorithm")}
              :
            </strong>{" "}
            {analysis.algorithm === "thompson_sampling_top_two"
              ? t(
                  "releaseDecision.experiments.detailsPage.measuring.algorithms.thompson_sampling_top_two"
                )
              : (analysis.algorithm ?? "—")}
          </span>
        ) : (
          <span>
            <strong className="font-medium text-foreground">
              {t("releaseDecision.experiments.detailsPage.measuring.prior")}:
            </strong>{" "}
            {analysis.prior ??
              (run.priorProper
                ? `${run.priorMean ?? 0}, ${run.priorStddev ?? 0.3}`
                : t(
                    "releaseDecision.experiments.detailsPage.measuring.flatPrior"
                  ))}
          </span>
        )}
        <span>
          <strong className="font-medium text-foreground">
            {t("releaseDecision.experiments.detailsPage.measuring.dataAsOf")}:
          </strong>{" "}
          {formatDate(analysis.computedAt, i18n.language)}
        </span>
      </div>

      {!run.analysisResult || !hasRows || observed === 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50/60 px-4 py-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium">
              {t(
                "releaseDecision.experiments.detailsPage.measuring.noEvaluableData"
              )}
            </p>
            <p className="mt-0.5 text-xs leading-5 opacity-80">
              {t(
                "releaseDecision.experiments.detailsPage.measuring.noEvaluableDataHelp"
              )}
            </p>
          </div>
        </div>
      ) : null}

      {analysis.srm ? (
        <div className="flex flex-wrap items-center gap-2 border-b pb-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">SRM</span>
          <span>·</span>
          <span>p={analysis.srm.pValue?.toFixed(4) ?? "—"}</span>
          <span>·</span>
          <span>
            {analysis.srm.ok
              ? "ok"
              : t(
                  "releaseDecision.experiments.detailsPage.measuring.checkFailed"
                )}
          </span>
          <span>·</span>
          <span>
            {Object.entries(analysis.srm.observed)
              .map(([key, value]) => `${variantNames[key] ?? key}=${value}`)
              .join(", ") || "—"}
          </span>
          {observed === 0 ? (
            <Badge
              variant="outline"
              className="ml-auto border-amber-300 bg-amber-50 font-normal text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
            >
              {t("releaseDecision.experiments.detailsPage.measuring.noSamples")}
            </Badge>
          ) : null}
        </div>
      ) : null}

      {analysis.primary ? (
        <section className="space-y-2">
          <div>
            <h4 className="text-sm font-medium">
              {t(
                "releaseDecision.experiments.detailsPage.measuring.primaryMetric"
              )}{" "}
              <span className="font-normal text-muted-foreground">
                · {analysis.primary.label || run.primaryMetricEvent || "—"}
              </span>
            </h4>
            <p className="text-xs text-muted-foreground">
              {run.metricDescription}
            </p>
          </div>
          {analysis.primary.rows.length ? (
            <AnalysisTable
              section={analysis.primary}
              run={run}
              bandit={bandit}
              variantNames={variantNames}
            />
          ) : null}
          {bandit ? (
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-muted-foreground">
              <span>
                <strong className="font-medium text-foreground">
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.burnIn"
                  )}
                </strong>{" "}
                ·{" "}
                {analysis.enoughUnits
                  ? t("releaseDecision.experiments.detailsPage.measuring.ready")
                  : t(
                      "releaseDecision.experiments.detailsPage.measuring.notReady"
                    )}{" "}
                ·{" "}
                {t(
                  "releaseDecision.experiments.detailsPage.measuring.minimumUsers",
                  { count: run.minimumSample ?? 0 }
                )}
              </span>
              <span>
                <strong className="font-medium text-foreground">
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.stopping"
                  )}
                </strong>{" "}
                ·{" "}
                {analysis.stopping?.met
                  ? t("releaseDecision.experiments.detailsPage.measuring.met")
                  : t(
                      "releaseDecision.experiments.detailsPage.measuring.notYet"
                    )}{" "}
                ·{" "}
                {t(
                  "releaseDecision.experiments.detailsPage.measuring.threshold",
                  { value: formatPercent(analysis.stopping?.threshold) }
                )}
              </span>
            </div>
          ) : analysis.sampleCheck ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <strong className="font-medium text-foreground">
                {t(
                  "releaseDecision.experiments.detailsPage.measuring.sampleCheck"
                )}
              </strong>
              <span>·</span>
              <span>
                {analysis.sampleCheck.ok
                  ? t(
                      "releaseDecision.experiments.detailsPage.measuring.passed"
                    )
                  : t(
                      "releaseDecision.experiments.detailsPage.measuring.checkFailed"
                    )}
              </span>
              <span>·</span>
              <span>
                {t(
                  "releaseDecision.experiments.detailsPage.measuring.minimumPerVariant",
                  { count: analysis.sampleCheck.minimum }
                )}
              </span>
              {observed === 0 ? (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-50 font-normal text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.zeroNotEvidence"
                  )}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {analysis.guardrails.map((section, index) => (
        <section key={`${section.label}-${index}`} className="space-y-2">
          <h4 className="text-sm font-medium">
            {t("releaseDecision.experiments.detailsPage.measuring.guardrail")}{" "}
            <span className="font-normal text-muted-foreground">
              · {section.label || index + 1}
            </span>
          </h4>
          {section.rows.length ? (
            <AnalysisTable
              section={section}
              run={run}
              bandit={false}
              variantNames={variantNames}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("releaseDecision.experiments.detailsPage.measuring.noData")}
            </p>
          )}
        </section>
      ))}
    </section>
  )
}

function AssignmentSummary({
  run,
  variations,
  layers,
  onEdit,
}: {
  run: MeasuringRun
  variations: FlagVariation[]
  layers: Layer[]
  onEdit?: () => void
}) {
  const { t } = useTranslation()
  const ids = runVariants(run)
  const variationMap = new Map(
    variations.flatMap((variation) => [
      [variation.id, variation] as const,
      [variation.value, variation] as const,
      [variation.name, variation] as const,
    ])
  )
  const sampling = parseSamplingPlan(run)
  const audienceFilters = parseAudienceFilters(run.audienceFilters)
  const bandit = normalizedMethod(run.method) === "bandit"
  const start = run.sliceStart ?? 0
  const end = run.sliceEnd ?? 100
  const selectedLayer = layers.find((layer) => layer.key === run.layerKey)
  const layerLabel = selectedLayer
    ? selectedLayer.name === selectedLayer.key
      ? selectedLayer.name
      : `${selectedLayer.name} (${selectedLayer.key})`
    : run.layerKey
  const label = (id: string) => {
    const variation = variationMap.get(id)
    return variation?.name ?? id
  }

  return (
    <aside>
      <div className="flex items-center justify-between gap-4 border-b pb-3">
        <h3 className="font-medium">
          {t(
            "releaseDecision.experiments.detailsPage.measuring.trafficAssignment"
          )}
        </h3>
        {onEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Pencil />
            {t(
              "releaseDecision.experiments.detailsPage.measuring.editAssignment"
            )}
          </Button>
        ) : null}
      </div>
      <div className="divide-y">
        <section className="space-y-2 py-4">
          <h4 className="text-sm font-medium">
            {t(
              `releaseDecision.experiments.detailsPage.measuring.${bandit ? "baselineArms" : "controlTreatments"}`
            )}
          </h4>
          {ids.length ? (
            ids.map((id, index) => (
              <div
                key={id}
                className="grid grid-cols-[120px_1fr] gap-3 text-sm"
              >
                <span className="text-muted-foreground">
                  {index === 0
                    ? t(
                        `releaseDecision.experiments.detailsPage.measuring.${bandit ? "baseline" : "control"}`
                      )
                    : bandit
                      ? t(
                          "releaseDecision.experiments.detailsPage.measuring.arm"
                        )
                      : t(
                          "releaseDecision.experiments.detailsPage.measuring.treatment",
                          { number: index }
                        )}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 break-words">{label(id)}</span>
                  <VariationIdCopy value={variationMap.get(id)?.id ?? id} />
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {t(
                "releaseDecision.experiments.detailsPage.measuring.notConfigured"
              )}
            </p>
          )}
          <p className="pt-1 text-xs leading-5 text-muted-foreground">
            {t("releaseDecision.experiments.detailsPage.measuring.rolesHelp")}
          </p>
        </section>
        <section className="space-y-2 py-4">
          <h4 className="text-sm font-medium">
            {t(
              "releaseDecision.experiments.detailsPage.measuring.layerEligibility"
            )}
          </h4>
          {[
            ["layerKey", layerLabel],
            ["assignmentUnit", run.assignmentUnitSelector],
            ["bucketStart", `${start}%`],
            ["bucketEnd", `${end}%`],
            ["activeRangeLabel", `${start}%–${end}%`],
            ["width", `${Math.max(0, end - start)}%`],
          ].map(([key, value]) => (
            <div
              key={String(key)}
              className="grid grid-cols-[120px_1fr] gap-3 text-sm"
            >
              <span className="text-muted-foreground">
                {t(`releaseDecision.experiments.detailsPage.measuring.${key}`)}
              </span>
              <span className="break-words">
                {value === null || value === undefined || value === ""
                  ? "—"
                  : value}
              </span>
            </div>
          ))}
          <p className="pt-1 text-xs leading-5 text-muted-foreground">
            {t("releaseDecision.experiments.detailsPage.measuring.layerHelp")}
          </p>
        </section>
        <section className="space-y-2 py-4">
          <h4 className="text-sm font-medium">
            {t(
              "releaseDecision.experiments.detailsPage.measuring.analysisSampling"
            )}
          </h4>
          {ids.map((id, index) => (
            <div
              key={id}
              className="grid grid-cols-[minmax(240px,40%)_1fr] gap-3 text-sm"
            >
              <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-muted-foreground">
                <span className="min-w-0 break-words">{label(id)}</span>
                <Badge
                  variant="outline"
                  className="h-5 shrink-0 px-1.5 py-0 font-normal text-muted-foreground"
                >
                  {index === 0
                    ? t(
                        `releaseDecision.experiments.detailsPage.measuring.${bandit ? "baseline" : "control"}`
                      )
                    : bandit
                      ? t(
                          "releaseDecision.experiments.detailsPage.measuring.arm"
                        )
                      : t(
                          "releaseDecision.experiments.detailsPage.measuring.treatment",
                          { number: index }
                        )}
                </Badge>
              </span>
              <span className="tabular-nums">{sampling[id] ?? 100}%</span>
            </div>
          ))}
          <p className="pt-1 text-xs leading-5 text-muted-foreground">
            {t(
              "releaseDecision.experiments.detailsPage.measuring.samplingHelp"
            )}
          </p>
        </section>
        <section className="space-y-2 py-4">
          <h4 className="text-sm font-medium">
            {t(
              "releaseDecision.experiments.detailsPage.measuring.audienceFilters"
            )}
          </h4>
          {audienceFilters.length ? (
            <div className="space-y-2">
              {audienceFilters.map((filter, index) => (
                <div
                  key={`${filter.property}-${filter.op}-${index}`}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {filter.property}
                  </code>
                  <span className="text-muted-foreground">
                    {t(
                      `releaseDecision.experiments.detailsPage.measuring.filterOps.${filter.op}`
                    )}
                  </span>
                  <span>{filter.value || "—"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("releaseDecision.experiments.detailsPage.measuring.noFilters")}
            </p>
          )}
        </section>
      </div>
    </aside>
  )
}

export function MeasuringDetails({
  experiment,
  envId,
}: {
  experiment: ExperimentDetail
  envId: string
}) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const queryKey = ["experiment-details", envId, experiment.id]
  const runs = useMemo(
    () => orderedRuns(experiment.experimentRuns as MeasuringRun[]),
    [experiment.experimentRuns]
  )
  const variantNames = useMemo(
    () => parseExperimentVariantNames(experiment.variants),
    [experiment.variants]
  )
  const [selectedId, setSelectedId] = useState(runs.at(-1)?.id ?? null)
  const [newRunOpen, setNewRunOpen] = useState(false)
  const [newRunMethod, setNewRunMethod] =
    useState<AnalysisMethod>("bayesian_ab")
  const [newRunControlVariant, setNewRunControlVariant] = useState("")
  const [newRunTreatmentVariants, setNewRunTreatmentVariants] = useState<
    string[]
  >([])
  const [deleteRun, setDeleteRun] = useState<MeasuringRun | null>(null)
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const runTabsViewportRef = useRef<HTMLDivElement>(null)
  const runTabRefs = useRef(new Map<string, HTMLButtonElement>())
  const [runTabOverflow, setRunTabOverflow] = useState({
    left: false,
    right: false,
  })
  const selected =
    runs.find((run) => run.id === selectedId) ?? runs.at(-1) ?? null
  const selectedIndex = selected
    ? runs.findIndex((run) => run.id === selected.id)
    : -1

  const updateRunTabOverflow = useCallback(() => {
    const viewport = runTabsViewportRef.current
    if (!viewport) return

    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth
    setRunTabOverflow({
      left: viewport.scrollLeft > 1,
      right: viewport.scrollLeft < maxScrollLeft - 1,
    })
  }, [])

  const scrollRunTabs = (direction: -1 | 1) => {
    const viewport = runTabsViewportRef.current
    if (!viewport) return

    viewport.scrollBy({
      left: direction * Math.max(viewport.clientWidth * 0.75, 320),
      behavior: "smooth",
    })
  }

  useEffect(() => {
    const viewport = runTabsViewportRef.current
    if (!viewport) return

    updateRunTabOverflow()
    viewport.addEventListener("scroll", updateRunTabOverflow, {
      passive: true,
    })
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateRunTabOverflow)
    resizeObserver?.observe(viewport)
    window.addEventListener("resize", updateRunTabOverflow)

    return () => {
      viewport.removeEventListener("scroll", updateRunTabOverflow)
      resizeObserver?.disconnect()
      window.removeEventListener("resize", updateRunTabOverflow)
    }
  }, [runs.length, updateRunTabOverflow])

  useEffect(() => {
    if (!selected?.id) return

    runTabRefs.current.get(selected.id)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    })
    const frame = requestAnimationFrame(updateRunTabOverflow)
    return () => cancelAnimationFrame(frame)
  }, [selected?.id, updateRunTabOverflow])

  const flagQuery = useQuery({
    queryKey: ["experiment-feature-flag", envId, experiment.flagKey],
    queryFn: () => fetchFeatureFlag(envId, experiment.flagKey!),
    enabled: Boolean(envId && experiment.flagKey),
  })
  const layersQuery = useQuery({
    queryKey: ["experiment-layers", envId, "active", "measuring-assignment"],
    queryFn: () =>
      fetchLayers(envId, {
        search: "",
        status: "active",
        pageIndex: 0,
        pageSize: 100,
      }),
    enabled: Boolean(envId),
  })
  const updateCache = (updated: ExperimentDetail) =>
    queryClient.setQueryData(queryKey, updated)
  const flagVariations = flagQuery.data?.variations ?? []
  const createMutation = useMutation({
    mutationFn: async (setup: NewRunSetup) => {
      const createdState = await createExperimentRun(envId, experiment.id)
      const createdRun = orderedRuns(
        createdState.experimentRuns as MeasuringRun[]
      ).at(-1)
      if (!createdRun) return createdState

      return updateExperimentRunSetup(
        envId,
        experiment.id,
        createdRun.id,
        setup
      )
    },
    onSuccess: (updated) => {
      updateCache(updated)
      const created = orderedRuns(updated.experimentRuns as MeasuringRun[]).at(
        -1
      )
      setSelectedId(created?.id ?? null)
      setNewRunOpen(false)
      toast.success(
        t("releaseDecision.experiments.detailsPage.measuring.runCreated")
      )
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (runId: string) =>
      deleteExperimentRun(envId, experiment.id, runId),
    onSuccess: (updated) => {
      updateCache(updated)
      setDeleteRun(null)
      toast.success(
        t("releaseDecision.experiments.detailsPage.measuring.runDeleted")
      )
    },
  })
  const analyzeMutation = useMutation({
    mutationFn: (runId: string) =>
      analyzeExperimentRun(envId, experiment.id, runId),
    onSuccess: (updated) => {
      updateCache(updated)
      toast.success(
        t("releaseDecision.experiments.detailsPage.measuring.analysisUpdated")
      )
    },
  })
  const assignmentMutation = useMutation({
    mutationFn: (update: Parameters<typeof updateExperimentRunAssignment>[3]) =>
      updateExperimentRunAssignment(envId, experiment.id, selected!.id, update),
    onSuccess: (updated) => {
      updateCache(updated)
      setAssignmentOpen(false)
      toast.success(
        t("releaseDecision.experiments.detailsPage.measuring.assignmentSaved")
      )
    },
  })

  return (
    <section className="overflow-hidden rounded-lg border bg-background">
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-medium">
            {t(
              "releaseDecision.experiments.detailsPage.measuring.experimentRuns"
            )}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={createMutation.isPending}
            onClick={() => {
              const normalized = normalizeNewRunVariants("", [], flagVariations)
              createMutation.reset()
              setNewRunMethod("bayesian_ab")
              setNewRunControlVariant(normalized.control)
              setNewRunTreatmentVariants(normalized.treatments)
              setNewRunOpen(true)
            }}
          >
            <Plus />
            {t("releaseDecision.experiments.detailsPage.measuring.newRun")}
          </Button>
        </div>
        {runs.length ? (
          <div className="relative -mx-4 mt-3 -mb-3">
            {runTabOverflow.left ? (
              <div className="pointer-events-none absolute inset-y-px left-0 z-10 flex w-16 items-center bg-linear-to-r from-background via-background/95 to-transparent pl-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="pointer-events-auto rounded-full bg-background"
                  aria-label={t(
                    "releaseDecision.experiments.detailsPage.measuring.previousRuns"
                  )}
                  onClick={() => scrollRunTabs(-1)}
                >
                  <ChevronLeft />
                </Button>
              </div>
            ) : null}
            <div
              ref={runTabsViewportRef}
              className="[scrollbar-width:none] overflow-x-auto overflow-y-hidden scroll-smooth [&::-webkit-scrollbar]:hidden"
            >
              <Tabs value={selected?.id ?? ""} onValueChange={setSelectedId}>
                <TabsList className="w-max min-w-full justify-start gap-0 rounded-none border-t bg-transparent p-0 group-data-horizontal/tabs:h-auto">
                  {runs.map((run, index) => (
                    <TabsTrigger
                      key={run.id}
                      value={run.id}
                      ref={(node) => {
                        if (node) runTabRefs.current.set(run.id, node)
                        else runTabRefs.current.delete(run.id)
                      }}
                      className="h-11 min-w-52 flex-none justify-between gap-4 rounded-none border-0 border-r border-border px-4 font-normal text-foreground last:border-r-0 hover:bg-muted/40 focus-visible:z-20 data-active:bg-blue-50/60 data-active:shadow-none data-active:after:bottom-0 data-active:after:bg-blue-600 data-active:after:opacity-100 dark:data-active:bg-blue-950/25"
                    >
                      <span className="font-medium">
                        {t(
                          "releaseDecision.experiments.detailsPage.measuring.run",
                          { number: index + 1 }
                        )}
                      </span>
                      <span className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              run.status === "decided"
                                ? "bg-emerald-600"
                                : run.status === "collecting"
                                  ? "bg-blue-600"
                                  : "bg-zinc-400"
                            )}
                          />
                          {t(
                            `releaseDecision.experiments.detailsPage.measuring.statuses.${run.status.trim().toLowerCase()}`,
                            { defaultValue: run.status }
                          )}
                        </span>
                        {run.decision ? (
                          <span className="flex items-center gap-2">
                            <span className="size-1.5 rounded-full bg-amber-500" />
                            {t(
                              `releaseDecision.experiments.detailsPage.measuring.decisions.${run.decision.trim().toLowerCase()}`,
                              { defaultValue: normalizedDecision(run.decision) }
                            )}
                          </span>
                        ) : null}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            {runTabOverflow.right ? (
              <div className="pointer-events-none absolute inset-y-px right-0 z-10 flex w-16 items-center justify-end bg-linear-to-l from-background via-background/95 to-transparent pr-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="pointer-events-auto rounded-full bg-background"
                  aria-label={t(
                    "releaseDecision.experiments.detailsPage.measuring.nextRuns"
                  )}
                  onClick={() => scrollRunTabs(1)}
                >
                  <ChevronRight />
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {!selected ? (
        <div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
          <p className="font-medium">
            {t("releaseDecision.experiments.detailsPage.measuring.noRuns")}
          </p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {t("releaseDecision.experiments.detailsPage.measuring.noRunsHelp")}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <h3 className="mr-1 text-lg font-semibold">
              {t("releaseDecision.experiments.detailsPage.measuring.run", {
                number: selectedIndex + 1,
              })}
            </h3>
            <code className="mr-1 text-xs text-muted-foreground">
              {selected.slug}
            </code>
            <Badge variant="outline" className="font-normal">
              {t(
                `releaseDecision.experiments.detailsPage.measuring.methods.${normalizedMethod(selected.method)}`
              )}
            </Badge>
            <Badge variant="outline" className="gap-2 font-normal">
              <CalendarDays />
              {t(
                "releaseDecision.experiments.detailsPage.measuring.observationWindow"
              )}{" "}
              · {formatDate(selected.observationStart, i18n.language)} →{" "}
              {formatDate(selected.observationEnd, i18n.language)}
            </Badge>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t(
                  "releaseDecision.experiments.detailsPage.measuring.deleteRun"
                )}
                onClick={() => setDeleteRun(selected)}
              >
                <Trash2 />
              </Button>
              <Button
                type="button"
                disabled={analyzeMutation.isPending}
                onClick={() => analyzeMutation.mutate(selected.id)}
              >
                {t(
                  analyzeMutation.isPending
                    ? "releaseDecision.experiments.detailsPage.measuring.analyzing"
                    : "releaseDecision.experiments.detailsPage.measuring.analyze"
                )}
              </Button>
            </div>
          </div>
          {analyzeMutation.isError ? (
            <p className="border-b px-4 py-2 text-sm text-destructive">
              {t(
                "releaseDecision.experiments.detailsPage.measuring.analysisFailed"
              )}
            </p>
          ) : null}
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)]">
            <div className="min-w-0 xl:border-r">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-dashed px-4 py-2.5 text-sm text-muted-foreground">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <Bot className="size-4 shrink-0" />
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.agentPromptHelp"
                  )}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-auto text-foreground"
                  onClick={() => {
                    const prompt = `@featbit-experimentation ${experiment.id}\nReview run ${selected.slug} (${selected.id}) against the latest analysis and update its decision and next action.`
                    void navigator.clipboard
                      .writeText(prompt)
                      .then(() =>
                        toast.success(
                          t(
                            "releaseDecision.experiments.detailsPage.measuring.promptCopied"
                          )
                        )
                      )
                      .catch(() =>
                        toast.error(
                          t(
                            "releaseDecision.experiments.detailsPage.measuring.promptCopyFailed"
                          )
                        )
                      )
                  }}
                >
                  <Copy />
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.agentPrompt"
                  )}
                </Button>
              </div>
              <div className="space-y-5 p-4">
                <DecisionPanel run={selected} />
                <FullAnalysis run={selected} variantNames={variantNames} />
              </div>
            </div>
            <div className="min-w-0 border-t p-4 xl:border-t-0">
              <AssignmentSummary
                run={selected}
                variations={flagQuery.data?.variations ?? []}
                layers={layersQuery.data?.items ?? []}
                onEdit={() => setAssignmentOpen(true)}
              />
            </div>
          </div>
        </>
      )}

      {selected && assignmentOpen ? (
        <EditAssignmentSheet
          open
          run={selected}
          variations={flagQuery.data?.variations ?? []}
          layers={layersQuery.data?.items ?? []}
          saving={assignmentMutation.isPending}
          saveError={assignmentMutation.isError}
          onOpenChange={setAssignmentOpen}
          onSave={(update) =>
            assignmentMutation.mutateAsync(update).then(() => undefined)
          }
        />
      ) : null}

      <Dialog
        open={newRunOpen}
        onOpenChange={(open) => {
          if (!createMutation.isPending) setNewRunOpen(open)
        }}
      >
        <DialogContent
          className="sm:max-w-2xl"
          showCloseButton={!createMutation.isPending}
        >
          <DialogHeader>
            <DialogTitle>
              {t(
                "releaseDecision.experiments.detailsPage.measuring.newRunTitle"
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                "releaseDecision.experiments.detailsPage.measuring.newRunDescription"
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <section className="space-y-3">
              <Label>
                {t(
                  "releaseDecision.experiments.detailsPage.measuring.analysisMethod"
                )}
              </Label>
              <RadioGroup
                value={newRunMethod}
                className="grid gap-3 sm:grid-cols-2"
                onValueChange={(value) =>
                  setNewRunMethod(value as AnalysisMethod)
                }
              >
                {(["bayesian_ab", "bandit"] as const).map((method) => (
                  <Label
                    key={method}
                    htmlFor={`new-run-method-${method}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal transition-colors hover:bg-muted/40",
                      newRunMethod === method && "border-primary bg-muted/30"
                    )}
                  >
                    <RadioGroupItem
                      id={`new-run-method-${method}`}
                      value={method}
                      className="mt-0.5"
                      disabled={createMutation.isPending}
                    />
                    <span className="min-w-0 space-y-1">
                      <span className="block font-medium text-foreground">
                        {t(
                          `releaseDecision.experiments.detailsPage.measuring.methods.${method}`
                        )}
                      </span>
                      <span className="block text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {t(
                          `releaseDecision.experiments.detailsPage.measuring.methodAllocationTypes.${method}`
                        )}
                      </span>
                      <span className="block text-sm leading-5 text-muted-foreground">
                        {t(
                          `releaseDecision.experiments.detailsPage.measuring.methodDescriptions.${method}`
                        )}
                      </span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </section>

            <section className="space-y-4">
              <div className="space-y-1">
                <h3 className="font-medium">
                  {t(
                    `releaseDecision.experiments.detailsPage.measuring.${newRunMethod === "bandit" ? "baselineArms" : "controlTreatments"}`
                  )}
                </h3>
                <p className="text-xs leading-5 text-muted-foreground">
                  {t(
                    "releaseDecision.experiments.detailsPage.measuring.newRunRolesHelp"
                  )}
                </p>
              </div>

              {flagVariations.length < 2 ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {t(
                      "releaseDecision.experiments.detailsPage.measuring.newRunVariationsRequired"
                    )}
                  </span>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-3">
                    <Label className="font-normal text-muted-foreground">
                      {t(
                        `releaseDecision.experiments.detailsPage.measuring.${newRunMethod === "bandit" ? "baseline" : "control"}`
                      )}
                    </Label>
                    <RadioGroup
                      value={newRunControlVariant}
                      className="max-h-40 gap-1 overflow-y-auto pr-1"
                      onValueChange={(control) => {
                        const normalized = normalizeNewRunVariants(
                          control,
                          newRunTreatmentVariants,
                          flagVariations
                        )
                        setNewRunControlVariant(normalized.control)
                        setNewRunTreatmentVariants(normalized.treatments)
                      }}
                    >
                      {flagVariations.map((variation) => (
                        <Label
                          key={variation.id}
                          className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 font-normal hover:bg-muted/50"
                        >
                          <RadioGroupItem
                            value={variation.id}
                            disabled={createMutation.isPending}
                          />
                          <span className="min-w-0 break-words">
                            {variation.name}
                          </span>
                        </Label>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <Label className="font-normal text-muted-foreground">
                      {t(
                        `releaseDecision.experiments.detailsPage.measuring.${newRunMethod === "bandit" ? "arms" : "treatments"}`
                      )}
                    </Label>
                    <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                      {flagVariations
                        .filter(
                          (variation) => variation.id !== newRunControlVariant
                        )
                        .map((variation) => (
                          <Label
                            key={variation.id}
                            className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 font-normal hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={newRunTreatmentVariants.includes(
                                variation.id
                              )}
                              disabled={createMutation.isPending}
                              onCheckedChange={(checked) => {
                                const normalized = normalizeNewRunVariants(
                                  newRunControlVariant,
                                  checked
                                    ? [...newRunTreatmentVariants, variation.id]
                                    : newRunTreatmentVariants.filter(
                                        (id) => id !== variation.id
                                      ),
                                  flagVariations
                                )
                                setNewRunControlVariant(normalized.control)
                                setNewRunTreatmentVariants(
                                  normalized.treatments
                                )
                              }}
                            />
                            <span className="min-w-0 break-words">
                              {variation.name}
                            </span>
                          </Label>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {createMutation.isError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {t(
                  "releaseDecision.experiments.detailsPage.measuring.createFailed"
                )}
              </p>
            ) : null}
          </div>
          <DialogFooter className="mx-0 mb-0 border-t-0 bg-transparent p-0 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={createMutation.isPending}
              onClick={() => setNewRunOpen(false)}
            >
              {t("releaseDecision.experiments.detailsPage.cancel")}
            </Button>
            <Button
              type="button"
              disabled={
                createMutation.isPending ||
                !newRunControlVariant ||
                newRunTreatmentVariants.length === 0 ||
                flagVariations.length < 2
              }
              onClick={() =>
                createMutation.mutate({
                  method: newRunMethod,
                  controlVariant: newRunControlVariant,
                  treatmentVariant: newRunTreatmentVariants.join("|"),
                })
              }
            >
              {createMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}
              {t(
                createMutation.isPending
                  ? "releaseDecision.experiments.detailsPage.measuring.creating"
                  : "releaseDecision.experiments.detailsPage.measuring.createRun"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteRun)}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteRun(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                "releaseDecision.experiments.detailsPage.measuring.deleteTitle"
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans
                i18nKey="releaseDecision.experiments.detailsPage.measuring.deleteDescription"
                values={{ run: deleteRun?.slug }}
                components={{
                  runSlug: (
                    <span className="rounded bg-muted px-1 py-0.5 font-mono font-medium text-foreground" />
                  ),
                }}
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteMutation.isError ? (
            <p className="text-sm text-destructive">
              {t(
                "releaseDecision.experiments.detailsPage.measuring.deleteFailed"
              )}
            </p>
          ) : null}
          <AlertDialogFooter className="border-t-0 bg-transparent">
            <AlertDialogCancel
              render={
                <Button variant="outline" disabled={deleteMutation.isPending} />
              }
            >
              {t("releaseDecision.experiments.detailsPage.cancel")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteRun && deleteMutation.mutate(deleteRun.id)}
            >
              {t(
                deleteMutation.isPending
                  ? "releaseDecision.experiments.detailsPage.measuring.deleting"
                  : "releaseDecision.experiments.detailsPage.measuring.delete"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
