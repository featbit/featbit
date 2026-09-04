import { zodResolver } from "@hookform/resolvers/zod"
import { Info, Loader2, Lock } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Layer, LayerPayload } from "../layers-types"
import { slugifyLayerKey } from "../layers-utils"

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "releaseDecision.layers.form.nameRequired")
    .max(256, "releaseDecision.layers.form.nameTooLong"),
  key: z
    .string()
    .trim()
    .min(1, "releaseDecision.layers.form.keyRequired")
    .max(128, "releaseDecision.layers.form.keyTooLong")
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._:-]*$/,
      "releaseDecision.layers.form.keyInvalid"
    ),
  description: z.string(),
})

type FormValues = z.infer<typeof schema>

export function LayerSheet({
  layer,
  saving,
  onOpenChange,
  onSubmit,
}: {
  layer: Layer | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: LayerPayload) => Promise<void>
}) {
  const { t } = useTranslation()
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(Boolean(layer))
  const [nameInteracted, setNameInteracted] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      name: layer?.name ?? "",
      key: layer?.key ?? "",
      description: layer?.description ?? "",
    },
  })
  const name = useWatch({ control: form.control, name: "name" })

  useEffect(() => {
    if (!keyManuallyEdited) {
      form.setValue("key", slugifyLayerKey(name), {
        shouldDirty: nameInteracted,
        shouldValidate: nameInteracted,
      })
    }
  }, [form, keyManuallyEdited, name, nameInteracted])

  function requestClose() {
    if (saving) return
    if (form.formState.isDirty) setDiscardOpen(true)
    else onOpenChange(false)
  }

  return (
    <>
      <Sheet
        open
        onOpenChange={(nextOpen) => {
          if (!nextOpen) requestClose()
        }}
      >
        <SheetContent
          className="gap-0 data-[side=right]:w-[min(100vw,460px)] data-[side=right]:sm:max-w-[460px]"
          showCloseButton={!saving}
        >
          <SheetHeader className="border-b px-6 py-5 pr-12">
            <SheetTitle>
              {t(
                layer
                  ? "releaseDecision.layers.form.editTitle"
                  : "releaseDecision.layers.form.newTitle"
              )}
            </SheetTitle>
            <SheetDescription className="mt-1.5 max-w-sm leading-5">
              {t(
                layer
                  ? "releaseDecision.layers.form.editDescription"
                  : "releaseDecision.layers.form.newDescription"
              )}
            </SheetDescription>
          </SheetHeader>

          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={form.handleSubmit(async (values) => {
              await onSubmit({
                name: values.name.trim(),
                key: layer?.key ?? values.key.trim(),
                description: values.description.trim(),
                assignmentUnitSelector: "user.keyId",
              })
            })}
          >
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <div className="space-y-2">
                <Label htmlFor="layer-name">
                  {t("releaseDecision.layers.form.name")}
                </Label>
                <Input
                  id="layer-name"
                  maxLength={256}
                  aria-invalid={Boolean(form.formState.errors.name)}
                  {...form.register("name", {
                    onChange: () => setNameInteracted(true),
                  })}
                />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">
                    {t(form.formState.errors.name.message!)}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="layer-key">
                  {t(
                    layer
                      ? "releaseDecision.layers.form.keyReadOnly"
                      : "releaseDecision.layers.form.key"
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="layer-key"
                    className={`font-mono ${layer ? "bg-muted/60 pr-10 text-muted-foreground" : ""}`}
                    maxLength={128}
                    readOnly={Boolean(layer)}
                    aria-invalid={Boolean(form.formState.errors.key)}
                    {...form.register("key", {
                      onChange: () => setKeyManuallyEdited(true),
                    })}
                  />
                  {layer ? (
                    <Lock className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(
                    layer
                      ? "releaseDecision.layers.form.keyReadOnlyHelper"
                      : "releaseDecision.layers.form.keyHelper"
                  )}
                </p>
                {form.formState.errors.key ? (
                  <p className="text-xs text-destructive">
                    {t(form.formState.errors.key.message!)}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="layer-assignment-unit">
                    {t("releaseDecision.layers.form.assignmentUnit")}
                  </Label>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          className="rounded-sm text-muted-foreground"
                        />
                      }
                    >
                      <Info className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-80">
                      {t("releaseDecision.layers.assignmentUnitTooltip")}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="relative">
                  <Input
                    id="layer-assignment-unit"
                    value="user.keyId"
                    readOnly
                    className="bg-muted/60 pr-10 font-mono text-muted-foreground"
                  />
                  <Lock className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  {t("releaseDecision.layers.form.assignmentUnitHelper")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="layer-description">
                  {t("releaseDecision.layers.form.description")}
                </Label>
                <Textarea
                  id="layer-description"
                  className="min-h-24 resize-none"
                  maxLength={1000}
                  {...form.register("description")}
                />
              </div>

              <div className="flex gap-3 rounded-lg border bg-muted/20 p-4 text-sm leading-5 text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0 text-foreground" />
                <p>{t("releaseDecision.layers.form.allocationNote")}</p>
              </div>
            </div>

            <SheetFooter className="flex-row justify-end px-6 py-5">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={requestClose}
              >
                {t("releaseDecision.layers.form.cancel")}
              </Button>
              <Button
                type="submit"
                className="min-w-28"
                disabled={!form.formState.isValid || saving}
              >
                {saving ? <Loader2 className="animate-spin" /> : null}
                {t(
                  saving
                    ? "releaseDecision.layers.form.saving"
                    : layer
                      ? "releaseDecision.layers.form.save"
                      : "releaseDecision.layers.form.create"
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
              {t("releaseDecision.layers.form.discardTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("releaseDecision.layers.form.discardDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t-0 bg-transparent">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDiscardOpen(false)}
            >
              {t("releaseDecision.layers.form.keepEditing")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => onOpenChange(false)}
            >
              {t("releaseDecision.layers.form.discard")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
