import { ArrowRight, Pencil, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import type {
  ExperimentDetail,
  ExperimentDetailsUpdate,
} from "../experiment-details-types"
import { EditDetailsDialog } from "./edit-details-dialog"

const FIELDS = [
  "description",
  "goal",
  "intent",
  "hypothesis",
  "change",
  "constraints",
] as const

function hasConflict(value: string | null) {
  if (!value) return false
  const normalized = value.toLowerCase()
  if (
    normalized.includes("no conflict") ||
    normalized.includes("no active experiment conflict")
  ) {
    return false
  }
  return [
    "conflict",
    "overlap",
    "over-allocation",
    "mixed assignment",
    "⚠",
  ].some((marker) => normalized.includes(marker))
}

export function HypothesisDetails({
  experiment,
  saving,
  saveError,
  advancing,
  advanceError,
  onSave,
  onAdvance,
}: {
  experiment: ExperimentDetail
  saving: boolean
  saveError: boolean
  advancing: boolean
  advanceError: boolean
  onSave: (values: ExperimentDetailsUpdate) => Promise<void>
  onAdvance: () => void
}) {
  const { t } = useTranslation()
  const [editOpen, setEditOpen] = useState(false)

  return (
    <section className="rounded-lg border bg-background px-6 py-6">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            {t("releaseDecision.experiments.detailsPage.hypothesis.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("releaseDecision.experiments.detailsPage.hypothesis.subtitle")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setEditOpen(true)}
        >
          <Pencil />
          {t("releaseDecision.experiments.detailsPage.hypothesis.edit")}
        </Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border">
        {FIELDS.map((field, index) => {
          const value = experiment[field]
          return (
            <div
              key={field}
              className={`grid min-h-12 grid-cols-[220px_minmax(0,1fr)] gap-6 px-4 py-3 text-sm max-[959px]:grid-cols-1 max-[959px]:gap-1 ${
                index ? "border-t" : ""
              }`}
            >
              <span className="font-medium">
                {t(`releaseDecision.experiments.detailsPage.fields.${field}`)}
              </span>
              <span
                className={`leading-6 whitespace-pre-wrap ${
                  value ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {value ||
                  t("releaseDecision.experiments.detailsPage.notProvided")}
              </span>
            </div>
          )
        })}
      </div>

      {hasConflict(experiment.conflictAnalysis) ? (
        <div className="mt-4 flex gap-3 rounded-lg border border-amber-500/35 bg-amber-500/5 p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 space-y-1">
            <p className="font-medium">
              {t("releaseDecision.experiments.detailsPage.conflict.title")}
            </p>
            <p className="leading-5 whitespace-pre-wrap text-muted-foreground">
              {experiment.conflictAnalysis}
            </p>
          </div>
        </div>
      ) : null}

      {experiment.stage === "hypothesis" ? (
        <div className="mt-6 flex flex-col items-end gap-2">
          {advanceError ? (
            <p className="text-sm text-destructive">
              {t("releaseDecision.experiments.detailsPage.advanceFailed")}
            </p>
          ) : null}
          <Button
            type="button"
            size="lg"
            className="gap-2 px-3"
            disabled={advancing}
            onClick={onAdvance}
          >
            {t(
              advancing
                ? "releaseDecision.experiments.detailsPage.advancing"
                : "releaseDecision.experiments.detailsPage.continueToExposure"
            )}
            <ArrowRight />
          </Button>
        </div>
      ) : null}

      <EditDetailsDialog
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
