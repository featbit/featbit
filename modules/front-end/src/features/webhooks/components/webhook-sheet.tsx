import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import {
  Box,
  Bug,
  Copy,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Project } from "@/features/layout/layout-types"
import { cn } from "@/lib/utils"
import { DEFAULT_PAYLOAD_TEMPLATE, WEBHOOK_EVENTS } from "../webhook-events"
import { isWebhookNameUsed } from "../webhooks-api"
import type {
  EnvironmentResource,
  Webhook,
  WebhookDraft,
  WebhookPayload,
  WebhookSheetMode,
} from "../webhook-types"
import {
  creatorLabel,
  newId,
  scopeEnvironmentIds,
  serializeScopes,
  validateJsonHandlebars,
} from "../webhook-utils"
import { CodeMirrorTemplateEditor } from "./code-mirror-template-editor"
import { EnvironmentPickerDialog } from "./environment-picker-dialog"
import type { DebugConfiguration } from "./live-debug-dialog"

const formSchema = z.object({
  name: z.string().trim().min(1, "webhooks.validation.nameRequired"),
  url: z
    .string()
    .trim()
    .min(1, "webhooks.validation.urlRequired")
    .refine((value) => {
      try {
        const url = new URL(value)
        return url.protocol === "http:" || url.protocol === "https:"
      } catch {
        return false
      }
    }, "webhooks.validation.urlInvalid"),
  isActive: z.boolean(),
  payloadTemplateType: z.enum(["default", "custom"]),
  payloadTemplate: z.string().min(1, "webhooks.validation.templateRequired"),
  secret: z.string(),
  preventEmptyPayloads: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

function initialDraft(webhook: Webhook | null): WebhookDraft {
  return {
    name: webhook?.name ?? "",
    url: webhook?.url ?? "",
    isActive: webhook?.isActive ?? true,
    environmentIds: scopeEnvironmentIds(webhook?.scopes ?? []),
    events: webhook?.events ?? [],
    headers: webhook?.headers?.length
      ? webhook.headers.map((header) => ({ ...header }))
      : [{ key: "", value: "" }],
    payloadTemplateType: webhook?.payloadTemplateType ?? "default",
    payloadTemplate: webhook?.payloadTemplate ?? DEFAULT_PAYLOAD_TEMPLATE,
    secret: webhook?.secret ?? "",
    preventEmptyPayloads: webhook?.preventEmptyPayloads ?? false,
  }
}

function Section({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn("space-y-4 border-b py-5 last:border-b-0", className)}
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

export function WebhookSheet({
  open,
  mode,
  webhook,
  projects,
  environments,
  environmentsLoading,
  environmentsError,
  isSaving,
  liveDebugOpen,
  onOpenChange,
  onModeChange,
  onRetryEnvironments,
  onDebug,
  onSubmit,
}: {
  open: boolean
  mode: WebhookSheetMode
  webhook: Webhook | null
  projects: Project[]
  environments: EnvironmentResource[]
  environmentsLoading: boolean
  environmentsError: boolean
  isSaving: boolean
  liveDebugOpen: boolean
  onOpenChange: (open: boolean) => void
  onModeChange: (mode: WebhookSheetMode) => void
  onRetryEnvironments: () => void
  onDebug: (configuration: DebugConfiguration) => void
  onSubmit: (payload: WebhookPayload) => Promise<void>
}) {
  const { t } = useTranslation()
  const readOnly = mode === "view"
  const initial = useMemo(() => initialDraft(webhook), [webhook])
  const [environmentIds, setEnvironmentIds] = useState(initial.environmentIds)
  const [events, setEvents] = useState(initial.events)
  const [headers, setHeaders] = useState(initial.headers)
  const [customTemplate, setCustomTemplate] = useState(
    initial.payloadTemplateType === "custom"
      ? initial.payloadTemplate
      : DEFAULT_PAYLOAD_TEMPLATE
  )
  const [environmentPickerOpen, setEnvironmentPickerOpen] = useState(false)
  const [expandedEditor, setExpandedEditor] = useState(false)
  const [scopeError, setScopeError] = useState("")
  const [eventsError, setEventsError] = useState("")
  const [templateError, setTemplateError] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [discardOpen, setDiscardOpen] = useState(false)
  const [secretRevealed, setSecretRevealed] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initial.name,
      url: initial.url,
      isActive: initial.isActive,
      payloadTemplateType: initial.payloadTemplateType,
      payloadTemplate: initial.payloadTemplate,
      secret: initial.secret,
      preventEmptyPayloads: initial.preventEmptyPayloads,
    },
  })
  const values = useWatch({ control: form.control })
  const payloadTemplateType = values.payloadTemplateType ?? "default"
  const payloadTemplate = values.payloadTemplate ?? DEFAULT_PAYLOAD_TEMPLATE

  const selectedResources = environments.filter((resource) =>
    environmentIds.includes(resource.id)
  )
  const dirty =
    !readOnly &&
    (form.formState.isDirty ||
      JSON.stringify(environmentIds) !==
        JSON.stringify(initial.environmentIds) ||
      JSON.stringify(events) !== JSON.stringify(initial.events) ||
      JSON.stringify(headers) !== JSON.stringify(initial.headers))

  const name = (values.name ?? "").trim()
  const shouldCheckName = !readOnly && Boolean(name) && name !== webhook?.name
  const nameQuery = useQuery({
    queryKey: ["webhook-name-used", name],
    queryFn: async ({ signal }) => {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(resolve, 300)
        signal.addEventListener(
          "abort",
          () => {
            window.clearTimeout(timeout)
            reject(signal.reason)
          },
          { once: true }
        )
      })
      return isWebhookNameUsed(name)
    },
    enabled: shouldCheckName,
    retry: false,
    staleTime: 30_000,
  })
  const nameChecking = shouldCheckName && nameQuery.isFetching

  useEffect(() => {
    if (!shouldCheckName) {
      if (form.getFieldState("name").error?.type === "validate") {
        form.clearErrors("name")
      }
      return
    }
    if (nameQuery.isError) {
      form.setError("name", {
        type: "validate",
        message: "webhooks.validation.nameValidationFailed",
      })
    } else if (nameQuery.data === true) {
      form.setError("name", {
        type: "validate",
        message: "webhooks.validation.nameDuplicate",
      })
    } else if (
      nameQuery.data === false &&
      form.getFieldState("name").error?.type === "validate"
    ) {
      form.clearErrors("name")
    }
  }, [form, nameQuery.data, nameQuery.isError, shouldCheckName])

  function attemptClose() {
    if (isSaving) return
    if (dirty) {
      setDiscardOpen(true)
    } else {
      onOpenChange(false)
    }
  }

  function toggleEvent(value: string) {
    setEvents((current) =>
      current.includes(value)
        ? current.filter((event) => event !== value)
        : [...current, value]
    )
    setEventsError("")
  }

  function toggleEventGroup(group: "featureFlag" | "segment") {
    const groupValues = WEBHOOK_EVENTS.filter(
      (event) => event.group === group
    ).map((event) => event.value)
    const allSelected = groupValues.every((value) => events.includes(value))
    setEvents((current) =>
      allSelected
        ? current.filter((value) => !groupValues.includes(value))
        : [...new Set([...current, ...groupValues])]
    )
    setEventsError("")
  }

  function debugConfiguration(): DebugConfiguration | null {
    if (!webhook && mode === "view") return null
    const result = formSchema.safeParse(form.getValues())
    const templateMessage = validateJsonHandlebars(payloadTemplate)
    if (
      !result.success ||
      environmentIds.length === 0 ||
      events.length === 0 ||
      templateMessage
    ) {
      void form.trigger()
      setScopeError(
        environmentIds.length ? "" : t("webhooks.validation.scopesRequired")
      )
      setEventsError(
        events.length ? "" : t("webhooks.validation.eventsRequired")
      )
      setTemplateError(
        templateMessage ? t("webhooks.validation.templateInvalid") : ""
      )
      return null
    }
    return {
      id: webhook?.id ?? newId(),
      name: result.data.name.trim(),
      url: result.data.url.trim(),
      secret: result.data.secret,
      headers: headers.filter((header) => header.key),
      events,
      payloadTemplate: result.data.payloadTemplate,
      preventEmptyPayloads: result.data.preventEmptyPayloads,
    }
  }

  async function submit(valuesToSubmit: FormValues) {
    const scopes = serializeScopes(environmentIds, projects)
    const templateMessage = validateJsonHandlebars(
      valuesToSubmit.payloadTemplate
    )
    setScopeError(scopes.length ? "" : t("webhooks.validation.scopesRequired"))
    setEventsError(events.length ? "" : t("webhooks.validation.eventsRequired"))
    setTemplateError(
      templateMessage ? t("webhooks.validation.templateInvalid") : ""
    )
    setSubmitError("")
    if (!scopes.length || !events.length || templateMessage) return
    try {
      await onSubmit({
        name: valuesToSubmit.name.trim(),
        url: valuesToSubmit.url.trim(),
        scopes,
        events,
        headers: headers.filter((header) => header.key),
        payloadTemplateType: valuesToSubmit.payloadTemplateType,
        payloadTemplate: valuesToSubmit.payloadTemplate,
        secret: valuesToSubmit.secret,
        isActive: valuesToSubmit.isActive,
        preventEmptyPayloads: valuesToSubmit.preventEmptyPayloads,
      })
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : t("webhooks.sheet.saveFailed")
      )
    }
  }

  const title =
    mode === "new"
      ? t("webhooks.sheet.newTitle")
      : mode === "edit"
        ? t("webhooks.sheet.editTitle", { name: webhook?.name ?? "" })
        : (webhook?.name ?? "")
  const nestedSurfaceOpen =
    environmentPickerOpen || expandedEditor || discardOpen || liveDebugOpen

  return (
    <TooltipProvider delay={300}>
      <Sheet
        open={open}
        disablePointerDismissal={nestedSurfaceOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !nestedSurfaceOpen) attemptClose()
        }}
      >
        <SheetContent
          showCloseButton={false}
          className="gap-0 p-0 data-[side=right]:w-[min(100vw,850px)] data-[side=right]:sm:max-w-[850px]"
        >
          <SheetHeader className="border-b px-6 py-5 pr-14">
            <div className="flex items-center gap-3">
              <SheetTitle className="truncate text-lg">{title}</SheetTitle>
              {mode === "view" ? (
                <Badge
                  variant="outline"
                  className={
                    webhook?.isActive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }
                >
                  {t(
                    webhook?.isActive
                      ? "webhooks.status.active"
                      : "webhooks.status.inactive"
                  )}
                </Badge>
              ) : null}
              {mode === "view" ? (
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const configuration = debugConfiguration()
                      if (configuration) onDebug(configuration)
                    }}
                  >
                    <Bug /> {t("webhooks.actions.liveDebug")}
                  </Button>
                  <Button size="sm" onClick={() => onModeChange("edit")}>
                    <Pencil /> {t("webhooks.actions.edit")}
                  </Button>
                </div>
              ) : null}
            </div>
            <SheetDescription className="sr-only">
              {t("webhooks.sheet.srDescription")}
            </SheetDescription>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-4 right-4"
              aria-label={t("webhooks.close")}
              disabled={isSaving}
              onClick={attemptClose}
            >
              <X />
            </Button>
          </SheetHeader>

          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={form.handleSubmit(submit)}
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-6">
              <Section title={t("webhooks.sheet.general")}>
                {readOnly ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t("webhooks.sheet.endpoint")}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="min-w-0 truncate text-xs">
                          {webhook?.url}
                        </code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={t("webhooks.copy")}
                          onClick={() =>
                            void navigator.clipboard.writeText(
                              webhook?.url ?? ""
                            )
                          }
                        >
                          <Copy />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t("webhooks.sheet.createdBy")}
                      </p>
                      <p className="mt-1">{creatorLabel(webhook?.creator)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="webhook-name">
                          {t("webhooks.sheet.name")}{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="webhook-name"
                          autoFocus
                          {...form.register("name")}
                        />
                        {nameChecking ? (
                          <p className="text-xs text-muted-foreground">
                            {t("webhooks.validation.validating")}
                          </p>
                        ) : form.formState.errors.name?.message ? (
                          <p className="text-xs text-destructive">
                            {t(form.formState.errors.name.message)}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="webhook-url">
                          {t("webhooks.sheet.endpoint")}{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="webhook-url"
                          placeholder="https://example.com/webhook"
                          {...form.register("url")}
                        />
                        {form.formState.errors.url?.message ? (
                          <p className="text-xs text-destructive">
                            {t(form.formState.errors.url.message)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <label className="flex w-fit items-center gap-2 text-sm">
                      <Switch
                        checked={Boolean(values.isActive)}
                        onCheckedChange={(checked) =>
                          form.setValue("isActive", checked, {
                            shouldDirty: true,
                          })
                        }
                      />
                      {t("webhooks.status.active")}
                    </label>
                  </div>
                )}
              </Section>

              <Section title={t("webhooks.sheet.scopes")}>
                {readOnly ? (
                  <div className="flex flex-wrap gap-1.5">
                    {(webhook?.scopeNames ?? []).map((scope, index) => (
                      <Badge
                        key={`${scope}-${index}`}
                        variant="secondary"
                        className="font-normal"
                      >
                        <Box aria-hidden className="size-3.5" />
                        {scope}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">
                        {t("webhooks.sheet.environmentsSelected", {
                          count: environmentIds.length,
                        })}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEnvironmentPickerOpen(true)}
                      >
                        {t("webhooks.sheet.chooseEnvironments")}
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {selectedResources.map((resource) => (
                        <Tooltip key={resource.id}>
                          <TooltipTrigger
                            render={
                              <Badge variant="secondary" className="gap-1" />
                            }
                          >
                            <Box aria-hidden className="size-3.5" />
                            {resource.pathName}
                            <button
                              type="button"
                              aria-label={t("webhooks.environments.remove", {
                                name: resource.name,
                              })}
                              onClick={() => {
                                setEnvironmentIds((current) =>
                                  current.filter((id) => id !== resource.id)
                                )
                                setScopeError("")
                              }}
                            >
                              <X className="size-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="font-mono">
                            {resource.rn}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {environmentIds.length === 0 ? (
                        <span className="text-sm text-muted-foreground">
                          {t("webhooks.sheet.noEnvironments")}
                        </span>
                      ) : null}
                    </div>
                    {scopeError ? (
                      <p className="mt-2 text-xs text-destructive">
                        {scopeError}
                      </p>
                    ) : null}
                  </div>
                )}
              </Section>

              <Section title={t("webhooks.sheet.events")}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["featureFlag", "segment"] as const).map((group) => {
                    const definitions = WEBHOOK_EVENTS.filter(
                      (event) => event.group === group
                    )
                    const count = definitions.filter((event) =>
                      events.includes(event.value)
                    ).length
                    const all = count === definitions.length
                    const partial = count > 0 && !all
                    return (
                      <div key={group} className="rounded-lg border p-3">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="font-medium">
                            {t(`webhooks.eventGroups.${group}`)}
                          </span>
                          {!readOnly ? (
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Checkbox
                                checked={all}
                                indeterminate={partial}
                                onCheckedChange={() => toggleEventGroup(group)}
                              />
                              {t("webhooks.sheet.selectAll")}
                            </label>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          {definitions.map((definition) => {
                            const checked = events.includes(definition.value)
                            if (readOnly && !checked) return null
                            return (
                              <label
                                key={definition.value}
                                className="flex items-start gap-2 text-sm"
                              >
                                <Checkbox
                                  checked={checked}
                                  disabled={readOnly}
                                  onCheckedChange={() =>
                                    toggleEvent(definition.value)
                                  }
                                />
                                <span className="min-w-0">
                                  <span className="block">
                                    {t(
                                      `webhooks.events.${definition.labelKey}`
                                    )}
                                  </span>
                                  {readOnly ? (
                                    <code className="block truncate text-xs text-muted-foreground">
                                      {definition.value}
                                    </code>
                                  ) : null}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {eventsError ? (
                  <p className="text-xs text-destructive">{eventsError}</p>
                ) : null}
              </Section>

              <Section title={t("webhooks.sheet.request")}>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label>{t("webhooks.sheet.customHeaders")}</Label>
                    <div className="overflow-hidden rounded-md border">
                      <Table>
                        <TableHeader className="bg-muted/40">
                          <TableRow>
                            <TableHead>
                              {t("webhooks.sheet.headerName")}
                            </TableHead>
                            <TableHead>
                              {t("webhooks.sheet.headerValue")}
                            </TableHead>
                            {!readOnly ? <TableHead className="w-12" /> : null}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {headers
                            .filter((header) => !readOnly || header.key)
                            .map((header, index) => (
                              <TableRow key={index}>
                                <TableCell>
                                  {readOnly ? (
                                    header.key
                                  ) : (
                                    <Input
                                      value={header.key}
                                      placeholder={t(
                                        "webhooks.sheet.headerName"
                                      )}
                                      onChange={(event) =>
                                        setHeaders((current) =>
                                          current.map((item, itemIndex) =>
                                            itemIndex === index
                                              ? {
                                                  ...item,
                                                  key: event.target.value,
                                                }
                                              : item
                                          )
                                        )
                                      }
                                    />
                                  )}
                                </TableCell>
                                <TableCell>
                                  {readOnly ? (
                                    <code className="text-xs">
                                      {header.value || "—"}
                                    </code>
                                  ) : (
                                    <Input
                                      value={header.value}
                                      autoComplete="off"
                                      placeholder={t(
                                        "webhooks.sheet.headerValue"
                                      )}
                                      onChange={(event) =>
                                        setHeaders((current) =>
                                          current.map((item, itemIndex) =>
                                            itemIndex === index
                                              ? {
                                                  ...item,
                                                  value: event.target.value,
                                                }
                                              : item
                                          )
                                        )
                                      }
                                    />
                                  )}
                                </TableCell>
                                {!readOnly ? (
                                  <TableCell>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-xs"
                                      aria-label={t(
                                        "webhooks.sheet.removeHeader"
                                      )}
                                      onClick={() =>
                                        setHeaders((current) =>
                                          current.filter(
                                            (_, itemIndex) =>
                                              itemIndex !== index
                                          )
                                        )
                                      }
                                    >
                                      <Trash2 />
                                    </Button>
                                  </TableCell>
                                ) : null}
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                    {!readOnly ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setHeaders((current) => [
                            ...current,
                            { key: "", value: "" },
                          ])
                        }
                      >
                        <Plus /> {t("webhooks.sheet.addHeader")}
                      </Button>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Label>{t("webhooks.sheet.payloadTemplate")}</Label>
                      {readOnly ? (
                        <Badge variant="outline">
                          {t(`webhooks.template.${payloadTemplateType}`)}
                        </Badge>
                      ) : (
                        <RadioGroup
                          value={payloadTemplateType}
                          className="flex w-auto gap-4"
                          onValueChange={(next) => {
                            const nextType = next as "default" | "custom"
                            if (payloadTemplateType === "custom")
                              setCustomTemplate(payloadTemplate)
                            form.setValue("payloadTemplateType", nextType, {
                              shouldDirty: true,
                            })
                            form.setValue(
                              "payloadTemplate",
                              nextType === "default"
                                ? DEFAULT_PAYLOAD_TEMPLATE
                                : customTemplate,
                              { shouldDirty: true }
                            )
                            setTemplateError("")
                          }}
                        >
                          {(["default", "custom"] as const).map((type) => (
                            <label
                              key={type}
                              className="flex items-center gap-2 text-sm"
                            >
                              <RadioGroupItem value={type} />
                              {t(`webhooks.template.${type}`)}
                            </label>
                          ))}
                        </RadioGroup>
                      )}
                    </div>
                    <CodeMirrorTemplateEditor
                      value={payloadTemplate}
                      readOnly={readOnly || payloadTemplateType === "default"}
                      expanded={expandedEditor}
                      onExpandedChange={setExpandedEditor}
                      onChange={(value) => {
                        form.setValue("payloadTemplate", value, {
                          shouldDirty: true,
                        })
                        if (payloadTemplateType === "custom")
                          setCustomTemplate(value)
                        setTemplateError("")
                      }}
                    />
                    {templateError ? (
                      <p className="text-xs text-destructive">
                        {templateError}
                      </p>
                    ) : null}
                  </div>

                  <label className="flex w-fit items-center gap-2 text-sm">
                    {readOnly ? (
                      <Badge variant="outline">
                        {t(
                          values.preventEmptyPayloads
                            ? "webhooks.enabled"
                            : "webhooks.disabled"
                        )}
                      </Badge>
                    ) : (
                      <Switch
                        checked={Boolean(values.preventEmptyPayloads)}
                        onCheckedChange={(checked) =>
                          form.setValue("preventEmptyPayloads", checked, {
                            shouldDirty: true,
                          })
                        }
                      />
                    )}
                    {t("webhooks.sheet.preventEmptyPayloads")}
                  </label>
                </div>
              </Section>

              <Section title={t("webhooks.sheet.security")} className="pb-6">
                <div className="max-w-md space-y-2">
                  <Label htmlFor="webhook-secret">
                    {t("webhooks.sheet.secret")}
                  </Label>
                  <div className="flex items-center gap-2">
                    {readOnly ? (
                      <code className="flex-1 text-xs">
                        {secretRevealed
                          ? webhook?.secret || "—"
                          : "••••••••••••••••"}
                      </code>
                    ) : (
                      <Input
                        id="webhook-secret"
                        type={secretRevealed ? "text" : "password"}
                        autoComplete="new-password"
                        {...form.register("secret")}
                      />
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={t("webhooks.sheet.toggleSecret")}
                      onClick={() => setSecretRevealed((current) => !current)}
                    >
                      {secretRevealed ? <EyeOff /> : <Eye />}
                    </Button>
                    {readOnly ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={t("webhooks.copy")}
                        onClick={() =>
                          void navigator.clipboard.writeText(
                            webhook?.secret ?? ""
                          )
                        }
                      >
                        <Copy />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Section>
            </div>

            {!readOnly ? (
              <SheetFooter className="flex-row items-center border-t px-6 py-4">
                {submitError ? (
                  <p className="mr-auto text-sm text-destructive">
                    {submitError}
                  </p>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="mr-auto"
                    disabled={isSaving || nameChecking}
                    onClick={() => {
                      const configuration = debugConfiguration()
                      if (configuration) onDebug(configuration)
                    }}
                  >
                    <Bug /> {t("webhooks.actions.liveDebug")}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={attemptClose}
                >
                  {t("webhooks.cancel")}
                </Button>
                <Button type="submit" disabled={isSaving || nameChecking}>
                  {t(
                    isSaving
                      ? "webhooks.sheet.saving"
                      : mode === "new"
                        ? "webhooks.sheet.create"
                        : "webhooks.sheet.save"
                  )}
                </Button>
              </SheetFooter>
            ) : null}
          </form>
        </SheetContent>
      </Sheet>

      <EnvironmentPickerDialog
        open={environmentPickerOpen}
        environments={environments}
        selected={environmentIds}
        isLoading={environmentsLoading}
        isError={environmentsError}
        onOpenChange={setEnvironmentPickerOpen}
        onApply={(ids) => {
          setEnvironmentIds(ids)
          setScopeError("")
        }}
        onRetry={onRetryEnvironments}
      />

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("webhooks.discard.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("webhooks.discard.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t-0 bg-transparent">
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              {t("webhooks.discard.keepEditing")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDiscardOpen(false)
                onOpenChange(false)
              }}
            >
              {t("webhooks.discard.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
