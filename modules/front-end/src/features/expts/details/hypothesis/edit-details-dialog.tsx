import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type {
  ExperimentDetail,
  ExperimentDetailsUpdate,
} from "../experiment-details-types"

const schema = z.object({
  description: z.string(),
  goal: z.string(),
  intent: z.string(),
  hypothesis: z.string(),
  change: z.string(),
  constraints: z.string(),
})

type FormValues = z.infer<typeof schema>
type FieldName = keyof FormValues

const FIELDS: FieldName[] = [
  "description",
  "goal",
  "intent",
  "hypothesis",
  "change",
  "constraints",
]

function valuesOf(experiment: ExperimentDetail): FormValues {
  return {
    description: experiment.description ?? "",
    goal: experiment.goal ?? "",
    intent: experiment.intent ?? "",
    hypothesis: experiment.hypothesis ?? "",
    change: experiment.change ?? "",
    constraints: experiment.constraints ?? "",
  }
}

export function EditDetailsDialog({
  open,
  experiment,
  saving,
  saveError,
  onOpenChange,
  onSave,
}: {
  open: boolean
  experiment: ExperimentDetail
  saving: boolean
  saveError: boolean
  onOpenChange: (open: boolean) => void
  onSave: (values: ExperimentDetailsUpdate) => Promise<void>
}) {
  const { t } = useTranslation()
  const [discardOpen, setDiscardOpen] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valuesOf(experiment),
  })

  useEffect(() => {
    if (open) form.reset(valuesOf(experiment))
  }, [experiment, form, open])

  function requestClose() {
    if (saving) return
    if (form.formState.isDirty) setDiscardOpen(true)
    else onOpenChange(false)
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) onOpenChange(true)
          else requestClose()
        }}
      >
        <DialogContent
          className="max-h-[88vh] sm:max-w-3xl"
          showCloseButton={!saving}
        >
          <DialogHeader>
            <DialogTitle>
              {t("releaseDecision.experiments.detailsPage.edit.title")}
            </DialogTitle>
            <DialogDescription>
              {t("releaseDecision.experiments.detailsPage.edit.subtitle")}
            </DialogDescription>
          </DialogHeader>
          <form
            className="contents"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await onSave(
                  Object.fromEntries(
                    Object.entries(values).map(([key, value]) => [
                      key,
                      value.trim() || null,
                    ])
                  ) as ExperimentDetailsUpdate
                )
                onOpenChange(false)
              } catch {
                // The mutation state renders recoverable feedback in the form.
              }
            })}
          >
            <div className="min-h-0 space-y-4 overflow-y-auto">
              {FIELDS.map((field) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={`experiment-${field}`}>
                    {t(
                      `releaseDecision.experiments.detailsPage.fields.${field}`
                    )}
                  </Label>
                  <Textarea
                    id={`experiment-${field}`}
                    rows={1}
                    className="max-h-32 min-h-12 resize-none overflow-y-auto"
                    disabled={saving}
                    {...form.register(field)}
                  />
                </div>
              ))}
              {saveError ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {t("releaseDecision.experiments.detailsPage.edit.saveFailed")}
                </p>
              ) : null}
            </div>
            <DialogFooter className="border-t-0 bg-transparent">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={requestClose}
              >
                {t("releaseDecision.experiments.detailsPage.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : null}
                {t(
                  saving
                    ? "releaseDecision.experiments.detailsPage.edit.saving"
                    : "releaseDecision.experiments.detailsPage.edit.save"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("releaseDecision.experiments.detailsPage.edit.discardTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "releaseDecision.experiments.detailsPage.edit.discardDescription"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDiscardOpen(false)}
            >
              {t("releaseDecision.experiments.detailsPage.edit.keepEditing")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDiscardOpen(false)
                onOpenChange(false)
              }}
            >
              {t("releaseDecision.experiments.detailsPage.edit.discard")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
