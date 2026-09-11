import { zodResolver } from "@hookform/resolvers/zod"
import { Info, Loader2, Lock, X } from "lucide-react"
import { useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import type { ProjectEnv } from "@/features/layout/layout-types"
import type { CreateExperimentPayload } from "../experiment-types"

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "releaseDecision.experiments.form.nameRequired")
    .max(256, "releaseDecision.experiments.form.nameTooLong"),
  description: z
    .string()
    .max(1000, "releaseDecision.experiments.form.descriptionTooLong"),
})

type FormValues = z.infer<typeof schema>

export function ExperimentSheet({
  projectEnv,
  saving,
  saveError,
  onOpenChange,
  onSubmit,
}: {
  projectEnv: ProjectEnv | null
  saving: boolean
  saveError: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: CreateExperimentPayload) => Promise<void>
}) {
  const { t } = useTranslation()
  const [discardOpen, setDiscardOpen] = useState(false)
  const contextValid = Boolean(projectEnv?.projectKey && projectEnv.envId)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { name: "", description: "" },
  })
  const isDirty = form.formState.isDirty

  function requestClose() {
    if (saving) return
    if (isDirty) setDiscardOpen(true)
    else onOpenChange(false)
  }

  return (
    <>
      <Sheet
        open
        onOpenChange={(nextOpen, eventDetails) => {
          if (nextOpen) return
          if (saving) {
            eventDetails.cancel()
            return
          }
          if (isDirty) {
            eventDetails.cancel()
            setDiscardOpen(true)
            return
          }
          onOpenChange(false)
        }}
      >
        <SheetContent
          className="gap-0 data-[side=right]:w-[min(100vw,460px)] data-[side=right]:sm:max-w-[460px]"
          showCloseButton={false}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-3 right-3"
            disabled={saving}
            aria-label={t("releaseDecision.experiments.form.close")}
            onClick={requestClose}
          >
            <X />
          </Button>
          <SheetHeader className="border-b px-6 py-5 pr-12">
            <SheetTitle>
              {t("releaseDecision.experiments.form.title")}
            </SheetTitle>
            <SheetDescription className="mt-1.5 max-w-sm leading-5">
              {t("releaseDecision.experiments.form.subtitle")}
            </SheetDescription>
          </SheetHeader>

          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={form.handleSubmit(async (values) => {
              if (!projectEnv?.projectKey) return
              await onSubmit({
                name: values.name.trim(),
                description: values.description.trim() || null,
                featBitProjectKey: projectEnv.projectKey,
              })
            })}
          >
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <div className="space-y-2">
                <Label htmlFor="experiment-name">
                  {t("releaseDecision.experiments.form.name")}
                </Label>
                <Input
                  id="experiment-name"
                  placeholder={t(
                    "releaseDecision.experiments.form.namePlaceholder"
                  )}
                  maxLength={256}
                  aria-invalid={Boolean(form.formState.errors.name)}
                  {...form.register("name")}
                />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">
                    {t(form.formState.errors.name.message!)}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>{t("releaseDecision.experiments.form.context")}</Label>
                <div className="relative rounded-lg border bg-muted/20 p-4 pr-11">
                  {contextValid && projectEnv ? (
                    <>
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">
                          {projectEnv.projectName}
                        </span>
                        <code className="max-w-40 truncate rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {projectEnv.projectKey}
                        </code>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t("releaseDecision.experiments.form.environment", {
                          name: projectEnv.envName,
                        })}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-destructive">
                      {t("releaseDecision.experiments.form.contextMissing")}
                    </p>
                  )}
                  <Lock className="absolute top-4 right-4 size-4 text-muted-foreground" />
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  {t(
                    contextValid
                      ? "releaseDecision.experiments.form.contextHelper"
                      : "releaseDecision.experiments.form.contextMissingHelper"
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="experiment-description">
                  {t("releaseDecision.experiments.form.description")}
                </Label>
                <Textarea
                  id="experiment-description"
                  className="min-h-24 resize-none"
                  maxLength={1000}
                  {...form.register("description")}
                />
              </div>

              <div className="flex gap-3 rounded-lg border bg-muted/20 p-4 text-sm leading-5 text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0 text-foreground" />
                <p>{t("releaseDecision.experiments.form.startNote")}</p>
              </div>

              {saveError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {t("releaseDecision.experiments.createFailed")}
                </div>
              ) : null}
            </div>

            <SheetFooter className="flex-row justify-end px-6 py-5">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={requestClose}
              >
                {t("releaseDecision.experiments.form.cancel")}
              </Button>
              <Button
                type="submit"
                className="min-w-40"
                disabled={!form.formState.isValid || !contextValid || saving}
              >
                {saving ? <Loader2 className="animate-spin" /> : null}
                {t(
                  saving
                    ? "releaseDecision.experiments.form.saving"
                    : "releaseDecision.experiments.form.create"
                )}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("releaseDecision.experiments.form.discardTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("releaseDecision.experiments.form.discardDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t-0 bg-transparent">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDiscardOpen(false)}
            >
              {t("releaseDecision.experiments.form.keepEditing")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => onOpenChange(false)}
            >
              {t("releaseDecision.experiments.form.discard")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
