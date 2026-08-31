import { ChevronDown, ChevronUp, Pencil } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type {
  ExperimentDetail,
  ExperimentLearningUpdate,
  ExperimentRunDetail,
} from "../experiment-details-types"
import { EditLearningDialog } from "./edit-learning-dialog"
import {
  hasCapturedLearning,
  LEARNING_FIELDS,
  normalizedDecision,
  orderExperimentRuns,
} from "./learning-utils"

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const normalized = status.trim().toLowerCase()
  const dot =
    normalized === "decided"
      ? "bg-emerald-600"
      : normalized === "collecting"
        ? "bg-blue-600"
        : normalized === "analyzing"
          ? "bg-violet-600"
          : "bg-muted-foreground"
  const known = [
    "draft",
    "collecting",
    "analyzing",
    "decided",
    "archived",
  ].includes(normalized)

  return (
    <Badge variant="outline" className="gap-2 font-normal capitalize">
      <span className={cn("size-1.5 rounded-full", dot)} />
      {known
        ? t(
            `releaseDecision.experiments.detailsPage.learning.statuses.${normalized}`
          )
        : status}
    </Badge>
  )
}

function DecisionBadge({ decision }: { decision: string | null }) {
  const { t } = useTranslation()
  const normalized = normalizedDecision(decision)
  if (!normalized) return null

  const key = normalized.includes("ROLLBACK")
    ? "rollback"
    : normalized === "CONTINUE"
      ? "continue"
      : normalized === "PAUSE"
        ? "pause"
        : normalized === "INCONCLUSIVE"
          ? "inconclusive"
          : null
  const color =
    key === "continue"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
      : key === "pause"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
        : key === "rollback"
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          : "border-border bg-muted/50 text-muted-foreground"

  return (
    <Badge variant="outline" className={cn("font-normal", color)}>
      {key
        ? t(`releaseDecision.experiments.detailsPage.learning.decisions.${key}`)
        : decision}
    </Badge>
  )
}

function EvidenceRationale({ value }: { value: string }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

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
            className={cn(
              "leading-6 whitespace-pre-wrap text-muted-foreground",
              !expanded && "line-clamp-2"
            )}
          >
            {value}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-7 px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={() => setExpanded((current) => !current)}
          >
            {t(
              `releaseDecision.experiments.detailsPage.learning.${expanded ? "showLess" : "showMore"}`
            )}
            {expanded ? <ChevronUp /> : <ChevronDown />}
          </Button>
        </div>
      </div>
    </div>
  )
}

function RunLearning({ run }: { run: ExperimentRunDetail }) {
  const { t } = useTranslation()
  const fields = LEARNING_FIELDS.filter((field) => Boolean(run[field]?.trim()))
  const hasLearning = hasCapturedLearning(run)

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex min-h-13 flex-wrap items-center gap-2 px-4 py-3">
        <code className="mr-2 rounded bg-muted px-2 py-1 text-xs">
          {run.slug}
        </code>
        <Badge variant="outline" className="font-normal">
          {run.method === "bandit"
            ? t("releaseDecision.experiments.methods.bandit")
            : t("releaseDecision.experiments.methods.bayesian")}
        </Badge>
        <StatusBadge status={run.status} />
        <div className="ml-auto">
          <DecisionBadge decision={run.decision} />
        </div>
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
        <EvidenceRationale value={run.decisionReason} />
      ) : null}
    </div>
  )
}

export function LearningDetails({
  experiment,
  saving,
  saveError,
  onSave,
}: {
  experiment: ExperimentDetail
  saving: boolean
  saveError: boolean
  onSave: (values: ExperimentLearningUpdate) => Promise<void>
}) {
  const { t } = useTranslation()
  const runs = useMemo(
    () => orderExperimentRuns(experiment.experimentRuns ?? []),
    [experiment.experimentRuns]
  )
  const [selectedRunId, setSelectedRunId] = useState(runs[0]?.id ?? "")
  const [editOpen, setEditOpen] = useState(false)

  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0]

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
          <>
            {runs.length > 1 ? (
              <Tabs value={selectedRun?.id} onValueChange={setSelectedRunId}>
                <TabsList>
                  {runs.map((run, index) => (
                    <TabsTrigger
                      key={run.id}
                      value={run.id}
                      className="min-w-20 px-3"
                    >
                      {t(
                        "releaseDecision.experiments.detailsPage.learning.run",
                        {
                          number: index + 1,
                        }
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            ) : null}
            {selectedRun ? <RunLearning run={selectedRun} /> : null}
          </>
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
