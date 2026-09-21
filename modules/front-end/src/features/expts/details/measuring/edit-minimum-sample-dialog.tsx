import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { MeasuringRun } from "./measuring-types"
import {
  minimumSampleSchema,
  type MinimumSampleFormValues,
  type MinimumSampleUpdate,
} from "./minimum-sample"
import { MinimumSampleField } from "./minimum-sample-field"

export function EditMinimumSampleDialog({
  run,
  saving,
  saveError,
  onClose,
  onSave,
}: {
  run: MeasuringRun
  saving: boolean
  saveError: boolean
  onClose: () => void
  onSave: (update: MinimumSampleUpdate) => Promise<void>
}) {
  const { t } = useTranslation()
  const key = "releaseDecision.experiments.detailsPage.measuring"
  const form = useForm<MinimumSampleFormValues, unknown, MinimumSampleUpdate>({
    resolver: zodResolver(minimumSampleSchema),
    defaultValues: {
      minimumSample: run.minimumSample == null ? "" : String(run.minimumSample),
    },
  })

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>{t(`${key}.editMinimumSample`)}</DialogTitle>
          <DialogDescription>
            {t(`${key}.minimumSampleDescription`, { run: run.slug })}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async (update) => {
            try {
              await onSave(update)
            } catch {
              // Keep the entered value and show the mutation's error for retry.
            }
          })}
        >
          <MinimumSampleField
            id="run-minimum-sample"
            register={form.register}
            invalid={Boolean(form.formState.errors.minimumSample)}
            disabled={saving}
          />
          {saveError ? (
            <p role="alert" className="text-sm text-destructive">
              {t(`${key}.minimumSampleSaveFailed`)}
            </p>
          ) : null}
          <DialogFooter className="mx-0 mb-0 border-t-0 bg-transparent p-0 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
            >
              {t("releaseDecision.experiments.detailsPage.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              {t(saving ? `${key}.saving` : `${key}.saveChanges`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
