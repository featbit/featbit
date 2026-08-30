import { ChevronLeft, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { ExperimentDetail } from "../experiment-details-types"
import { CopyValueButton } from "./copy-value-button"

type Props = {
  experiment: ExperimentDetail
  deleting: boolean
  deleteError: boolean
  onBack: () => void
  onDelete: () => void
}

export function ExperimentSettings({
  experiment,
  deleting,
  deleteError,
  onBack,
  onDelete,
}: Props) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const rows = [
    {
      label: t("releaseDecision.experiments.detailsPage.settings.name"),
      value: experiment.name,
    },
    {
      label: t("releaseDecision.experiments.detailsPage.settings.description"),
      value:
        experiment.description ||
        t("releaseDecision.experiments.detailsPage.notProvided"),
      muted: !experiment.description,
    },
    {
      label: t("releaseDecision.experiments.detailsPage.settings.experimentId"),
      value: experiment.id,
      technical: true,
    },
    ...(experiment.featBitEnvId
      ? [
          {
            label: t(
              "releaseDecision.experiments.detailsPage.settings.environmentId"
            ),
            value: experiment.featBitEnvId,
            technical: true,
          },
        ]
      : []),
  ]

  return (
    <div className="max-w-[1080px] pb-10">
      <Button
        type="button"
        variant="link"
        className="mb-6 -ml-2 h-auto px-2 text-muted-foreground"
        onClick={onBack}
      >
        <ChevronLeft />
        {t("releaseDecision.experiments.detailsPage.settings.back")}
      </Button>

      <div className="space-y-1">
        <h2 className="text-xl font-semibold">
          {t("releaseDecision.experiments.detailsPage.settings.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("releaseDecision.experiments.detailsPage.settings.subtitle")}
        </p>
      </div>

      <section className="mt-8 space-y-3">
        <h3 className="text-base font-semibold">
          {t("releaseDecision.experiments.detailsPage.settings.information")}
        </h3>
        <div className="overflow-hidden rounded-lg border bg-background">
          {rows.map((row, index) => (
            <div
              key={row.label}
              className={`grid min-h-14 grid-cols-[220px_minmax(0,1fr)_auto] items-center gap-6 px-5 py-3 ${
                index ? "border-t" : ""
              }`}
            >
              <span className="text-sm font-medium">{row.label}</span>
              <span
                className={`${
                  row.technical
                    ? "truncate font-mono text-sm"
                    : "text-sm whitespace-pre-wrap"
                } ${row.muted ? "text-muted-foreground" : "text-foreground"}`}
                title={row.technical ? row.value : undefined}
              >
                {row.value}
              </span>
              {row.technical ? <CopyValueButton value={row.value} /> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <h3 className="text-base font-semibold">
          {t("releaseDecision.experiments.detailsPage.settings.dangerZone")}
        </h3>
        <div className="flex items-center justify-between gap-8 rounded-lg border border-destructive/35 bg-background px-5 py-4">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold">
              {t(
                "releaseDecision.experiments.detailsPage.settings.deleteTitle"
              )}
            </p>
            <p className="max-w-3xl text-sm leading-5 text-muted-foreground">
              {t("releaseDecision.experiments.detailsPage.settings.deleteHelp")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            {t("releaseDecision.experiments.detailsPage.settings.deleteAction")}
          </Button>
        </div>
      </section>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => !deleting && setConfirmOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                "releaseDecision.experiments.detailsPage.settings.deleteConfirmTitle",
                { name: experiment.name }
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "releaseDecision.experiments.detailsPage.settings.deleteConfirmDescription",
                { name: experiment.name }
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {t(
                "releaseDecision.experiments.detailsPage.settings.deleteFailed"
              )}
            </p>
          ) : null}
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setConfirmOpen(false)}
            >
              {t("releaseDecision.experiments.detailsPage.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={onDelete}
            >
              {deleting ? <Loader2 className="animate-spin" /> : null}
              {t(
                deleting
                  ? "releaseDecision.experiments.detailsPage.settings.deleting"
                  : "releaseDecision.experiments.detailsPage.settings.deleteAction"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
