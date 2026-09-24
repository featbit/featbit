import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useController, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Activity, Box, X } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import type { Project } from "@/features/layout/layout-types"
import { EnvironmentPickerDialog } from "../components/environment-picker-dialog"
import type { EnvironmentResource } from "../webhook-types"
import { scopeEnvironmentIds, serializeScopes } from "../webhook-utils"
import { ALERT_PAYLOAD_TEMPLATE, validateAlertTemplate } from "./alert-payload"
import { AlertTemplateFields } from "./alert-template-fields"
import { AlertEventsSection } from "./alert-events-section"
import { PayloadPreviewDialog } from "./payload-preview-dialog"
import {
  isPreviewEndpoint,
  type ReleaseHealthWebhook,
  type ReleaseHealthWebhookDraft,
} from "./preview-store"

import { webhookHeadersSchema } from "./webhook-authentication"
import { WebhookAuthenticationFields } from "./webhook-authentication-fields"

const schema = z.object({
  headers: webhookHeadersSchema,
  secret: z.string(),
  removeSavedHeaders: z.boolean(),
  removeSavedSecret: z.boolean(),
  name: z.string().trim().min(1, "webhooks.validation.nameRequired").max(100),
  url: z
    .string()
    .trim()
    .refine(isPreviewEndpoint, "webhooks.releaseHealth.endpointInvalid"),
  isActive: z.boolean(),
  environmentIds: z
    .array(z.string())
    .min(1, "webhooks.validation.scopesRequired"),
  payloadTemplateType: z.enum(["default", "custom"]),
  payloadTemplate: z
    .string()
    .refine(
      (value) => !validateAlertTemplate(value),
      "webhooks.releaseHealth.templateInvalid"
    ),
})
type FormValues = z.infer<typeof schema>

export function ReleaseHealthWebhookSheet({
  webhook,
  initialEnvId,
  projects,
  environments,
  loading,
  loadError,
  onRetry,
  onClose,
  onSave,
}: {
  webhook: ReleaseHealthWebhook | null
  initialEnvId?: string
  projects: Project[]
  environments: EnvironmentResource[]
  loading: boolean
  loadError: boolean
  onRetry: () => void
  onClose: () => void
  onSave: (draft: ReleaseHealthWebhookDraft) => Promise<void>
}) {
  const { t } = useTranslation()
  const h = (key: string) => t(`webhooks.releaseHealth.${key}`)
  const [picker, setPicker] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [preview, setPreview] = useState(false)
  const [discard, setDiscard] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      headers: webhook?.headers?.length
        ? webhook.headers.map((header) => ({ ...header }))
        : [{ key: "", value: "" }],
      secret: webhook?.secret ?? "",
      removeSavedHeaders: false,
      removeSavedSecret: false,
      name: webhook?.name ?? "",
      url: webhook?.url ?? "",
      isActive: webhook?.isActive ?? true,
      environmentIds: webhook
        ? scopeEnvironmentIds(webhook.scopes)
        : initialEnvId
          ? [initialEnvId]
          : [],
      payloadTemplateType: webhook?.payloadTemplateType ?? "default",
      payloadTemplate: webhook?.payloadTemplate ?? ALERT_PAYLOAD_TEMPLATE,
    },
  })
  const { field: headersField } = useController({
    control: form.control,
    name: "headers",
  })
  const { field: secretField } = useController({
    control: form.control,
    name: "secret",
  })
  const values = useWatch({ control: form.control })
  const selected = values.environmentIds ?? []
  const { errors, isDirty, isSubmitting } = form.formState
  const attemptClose = () => {
    if (isSubmitting) return
    if (isDirty) setDiscard(true)
    else onClose()
  }
  const setEnvironments = (ids: string[]) =>
    form.setValue("environmentIds", ids, {
      shouldDirty: true,
      shouldValidate: true,
    })
  const submit = form.handleSubmit(async (data) => {
    const allowed = new Set(environments.map((environment) => environment.id))
    const scopes = serializeScopes(data.environmentIds, projects)
    const resolved = scopeEnvironmentIds(scopes)
    if (
      loadError ||
      loading ||
      data.environmentIds.some(
        (id) => !allowed.has(id) || !resolved.includes(id)
      )
    ) {
      form.setError("environmentIds", {
        message: "webhooks.releaseHealth.scopeUnavailable",
      })
      return
    }
    try {
      await onSave({
        headers: data.headers.filter((header) => header.key),
        secret: data.secret,
        removeSavedHeaders: data.removeSavedHeaders,
        removeSavedSecret: data.removeSavedSecret,
        name: data.name,
        url: data.url,
        isActive: data.isActive,
        scopes,
        scopeNames: projects.flatMap((project) =>
          project.environments
            .filter((env) => data.environmentIds.includes(env.id))
            .map((env) => `${project.name}/${env.name}`)
        ),
        payloadTemplateType: data.payloadTemplateType,
        payloadTemplate: data.payloadTemplate,
      })
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === "duplicate" ||
          error.message.includes("webhook_name_used"))
      )
        form.setError("name", { message: "webhooks.validation.nameDuplicate" })
      else if (
        error instanceof Error &&
        "status" in error &&
        error.status === 409
      )
        form.setError("root", { message: "webhooks.releaseHealth.conflict" })
      else form.setError("root", { message: "webhooks.saveFailed" })
    }
  })
  const errorText = (message?: string) =>
    message ? (
      <p role="alert" className="text-xs text-destructive">
        {t(message)}
      </p>
    ) : null
  const nested = picker || expanded || preview || discard
  return (
    <>
      <Sheet
        open
        disablePointerDismissal={nested}
        onOpenChange={(open) => {
          if (!open && !nested) attemptClose()
        }}
      >
        <SheetContent
          showCloseButton={false}
          className="gap-0 p-0 data-[side=right]:w-[min(100vw,850px)] data-[side=right]:sm:max-w-[850px]"
        >
          <SheetHeader className="border-b px-6 py-5 pr-14">
            <SheetTitle className="text-lg">
              {h(webhook ? "editTitle" : "newTitle")}
            </SheetTitle>
            <SheetDescription>{h("sheetHelp")}</SheetDescription>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-4 right-4"
              aria-label={t("webhooks.close")}
              onClick={attemptClose}
            >
              <X />
            </Button>
          </SheetHeader>
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  <Activity className="size-3" />
                  Release Health
                </Badge>
                <Badge variant="secondary">{h("previewBadge")}</Badge>
                <span className="text-xs text-muted-foreground">
                  {h("previewShort")}
                </span>
              </div>
              <section className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="rh-hook-name">
                      {t("webhooks.sheet.name")}
                    </Label>
                    <Input
                      id="rh-hook-name"
                      {...form.register("name")}
                      maxLength={100}
                      placeholder={h("namePlaceholder")}
                      aria-invalid={Boolean(errors.name)}
                    />
                    {errorText(errors.name?.message)}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rh-hook-url">
                      {t("webhooks.sheet.endpoint")}
                    </Label>
                    <Input
                      id="rh-hook-url"
                      {...form.register("url")}
                      placeholder="https://example.com/webhooks/alerts"
                      aria-invalid={Boolean(errors.url)}
                    />
                    {errorText(errors.url?.message)}
                  </div>
                </div>
                <Controller
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <Label>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                      {t("webhooks.status.active")}
                    </Label>
                  )}
                />
              </section>
              <section className="space-y-3 border-t pt-6">
                <h3 className="font-medium">{t("webhooks.sheet.scopes")}</h3>
                <p className="text-sm text-muted-foreground">
                  {h("scopeHelp")}
                </p>
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span>
                      {t("webhooks.sheet.environmentsSelected", {
                        count: selected.length,
                      })}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPicker(true)}
                    >
                      {t("webhooks.sheet.chooseEnvironments")}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.map((id) => {
                      const project = projects.find((item) =>
                        item.environments.some((env) => env.id === id)
                      )
                      const env = project?.environments.find(
                        (item) => item.id === id
                      )
                      const name =
                        project && env ? `${project.name}/${env.name}` : id
                      return (
                        <Badge
                          key={id}
                          variant="secondary"
                          className="max-w-full gap-1 font-normal"
                        >
                          <Box className="size-3 shrink-0" />
                          <span className="truncate">{name}</span>
                          <button
                            type="button"
                            aria-label={t("webhooks.environments.remove", {
                              name,
                            })}
                            onClick={() =>
                              setEnvironments(
                                selected.filter((item) => item !== id)
                              )
                            }
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      )
                    })}
                  </div>
                  {loadError && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onRetry}
                    >
                      {t("webhooks.environments.loadFailed")}{" "}
                      {t("webhooks.retry")}
                    </Button>
                  )}
                </div>
                {errorText(errors.environmentIds?.message)}
              </section>
              <AlertEventsSection />
              <AlertTemplateFields
                type={values.payloadTemplateType ?? "default"}
                value={values.payloadTemplate ?? ""}
                onChange={(type, value) => {
                  form.setValue("payloadTemplateType", type, {
                    shouldDirty: true,
                  })
                  form.setValue("payloadTemplate", value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }}
                expanded={expanded}
                onExpandedChange={setExpanded}
                onPreview={() => setPreview(true)}
              />
              <WebhookAuthenticationFields
                headers={(values.headers ?? []).map((header) => ({
                  key: header.key ?? "",
                  value: header.value ?? "",
                }))}
                secret={values.secret ?? ""}
                onHeadersChange={headersField.onChange}
                onSecretChange={secretField.onChange}
                hasHeaders={webhook?.hasHeaders ?? false}
                hasSecret={webhook?.hasSecret ?? false}
                removeSavedHeaders={values.removeSavedHeaders ?? false}
                removeSavedSecret={values.removeSavedSecret ?? false}
                onRemoveSavedHeaders={(value) =>
                  form.setValue("removeSavedHeaders", value, {
                    shouldDirty: true,
                  })
                }
                onRemoveSavedSecret={(value) =>
                  form.setValue("removeSavedSecret", value, {
                    shouldDirty: true,
                  })
                }
                errors={errors}
                disabled={isSubmitting}
              />
            </div>
            <SheetFooter className="flex-row items-center justify-end border-t px-6 py-4">
              <div className="mr-auto">{errorText(errors.root?.message)}</div>
              <Button
                type="button"
                variant="outline"
                onClick={attemptClose}
                disabled={isSubmitting}
              >
                {t("webhooks.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || loading || loadError}
              >
                {t(
                  isSubmitting
                    ? "webhooks.sheet.saving"
                    : webhook
                      ? "webhooks.sheet.save"
                      : "webhooks.sheet.create"
                )}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      <EnvironmentPickerDialog
        open={picker}
        environments={environments}
        selected={selected}
        isLoading={loading}
        isError={loadError}
        onOpenChange={setPicker}
        onApply={setEnvironments}
        onRetry={onRetry}
      />
      {preview && (
        <PayloadPreviewDialog
          template={values.payloadTemplate ?? ""}
          onClose={() => setPreview(false)}
        />
      )}
      <AlertDialog open={discard} onOpenChange={setDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("webhooks.discard.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("webhooks.discard.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDiscard(false)}>
              {t("webhooks.discard.keepEditing")}
            </Button>
            <Button variant="destructive" onClick={onClose}>
              {t("webhooks.discard.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
