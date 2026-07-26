import { zodResolver } from "@hookform/resolvers/zod"
import { Box, Flag, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
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
import { getCurrentProjectEnv } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import type { FeatureFlag, FlagCreationPayload } from "../flags-types"
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
  })
  .superRefine((values, context) => {
    values.variations.forEach((variation, index) => {
      if (!isFlagVariationValueValid(values.variationType, variation.value)) {
        context.addIssue({
          code: "custom",
          path: ["variations", index, "value"],
          message: "Invalid variation value",
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
        message: "Select an enabled variation",
      })
    }
    if (!variationIds.has(values.disabledVariationId)) {
      context.addIssue({
        code: "custom",
        path: ["disabledVariationId"],
        message: "Select a disabled variation",
      })
    }
  })
type Values = z.infer<typeof schema>

function toKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function FlagEditorSheet({
  envId,
  lang,
  open,
  source,
  saving,
  onOpenChange,
  onValidateKey,
  onCreate,
  onClone,
}: {
  envId: string
  lang: Lang
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
  const zh = lang === "zh"
  const sourceContext = getCurrentProjectEnv()
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [variationDialogOpen, setVariationDialogOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [initialVariationSettings] = useState(() =>
    createDefaultFlagVariationSettings()
  )
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      key: "",
      description: "",
      tags: "",
      ...initialVariationSettings,
    },
  })
  const type = useWatch({ control: form.control, name: "variationType" })
  const isEnabled = useWatch({ control: form.control, name: "isEnabled" })
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
    const cloneName = source ? `${source.name} copy` : ""
    const variationSettings = createDefaultFlagVariationSettings()
    form.reset(
      source
        ? {
            name: cloneName,
            key: toKey(cloneName),
            description: source.description ?? "",
            tags: source.tags.join(", "),
            ...variationSettings,
          }
        : {
            name: "",
            key: "",
            description: "",
            tags: "",
            ...variationSettings,
          }
    )
  }, [form, open, source])

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
    const keyUsed = await onValidateKey(values.key)
    if (keyUsed) {
      form.setError("key", {
        message: zh ? "该键已被使用" : "This key is already in use",
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
          {zh ? "名称" : "Name"}
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
          <span className="sr-only">{zh ? "必填" : "required"}</span>
        </Label>
        <Input
          id="flag-name"
          disabled={saving}
          required
          aria-required="true"
          {...nameField}
          onChange={(event) => {
            nameField.onChange(event)
            form.setValue("key", toKey(event.target.value), {
              shouldDirty: true,
              shouldValidate: Boolean(form.formState.errors.key),
            })
          }}
        />
        {form.formState.errors.name ? (
          <p className="text-xs text-destructive">
            {zh ? "请输入有效名称" : "Enter a valid name"}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="flag-key">
          {zh ? "键" : "Key"}
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
          <span className="sr-only">{zh ? "必填" : "required"}</span>
        </Label>
        <Input
          id="flag-key"
          disabled={saving}
          className="font-mono"
          required
          aria-required="true"
          {...form.register("key")}
        />
        {form.formState.errors.key ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.key.message ||
              (zh
                ? "仅支持字母、数字、点、下划线和连字符"
                : "Use letters, numbers, dots, underscores, or hyphens")}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="flag-description">{zh ? "描述" : "Description"}</Label>
        <Textarea
          id="flag-description"
          disabled={saving}
          rows={3}
          {...form.register("description")}
        />
      </div>
      <div className="space-y-2">
        <Label>{zh ? "标签" : "Tags"}</Label>
        <FlagTagPicker
          envId={envId}
          lang={lang}
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
        {zh ? "取消" : "Cancel"}
      </Button>
      <Button type="button" disabled={saving} onClick={() => void submit()}>
        {saving ? <Loader2 className="animate-spin" /> : null}
        {source ? (zh ? "克隆" : "Clone") : zh ? "创建功能开关" : "Create flag"}
      </Button>
    </>
  )

  const discardDialog = (
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {zh ? "放弃更改？" : "Discard changes?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {zh
              ? "尚未保存的功能开关配置将会丢失。"
              : "Your unsaved feature flag configuration will be lost."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="border-t-0 bg-transparent">
          <Button variant="outline" onClick={() => setDiscardOpen(false)}>
            {zh ? "继续编辑" : "Keep editing"}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setDiscardOpen(false)
              onOpenChange(false)
            }}
          >
            {zh ? "放弃更改" : "Discard changes"}
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
              <DialogTitle>
                {zh ? "克隆功能开关" : "Clone feature flag"}
              </DialogTitle>
              <DialogDescription>
                {zh
                  ? "完整的定向配置将被克隆。"
                  : "The complete targeting configuration will be cloned."}
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
                {zh ? "克隆详情" : "Clone details"}
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
            <SheetTitle>{zh ? "新建功能开关" : "New feature flag"}</SheetTitle>
          </SheetHeader>
          <form
            className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
            onSubmit={submit}
          >
            <div className="space-y-5">
              <div className="space-y-5">{commonFields}</div>
              <FlagVariationsEditor
                lang={lang}
                disabled={saving}
                showErrors={form.formState.submitCount > 0}
                onNestedSurfaceOpenChange={setVariationDialogOpen}
                value={{
                  variationType: type,
                  variations,
                  enabledVariationId,
                  disabledVariationId,
                  isEnabled,
                }}
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
