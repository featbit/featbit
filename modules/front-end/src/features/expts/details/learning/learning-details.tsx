import { CalendarDays, ChevronDown, ChevronUp, Pencil } from "lucide-react"
import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ExperimentRunTabs } from "../components/experiment-run-tabs"
import type {
  ExperimentDetail,
  ExperimentLearningUpdate,
  ExperimentRunDetail,
} from "../experiment-details-types"
import { EditLearningDialog } from "./edit-learning-dialog"
import {
  hasCapturedLearning,
  LEARNING_FIELDS,
  orderExperimentRuns,
} from "./learning-utils"

type LearningRun = ExperimentRunDetail & {
  observationStart?: string | null
  observationEnd?: string | null
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

function EvidenceRationale({ value }: { value: string }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const rationaleRef = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    if (expanded) return

    const rationale = rationaleRef.current
    if (!rationale) return

    const updateOverflow = () => {
      setOverflows(rationale.scrollHeight > rationale.clientHeight + 1)
    }

    updateOverflow()
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateOverflow)
    resizeObserver?.observe(rationale)
    window.addEventListener("resize", updateOverflow)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener("resize", updateOverflow)
    }
  }, [expanded, value])

  return (
    <div className="border-t px-4 py-3">
      <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-6 text-sm @max-[640px]/learning:grid-cols-1 @max-[640px]/learning:gap-1">
        <span className="font-medium">
          {t(
            "releaseDecision.experiments.detailsPage.learning.evidenceRationale"
          )}
        </span>
        <div className="min-w-0">
          <p
            ref={rationaleRef}
            className={cn(
              "leading-6 whitespace-pre-wrap text-muted-foreground",
              !expanded && "line-clamp-2"
            )}
          >
            {value}
          </p>
          {overflows ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 h-7 px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              {t(
                `releaseDecision.experiments.detailsPage.learning.${expanded ? "showLess" : "showMore"}`
              )}
              {expanded ? <ChevronUp /> : <ChevronDown />}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function RunLearning({ run }: { run: LearningRun }) {
  const { t, i18n } = useTranslation()
  const fields = LEARNING_FIELDS.filter((field) => Boolean(run[field]?.trim()))
  const hasLearning = hasCapturedLearning(run)

  return (
    <div>
      <div className="flex min-h-13 flex-wrap items-center gap-2 px-4 py-3">
        <h4 className="mr-1 font-mono text-lg font-semibold">{run.slug}</h4>
        <Badge variant="outline" className="font-normal">
          {run.method === "bandit"
            ? t("releaseDecision.experiments.methods.bandit")
            : t("releaseDecision.experiments.methods.bayesian")}
        </Badge>
        <Badge variant="outline" className="gap-2 font-normal">
          <CalendarDays />
          {t(
            "releaseDecision.experiments.detailsPage.measuring.observationWindow"
          )}{" "}
          · {formatDate(run.observationStart, i18n.language)} →{" "}
          {formatDate(run.observationEnd, i18n.language)}
        </Badge>
      </div>

      {run.decisionSummary?.trim() ? (
        <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-6 border-t px-4 py-3 text-sm @max-[640px]/learning:grid-cols-1 @max-[640px]/learning:gap-1">
          <span className="font-medium">
            {t(
              "releaseDecision.experiments.detailsPage.learning.decisionSummary"
            )}
          </span>
          <p className="leading-6 whitespace-pre-wrap">{run.decisionSummary}</p>
        </div>
      ) : null}

      {hasLearning ? (
        <div className="divide-y border-t">
          {fields.map((field) => (
            <div
              key={field}
              className="grid min-h-18 grid-cols-[180px_minmax(0,1fr)] gap-6 px-4 py-3 text-sm @max-[640px]/learning:grid-cols-1 @max-[640px]/learning:gap-1"
            >
              <span className="font-medium">
                {t(
                  `releaseDecision.experiments.detailsPage.learning.fields.${field}`
                )}
              </span>
              <p className="w-full leading-6 whitespace-pre-wrap text-muted-foreground">
                {run[field]}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-t p-4">
          <div className="rounded-lg border border-dashed px-4 py-5 text-center">
            <p className="text-sm font-medium">
              {t("releaseDecision.experiments.detailsPage.learning.runEmpty")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                "releaseDecision.experiments.detailsPage.learning.runEmptyHelp"
              )}
            </p>
          </div>
        </div>
      )}

      {run.decisionReason?.trim() ? (
        <EvidenceRationale
          key={`${run.id}:${run.decisionReason}`}
          value={run.decisionReason}
        />
      ) : null}
    </div>
  )
}

export function LearningDetails({
  experiment,
  saving,
  saveError,
  onSave,
  selectedRunId,
  onSelectedRunChange,
}: {
  experiment: ExperimentDetail
  saving: boolean
  saveError: boolean
  onSave: (values: ExperimentLearningUpdate) => Promise<void>
  selectedRunId?: string
  onSelectedRunChange?: (runId: string) => void
}) {
  const { t } = useTranslation()
  const runs = useMemo(
    () => orderExperimentRuns(experiment.experimentRuns ?? []) as LearningRun[],
    [experiment.experimentRuns]
  )
  const [localSelectedRunId, setLocalSelectedRunId] = useState(
    runs.at(-1)?.id ?? ""
  )
  const [editOpen, setEditOpen] = useState(false)

  const effectiveSelectedRunId = selectedRunId ?? localSelectedRunId
  const selectedRun =
    runs.find((run) => run.id === effectiveSelectedRunId) ?? runs.at(-1)
  const selectRun = (runId: string) => {
    setLocalSelectedRunId(runId)
    onSelectedRunChange?.(runId)
  }

  return (
    <section className="@container/learning rounded-lg border bg-background px-6 py-6">
      <div className="flex items-start justify-between gap-6 @max-[480px]/learning:flex-col @max-[480px]/learning:gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            {t("releaseDecision.experiments.detailsPage.learning.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("releaseDecision.experiments.detailsPage.learning.subtitle")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="@max-[480px]/learning:self-start"
          onClick={() => setEditOpen(true)}
        >
          <Pencil />
          {t("releaseDecision.experiments.detailsPage.learning.editAction")}
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 divide-x border-b pb-5 @max-[768px]/learning:grid-cols-1 @max-[768px]/learning:divide-x-0 @max-[768px]/learning:divide-y">
        <div className="pr-8 @max-[768px]/learning:pr-0 @max-[768px]/learning:pb-5">
          <h3 className="text-sm font-medium">
            {t("releaseDecision.experiments.detailsPage.learning.hypothesis")}
          </h3>
          <p
            className={cn(
              "mt-2 text-sm leading-6 whitespace-pre-wrap",
              !experiment.hypothesis && "text-muted-foreground"
            )}
          >
            {experiment.hypothesis ||
              t("releaseDecision.experiments.detailsPage.notProvided")}
          </p>
        </div>
        <div className="pl-8 @max-[768px]/learning:pt-5 @max-[768px]/learning:pl-0">
          <h3 className="text-sm font-medium">
            {t("releaseDecision.experiments.detailsPage.learning.keyLearning")}
          </h3>
          <p
            className={cn(
              "mt-2 text-sm leading-6 whitespace-pre-wrap",
              !experiment.lastLearning && "text-muted-foreground"
            )}
          >
            {experiment.lastLearning ||
              t("releaseDecision.experiments.detailsPage.notProvided")}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <h3 className="text-lg font-semibold">
          {t("releaseDecision.experiments.detailsPage.learning.runsTitle")}
        </h3>

        {!runs.length ? (
          <div className="rounded-lg border border-dashed px-5 py-8 text-center">
            <p className="font-medium">
              {t("releaseDecision.experiments.detailsPage.learning.noRuns")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("releaseDecision.experiments.detailsPage.learning.noRunsHelp")}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <ExperimentRunTabs
              runs={runs}
              selectedRunId={selectedRun?.id ?? ""}
              onSelectedRunChange={selectRun}
              listClassName="border-t-0 border-b"
            />
            {selectedRun ? <RunLearning run={selectedRun} /> : null}
          </div>
        )}
      </div>

      <EditLearningDialog
        open={editOpen}
        experiment={experiment}
        saving={saving}
        saveError={saveError}
        onOpenChange={setEditOpen}
        onSave={onSave}
      />
    </section>
  )
}
