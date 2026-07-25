import { zodResolver } from "@hookform/resolvers/zod"
import { Box, Flag, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { getCurrentProjectEnv } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import type { FeatureFlag, FlagCreationPayload } from "../flags-types"
import { FlagTagPicker } from "./flag-tag-picker"

const schema = z.object({
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
  enabledValue: z.string().min(1),
  disabledValue: z.string().min(1),
  isEnabled: z.boolean(),
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
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      key: "",
      description: "",
      tags: "",
      variationType: "boolean",
      enabledValue: "true",
      disabledValue: "false",
      isEnabled: false,
    },
  })
  const type = useWatch({ control: form.control, name: "variationType" })
  const isEnabled = useWatch({ control: form.control, name: "isEnabled" })
  const tags = useWatch({ control: form.control, name: "tags" })

  useEffect(() => {
    if (!open) return
    const cloneName = source ? `${source.name} copy` : ""
    form.reset(
      source
        ? {
            name: cloneName,
            key: toKey(cloneName),
            description: source.description ?? "",
            tags: source.tags.join(", "),
            variationType: "boolean",
            enabledValue: "true",
            disabledValue: "false",
            isEnabled: false,
          }
        : {
            name: "",
            key: "",
            description: "",
            tags: "",
            variationType: "boolean",
            enabledValue: "true",
            disabledValue: "false",
            isEnabled: false,
          }
    )
  }, [form, open, source])

  useEffect(() => {
    if (type === "boolean") {
      form.setValue("enabledValue", "true")
      form.setValue("disabledValue", "false")
    }
  }, [form, type])

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
    const enabledVariationId = crypto.randomUUID()
    const disabledVariationId = crypto.randomUUID()
    await onCreate({
      name: values.name,
      key: values.key,
      description: values.description,
      tags,
      isEnabled: values.isEnabled,
      variationType: values.variationType,
      enabledVariationId,
      disabledVariationId,
      variations: [
        {
          id: enabledVariationId,
          name: zh ? "开启" : "Enabled",
          value: values.enabledValue,
        },
        {
          id: disabledVariationId,
          name: zh ? "关闭" : "Disabled",
          value: values.disabledValue,
        },
      ],
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
          rows={3}
          {...form.register("description")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="flag-tags">{zh ? "标签" : "Tags"}</Label>
        {source ? (
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
        ) : (
          <Input
            id="flag-tags"
            placeholder={zh ? "用逗号分隔" : "Separate with commas"}
            {...form.register("tags")}
          />
        )}
      </div>
    </>
  )

  const footerActions = (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={saving}
        onClick={() => onOpenChange(false)}
      >
        {zh ? "取消" : "Cancel"}
      </Button>
      <Button type="button" disabled={saving} onClick={() => void submit()}>
        {saving ? <Loader2 className="animate-spin" /> : null}
        {source ? (zh ? "克隆" : "Clone") : zh ? "创建功能开关" : "Create flag"}
      </Button>
    </>
  )

  if (source) {
    return (
      <Dialog
        open={open}
        disablePointerDismissal={tagPickerOpen}
        onOpenChange={(next) => {
          if (!next && !saving && !tagPickerOpen) onOpenChange(next)
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
    )
  }

  return (
    <Sheet
      open={open}
      disablePointerDismissal={tagPickerOpen}
      onOpenChange={(next) => {
        if (!next && !saving && !tagPickerOpen) onOpenChange(next)
      }}
    >
      <SheetContent className="w-full sm:max-w-xl" showCloseButton={!saving}>
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{zh ? "新建功能开关" : "New feature flag"}</SheetTitle>
          <SheetDescription>
            {zh
              ? "配置名称、键、变体和默认返回值。"
              : "Configure the name, key, variations, and default serving values."}
          </SheetDescription>
        </SheetHeader>
        <form
          className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
          onSubmit={submit}
        >
          <div className="space-y-5">
            {commonFields}
            <>
              <div className="space-y-2">
                <Label>{zh ? "变体类型" : "Variation type"}</Label>
                <Select
                  value={type}
                  onValueChange={(value) =>
                    form.setValue(
                      "variationType",
                      value as Values["variationType"]
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {["boolean", "string", "number", "json"].map((value) => (
                        <SelectItem key={value} value={value}>
                          {value.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{zh ? "开启变体值" : "Enabled value"}</Label>
                  <Input
                    disabled={type === "boolean"}
                    {...form.register("enabledValue")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{zh ? "关闭变体值" : "Disabled value"}</Label>
                  <Input
                    disabled={type === "boolean"}
                    {...form.register("disabledValue")}
                  />
                </div>
              </div>
              <label className="flex items-center justify-between rounded-md border px-3 py-3">
                <span>
                  <span className="block text-sm font-medium">
                    {zh ? "创建后开启" : "Turn on after creation"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {zh
                      ? "开启后立即应用定向规则。"
                      : "Targeting rules apply immediately when enabled."}
                  </span>
                </span>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) =>
                    form.setValue("isEnabled", checked)
                  }
                />
              </label>
            </>
          </div>
        </form>
        <SheetFooter className="flex-row justify-end px-6 py-4">
          {footerActions}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
