import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
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
  ExperimentLearningUpdate,
} from "../experiment-details-types"

type FormValues = {
  hypothesis: string
  lastLearning: string
}

function valuesOf(experiment: ExperimentDetail): FormValues {
  return {
    hypothesis: experiment.hypothesis ?? "",
    lastLearning: experiment.lastLearning ?? "",
  }
}

export function EditLearningDialog({
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
  onSave: (values: ExperimentLearningUpdate) => Promise<void>
}) {
  const { t } = useTranslation()
  const [discardOpen, setDiscardOpen] = useState(false)
  const schema = useMemo(
    () =>
      z.object({
        hypothesis: z.string(),
        lastLearning: experiment.lastLearning?.trim()
          ? z
              .string()
              .trim()
              .min(
                1,
                t(
                  "releaseDecision.experiments.detailsPage.learning.edit.keyLearningRequired"
                )
              )
          : z.string(),
      }),
    [experiment.lastLearning, t]
  )
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valuesOf(experiment),
    mode: "onChange",
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
              {t("releaseDecision.experiments.detailsPage.learning.edit.title")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "releaseDecision.experiments.detailsPage.learning.edit.subtitle"
              )}
            </DialogDescription>
          </DialogHeader>
          <form
            className="contents"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await onSave({
                  hypothesis: values.hypothesis.trim() || null,
                  lastLearning: values.lastLearning.trim() || null,
                })
                onOpenChange(false)
              } catch {
                // The mutation state renders recoverable feedback in the form.
              }
            })}
          >
            <div className="min-h-0 space-y-4 overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="experiment-learning-hypothesis">
                  {t(
                    "releaseDecision.experiments.detailsPage.learning.hypothesis"
                  )}
                </Label>
                <Textarea
                  id="experiment-learning-hypothesis"
                  rows={4}
                  className="resize-none"
                  disabled={saving}
                  {...form.register("hypothesis")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="experiment-key-learning">
                  {t(
                    "releaseDecision.experiments.detailsPage.learning.keyLearning"
                  )}
                </Label>
                <Textarea
                  id="experiment-key-learning"
                  rows={5}
                  className="resize-none"
                  disabled={saving}
                  {...form.register("lastLearning")}
                />
                {form.formState.errors.lastLearning?.message ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.lastLearning.message}
                  </p>
                ) : null}
              </div>
              {saveError ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {t(
                    "releaseDecision.experiments.detailsPage.learning.edit.saveFailed"
                  )}
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
              <Button
                type="submit"
                disabled={saving || !form.formState.isValid}
              >
                {saving ? <Loader2 className="animate-spin" /> : null}
                {t(
                  saving
                    ? "releaseDecision.experiments.detailsPage.learning.edit.saving"
                    : "releaseDecision.experiments.detailsPage.learning.edit.save"
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
              {t(
                "releaseDecision.experiments.detailsPage.learning.edit.discardTitle"
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "releaseDecision.experiments.detailsPage.learning.edit.discardDescription"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDiscardOpen(false)}
            >
              {t(
                "releaseDecision.experiments.detailsPage.learning.edit.keepEditing"
              )}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDiscardOpen(false)
                onOpenChange(false)
              }}
            >
              {t(
                "releaseDecision.experiments.detailsPage.learning.edit.discard"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
