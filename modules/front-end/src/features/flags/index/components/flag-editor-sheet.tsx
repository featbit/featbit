import { zodResolver } from "@hookform/resolvers/zod"
import { Box, Flag, Loader2 } from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { getCurrentProjectEnv } from "@/features/layout/layout-context"
import { slugify } from "@/lib/slugify"
import type { FeatureFlag, FlagCreationPayload } from "../../flags-types"
import { FlagTagPicker } from "./flag-tag-picker"
import {
  createDefaultFlagVariationSettings,
  isFlagVariationValueValid,
} from "./flag-variation-draft"
import { FlagVariationsEditor } from "./flag-variations-editor"

const schema = z
  .object({
    name: z.string().trim().min(1).max(200),
    key: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[A-Za-z0-9._-]+$/),
    description: z.string().max(1000),
    tags: z.string(),
    variationType: z.enum(["boolean", "string", "number", "json"]),
    variations: z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string().trim().min(1),
          value: z.string(),
        })
      )
      .min(1),
    enabledVariationId: z.string().min(1),
    disabledVariationId: z.string().min(1),
    isEnabled: z.boolean(),
    insightsEnabled: z.boolean(),
  })
  .superRefine((values, context) => {
    values.variations.forEach((variation, index) => {
      if (!isFlagVariationValueValid(values.variationType, variation.value)) {
        context.addIssue({
          code: "custom",
          path: ["variations", index, "value"],
          message: "invalidVariationValue",
        })
      }
    })
    const variationIds = new Set(
      values.variations.map((variation) => variation.id)
    )
    if (!variationIds.has(values.enabledVariationId)) {
      context.addIssue({
        code: "custom",
        path: ["enabledVariationId"],
        message: "enabledVariationRequired",
      })
    }
    if (!variationIds.has(values.disabledVariationId)) {
      context.addIssue({
        code: "custom",
        path: ["disabledVariationId"],
        message: "disabledVariationRequired",
      })
    }
  })
type Values = z.infer<typeof schema>

export function FlagEditorSheet({
  envId,
  open,
  source,
  saving,
  onOpenChange,
  onValidateKey,
  onCreate,
  onClone,
}: {
  envId: string
  open: boolean
  source: FeatureFlag | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onValidateKey: (key: string) => Promise<boolean>
  onCreate: (payload: FlagCreationPayload) => Promise<void>
  onClone: (
    source: FeatureFlag,
    payload: { name: string; key: string; description: string; tags: string[] }
  ) => Promise<void>
}) {
  const { t } = useTranslation()
  const sourceContext = getCurrentProjectEnv()
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [variationDialogOpen, setVariationDialogOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [keyValidation, setKeyValidation] = useState<{
    key: string
    envId: string
    state: "valid" | "duplicate" | "error"
  } | null>(null)
  const [initialVariationSettings] = useState(() =>
    createDefaultFlagVariationSettings()
  )
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      name: "",
      key: "",
      description: "",
      tags: "",
      insightsEnabled: true,
      ...initialVariationSettings,
    },
  })
  const type = useWatch({ control: form.control, name: "variationType" })
  const key = useWatch({ control: form.control, name: "key" }).trim()
  const keyValidFormat =
    key.length > 0 && key.length <= 200 && /^[A-Za-z0-9._-]+$/.test(key)
  const keyState = !keyValidFormat
    ? "idle"
    : keyValidation?.key === key && keyValidation.envId === envId
      ? keyValidation.state
      : "validating"

  useEffect(() => {
    if (!open || !keyValidFormat) return
    let active = true
    const timeout = window.setTimeout(() => {
      onValidateKey(key)
        .then((used) => {
          if (active)
            setKeyValidation({
              key,
              envId,
              state: used ? "duplicate" : "valid",
            })
        })
        .catch(() => {
          if (active) setKeyValidation({ key, envId, state: "error" })
        })
    }, 300)
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [open, key, keyValidFormat, envId, onValidateKey])
  const isEnabled = useWatch({ control: form.control, name: "isEnabled" })
  const insightsEnabled = useWatch({
    control: form.control,
    name: "insightsEnabled",
  })
  const tags = useWatch({ control: form.control, name: "tags" })
  const variations = useWatch({ control: form.control, name: "variations" })
  const enabledVariationId = useWatch({
    control: form.control,
    name: "enabledVariationId",
  })
  const disabledVariationId = useWatch({
    control: form.control,
    name: "disabledVariationId",
  })
  const isDirty = form.formState.isDirty

  useEffect(() => {
    if (!open) return
    setKeyValidation(null)
    const cloneName = source
      ? t("featureFlags.editor.copyName", { name: source.name })
      : ""
    const variationSettings = createDefaultFlagVariationSettings()
    form.reset(
      source
        ? {
            name: cloneName,
            key: slugify(cloneName),
            description: source.description ?? "",
            tags: source.tags.join(", "),
            insightsEnabled: true,
            ...variationSettings,
          }
        : {
            name: "",
            key: "",
            description: "",
            tags: "",
            insightsEnabled: true,
            ...variationSettings,
          }
    )
  }, [form, open, source, t])

  const nestedSurfaceOpen = tagPickerOpen || variationDialogOpen || discardOpen

  function attemptClose() {
    if (saving || tagPickerOpen || variationDialogOpen) return
    if (isDirty) {
      setDiscardOpen(true)
    } else {
      onOpenChange(false)
    }
  }

  const submit = form.handleSubmit(async (values) => {
    if (saving || keyState !== "valid") return
    const keyUsed = await onValidateKey(values.key)
    if (keyUsed) {
      form.setError("key", {
        message: t("featureFlags.editor.keyInUse"),
      })
      return
    }
    const tags = values.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
    if (source) {
      await onClone(source, {
        name: values.name,
        key: values.key,
        description: values.description,
        tags,
      })
      return
    }
    await onCreate({
      name: values.name,
      key: values.key,
      description: values.description,
      tags,
      isEnabled: values.isEnabled,
      insightsEnabled: values.insightsEnabled,
      variationType: values.variationType,
      enabledVariationId: values.enabledVariationId,
      disabledVariationId: values.disabledVariationId,
      variations: values.variations,
    })
  })

  const nameField = form.register("name")

  const commonFields = (
    <>
      <div className="space-y-2">
        <Label htmlFor="flag-name">
          {t("featureFlags.editor.name")}
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
          <span className="sr-only">{t("featureFlags.editor.required")}</span>
        </Label>
        <Input
          id="flag-name"
          placeholder={t("featureFlags.editor.namePlaceholder")}
          disabled={saving}
          required
          aria-required="true"
          aria-invalid={Boolean(form.formState.errors.name)}
          {...nameField}
          onChange={(event) => {
            nameField.onChange(event)
            form.setValue("key", slugify(event.target.value), {
              shouldDirty: true,
              shouldValidate: true,
            })
          }}
        />
        {form.formState.errors.name ? (
          <p className="text-xs text-destructive">
            {t("featureFlags.editor.invalidName")}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="flag-key">
          {t("featureFlags.editor.key")}
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
          <span className="sr-only">{t("featureFlags.editor.required")}</span>
        </Label>
        <Input
          id="flag-key"
          placeholder={t("featureFlags.editor.keyPlaceholder")}
          disabled={saving}
          className="font-mono"
          aria-invalid={
            Boolean(form.formState.errors.key) ||
            keyState === "duplicate" ||
            keyState === "error"
          }
          required
          aria-required="true"
          {...form.register("key")}
        />
        <p className="text-xs text-muted-foreground">
          {t("featureFlags.editor.keyHelp")}
        </p>
        {form.formState.errors.key ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.key.type === "manual"
              ? form.formState.errors.key.message
              : t("featureFlags.editor.invalidKey")}
          </p>
        ) : null}
        {!form.formState.errors.key && keyState !== "idle" ? (
          <p
            className={
              keyState === "duplicate" || keyState === "error"
                ? "text-xs text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            {t(
              keyState === "duplicate"
                ? "featureFlags.editor.keyInUse"
                : keyState === "error"
                  ? "featureFlags.editor.keyValidationFailed"
                  : keyState === "validating"
                    ? "featureFlags.editor.validatingKey"
                    : "featureFlags.editor.keyAvailable"
            )}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="flag-description">
          {t("featureFlags.editor.description")}
        </Label>
        <Textarea
          id="flag-description"
          disabled={saving}
          rows={2}
          {...form.register("description")}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("featureFlags.editor.tags")}</Label>
        <FlagTagPicker
          envId={envId}
          tags={tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)}
          disabled={saving}
          onOpenChange={setTagPickerOpen}
          onChange={(nextTags) =>
            form.setValue("tags", nextTags.join(", "), {
              shouldDirty: true,
            })
          }
        />
      </div>
    </>
  )

  const footerActions = (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={saving}
        onClick={attemptClose}
      >
        {t("featureFlags.editor.cancel")}
      </Button>
      <Button
        type="button"
        disabled={saving || !form.formState.isValid || keyState !== "valid"}
        onClick={() => void submit()}
      >
        {saving ? <Loader2 className="animate-spin" /> : null}
        {source
          ? t("featureFlags.editor.clone")
          : t("featureFlags.editor.create")}
      </Button>
    </>
  )

  const discardDialog = (
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("featureFlags.editor.discardTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("featureFlags.editor.discardDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="border-t-0 bg-transparent">
          <Button variant="outline" onClick={() => setDiscardOpen(false)}>
            {t("featureFlags.editor.keepEditing")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setDiscardOpen(false)
              onOpenChange(false)
            }}
          >
            {t("featureFlags.editor.discard")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  if (source) {
    return (
      <>
        <Dialog
          open={open}
          disablePointerDismissal={nestedSurfaceOpen}
          onOpenChange={(next) => {
            if (!next && !nestedSurfaceOpen) attemptClose()
          }}
        >
          <DialogContent className="sm:max-w-lg" showCloseButton={!saving}>
            <DialogHeader>
              <DialogTitle>{t("featureFlags.editor.cloneTitle")}</DialogTitle>
              <DialogDescription>
                {t("featureFlags.editor.cloneDescription")}
              </DialogDescription>
              <div className="mt-1 grid min-w-0 gap-2 rounded-lg border bg-muted/30 p-2 text-left sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border">
                    <Flag aria-hidden className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {source.name}
                    </p>
                    <code className="block truncate text-xs leading-4 text-muted-foreground">
                      {source.key}
                    </code>
                  </div>
                </div>
                {sourceContext ? (
                  <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:max-w-48">
                    <Box aria-hidden className="size-4 shrink-0" />
                    <span className="truncate">
                      {sourceContext.projectName} / {sourceContext.envName}
                    </span>
                  </div>
                ) : null}
              </div>
            </DialogHeader>
            <form className="space-y-5 pt-2" onSubmit={submit}>
              <h3 className="text-sm font-semibold text-foreground">
                {t("featureFlags.editor.cloneDetails")}
              </h3>
              {commonFields}
            </form>
            <DialogFooter className="mx-0 mb-0 border-t-0 bg-transparent p-0 pt-2">
              {footerActions}
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {discardDialog}
      </>
    )
  }

  return (
    <>
      <Sheet
        open={open}
        disablePointerDismissal={nestedSurfaceOpen}
        onOpenChange={(next) => {
          if (!next && !nestedSurfaceOpen) attemptClose()
        }}
      >
        <SheetContent
          className="data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
          showCloseButton={!saving}
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>{t("featureFlags.editor.newTitle")}</SheetTitle>
          </SheetHeader>
          <form
            className="min-h-0 flex-1 overflow-y-auto px-6 py-2"
            onSubmit={submit}
          >
            <div className="space-y-5">
              <div className="space-y-4">{commonFields}</div>
              <FlagVariationsEditor
                disabled={saving}
                onNestedSurfaceOpenChange={setVariationDialogOpen}
                value={{
                  variationType: type,
                  variations,
                  enabledVariationId,
                  disabledVariationId,
                  isEnabled,
                }}
                behaviorSettings={
                  <div className="space-y-5 pt-1">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-6">
                      <div className="space-y-1">
                        <Label htmlFor="flag-enabled">
                          {t("featureFlags.variationsEditor.turnOn")}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {t("featureFlags.editor.turnOnHelp")}
                        </p>
                      </div>
                      <Switch
                        id="flag-enabled"
                        className="mt-0.5"
                        checked={isEnabled}
                        disabled={saving}
                        onCheckedChange={(checked) =>
                          form.setValue("isEnabled", checked, {
                            shouldDirty: true,
                          })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-6">
                      <div className="space-y-1">
                        <Label htmlFor="flag-insights-enabled">
                          {t(
                            "featureFlags.detailsPage.settings.insightCollection"
                          )}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {t("featureFlags.editor.insightsHelp")}
                        </p>
                      </div>
                      <Switch
                        id="flag-insights-enabled"
                        className="mt-0.5"
                        checked={insightsEnabled}
                        disabled={saving}
                        onCheckedChange={(checked) =>
                          form.setValue("insightsEnabled", checked, {
                            shouldDirty: true,
                          })
                        }
                      />
                    </div>
                  </div>
                }
                onChange={(nextValue) => {
                  form.setValue("variationType", nextValue.variationType, {
                    shouldDirty: true,
                  })
                  form.setValue("variations", nextValue.variations, {
                    shouldDirty: true,
                  })
                  form.setValue(
                    "enabledVariationId",
                    nextValue.enabledVariationId,
                    { shouldDirty: true }
                  )
                  form.setValue(
                    "disabledVariationId",
                    nextValue.disabledVariationId,
                    { shouldDirty: true }
                  )
                  form.setValue("isEnabled", nextValue.isEnabled, {
                    shouldDirty: true,
                  })
                  void form.trigger()
                }}
              />
            </div>
          </form>
          <SheetFooter className="flex-row justify-end px-6 py-4">
            {footerActions}
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {discardDialog}
    </>
  )
}
