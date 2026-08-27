import { zodResolver } from "@hookform/resolvers/zod"
import { Check, Info, Loader2, Plus } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { LicenseGateContent } from "@/components/license-gate-card"
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type {
  ScopeResource,
  SegmentPayload,
  SegmentType,
} from "../../segments-types"
import { ScopeResourceIcon } from "./scope-resource-icon"
import { ScopePickerDialog } from "./scope-picker-dialog"

const schema = z.object({
  name: z.string().trim().min(1, "segments.create.nameRequired"),
  key: z
    .string()
    .trim()
    .min(1, "segments.create.keyRequired")
    .regex(/^[A-Za-z0-9._-]+$/, "segments.create.keyInvalid"),
  description: z.string(),
})

type FormValues = z.infer<typeof schema>
type KeyState = "idle" | "validating" | "valid" | "duplicate" | "error"
type KeyValidation = {
  signature: string
  state: Exclude<KeyState, "idle" | "validating">
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function normalizeScopes(resources: ScopeResource[], currentRn: string) {
  const sorted = [...resources]
    .map((resource) => resource.rn)
    .sort((left, right) => right.length - left.length)
  const currentIsCovered = sorted.some(
    (rn) => rn !== currentRn && `${currentRn}:`.startsWith(`${rn}:`)
  )
  return currentIsCovered ? sorted.filter((rn) => rn !== currentRn) : sorted
}

export function SegmentSheet({
  open,
  currentScope,
  resources,
  resourcesLoading,
  resourcesError,
  shareableGranted,
  manageLicenseHref,
  saving,
  onOpenChange,
  onRetryResources,
  onValidateKey,
  onSubmit,
}: {
  open: boolean
  currentScope: ScopeResource
  resources: ScopeResource[]
  resourcesLoading: boolean
  resourcesError: boolean
  shareableGranted: boolean
  manageLicenseHref: string
  saving: boolean
  onOpenChange: (open: boolean) => void
  onRetryResources: () => void
  onValidateKey: (key: string, type: SegmentType) => Promise<boolean>
  onSubmit: (payload: SegmentPayload) => Promise<void>
}) {
  const { t } = useTranslation()
  const [type, setType] = useState<SegmentType>("environment-specific")
  const [keyValidation, setKeyValidation] = useState<KeyValidation | null>(null)
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false)
  const [nameInteracted, setNameInteracted] = useState(false)
  const [selectedScopes, setSelectedScopes] = useState<ScopeResource[]>([
    currentScope,
  ])
  const [scopePickerOpen, setScopePickerOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const validationSequence = useRef(0)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { name: "", key: "", description: "" },
  })
  const name = useWatch({ control: form.control, name: "name" })
  const key = useWatch({ control: form.control, name: "key" })
  const gated = type === "shared" && !shareableGranted

  useEffect(() => {
    if (!keyManuallyEdited) {
      form.setValue("key", slugify(name), {
        shouldValidate: nameInteracted,
      })
    }
  }, [form, keyManuallyEdited, name, nameInteracted])

  useEffect(() => {
    if (gated || !key || form.formState.errors.key) return
    const signature = `${type}:${key}`
    const sequence = ++validationSequence.current
    const timeout = window.setTimeout(() => {
      onValidateKey(key, type)
        .then((used) => {
          if (sequence === validationSequence.current) {
            setKeyValidation({
              signature,
              state: used ? "duplicate" : "valid",
            })
          }
        })
        .catch(() => {
          if (sequence === validationSequence.current) {
            setKeyValidation({ signature, state: "error" })
          }
        })
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [form.formState.errors.key, gated, key, onValidateKey, type])

  const currentScopeAvailable = useMemo(
    () =>
      resources.find((resource) => resource.rn === currentScope.rn) ??
      currentScope,
    [currentScope, resources]
  )

  function requestClose() {
    if (saving) return
    if (form.formState.isDirty || selectedScopes.length > 1) {
      setDiscardOpen(true)
    } else {
      onOpenChange(false)
    }
  }

  const keySignature = `${type}:${key}`
  const keyState: KeyState =
    !key || form.formState.errors.key
      ? "idle"
      : keyValidation?.signature === keySignature
        ? keyValidation.state
        : "validating"
  const keyMessage =
    keyState === "validating"
      ? "segments.create.validating"
      : keyState === "duplicate"
        ? "segments.create.keyDuplicate"
        : keyState === "error"
          ? "segments.create.keyValidationFailed"
          : null
  const validKey = keyState === "valid"
  const canSubmit = form.formState.isValid && validKey && !gated && !saving

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) requestClose()
        }}
      >
        <SheetContent
          className="data-[side=right]:w-[min(100vw,480px)] data-[side=right]:sm:max-w-[480px]"
          showCloseButton={!saving}
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>{t("segments.create.title")}</SheetTitle>
          </SheetHeader>

          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={form.handleSubmit(async (values) => {
              if (gated) return
              const scopes =
                type === "shared"
                  ? normalizeScopes(selectedScopes, currentScope.rn)
                  : [currentScope.rn]
              await onSubmit({
                ...values,
                name: values.name.trim(),
                key: values.key.trim(),
                type,
                scopes,
              })
            })}
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <section className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label id="segment-type-label">
                    {t("segments.create.type")}
                  </Label>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          aria-label={t("segments.typeHelp")}
                          className="rounded-sm text-muted-foreground"
                        />
                      }
                    >
                      <Info className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-80">
                      {t("segments.typeHelp")}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <RadioGroup
                  value={type}
                  onValueChange={(value) => setType(value as SegmentType)}
                  aria-labelledby="segment-type-label"
                  className="grid gap-2 sm:grid-cols-2"
                >
                  {(
                    [
                      [
                        "environment-specific",
                        "segments.create.thisEnvironment",
                      ],
                      ["shared", "segments.create.multipleScopes"],
                    ] as const
                  ).map(([value, label]) => (
                    <Label
                      key={value}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40",
                        type === value
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "hover:border-foreground/20 hover:bg-muted/30"
                      )}
                    >
                      <RadioGroupItem value={value} />
                      <span className="min-w-0 flex-1">
                        <span className="block leading-tight font-medium text-foreground">
                          {t(label)}
                        </span>
                        {value === "shared" && !shareableGranted ? (
                          <span className="mt-0.5 block text-xs leading-tight font-normal text-muted-foreground">
                            {t("segments.create.licenseRequired")}
                          </span>
                        ) : null}
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
              </section>

              {gated ? (
                <div className="flex min-h-[26rem] items-center justify-center py-8">
                  <LicenseGateContent
                    title={t("segments.create.gatedTitle")}
                    description={t("segments.create.gatedDescription")}
                    actionLabel={t("segments.create.manageLicense")}
                    actionHref={manageLicenseHref}
                    note={t("segments.create.licenseGateNote")}
                  />
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  <section className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="segment-name">
                        {t("segments.create.name")}
                      </Label>
                      <Input
                        id="segment-name"
                        placeholder={t("segments.create.namePlaceholder")}
                        aria-invalid={Boolean(form.formState.errors.name)}
                        {...form.register("name", {
                          onChange: () => {
                            setNameInteracted(true)
                          },
                        })}
                      />
                      {form.formState.errors.name ? (
                        <p className="text-xs text-destructive">
                          {t(form.formState.errors.name.message!)}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="segment-key">
                        {t("segments.create.key")}
                      </Label>
                      <div className="relative">
                        <Input
                          id="segment-key"
                          className="pr-9 font-mono"
                          placeholder={t("segments.create.keyPlaceholder")}
                          aria-invalid={
                            Boolean(form.formState.errors.key) ||
                            keyState === "duplicate" ||
                            keyState === "error"
                          }
                          {...form.register("key", {
                            onChange: () => setKeyManuallyEdited(true),
                          })}
                        />
                        {keyState === "validating" ? (
                          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        ) : validKey ? (
                          <Check className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-teal-600" />
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("segments.create.keyHelp")}
                      </p>
                      {form.formState.errors.key || keyMessage ? (
                        <p className="text-xs text-destructive">
                          {t(form.formState.errors.key?.message ?? keyMessage!)}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="segment-description">
                        {t("segments.create.descriptionLabel")}
                      </Label>
                      <Textarea
                        id="segment-description"
                        className="min-h-24 resize-none"
                        placeholder={t(
                          "segments.create.descriptionPlaceholder"
                        )}
                        {...form.register("description")}
                      />
                    </div>
                  </section>

                  <section className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label>
                          {t(
                            type === "shared"
                              ? "segments.create.scopes"
                              : "segments.create.scope"
                          )}
                        </Label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t(
                            type === "shared"
                              ? "segments.create.scopesHelp"
                              : "segments.create.currentScopeHelp"
                          )}
                        </p>
                      </div>
                      {type === "shared" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setScopePickerOpen(true)}
                        >
                          <Plus />
                          {t("segments.create.chooseScopes")}
                        </Button>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5 rounded-lg border bg-muted/20 p-3">
                      {(type === "shared"
                        ? selectedScopes
                        : [currentScopeAvailable]
                      ).map((resource) => (
                        <Badge
                          key={resource.rn}
                          variant="secondary"
                          className="max-w-full gap-1.5 font-normal"
                          title={resource.rn}
                        >
                          <ScopeResourceIcon
                            type={resource.type}
                            className="size-3.5"
                          />
                          <span className="truncate">{resource.pathName}</span>
                          {resource.rn === currentScope.rn ? (
                            <span className="text-[0.65rem] text-muted-foreground">
                              {t("segments.create.current")}
                            </span>
                          ) : null}
                        </Badge>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>

            <SheetFooter className="flex-row justify-end px-6 py-4">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={requestClose}
              >
                {t("segments.create.cancel")}
              </Button>
              {!gated ? (
                <Button type="submit" disabled={!canSubmit}>
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" />
                      {t("segments.create.submitting")}
                    </>
                  ) : (
                    t("segments.create.submit")
                  )}
                </Button>
              ) : null}
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {scopePickerOpen ? (
        <ScopePickerDialog
          open
          resources={resources}
          selected={selectedScopes}
          currentEnvironmentRn={currentScope.rn}
          loading={resourcesLoading}
          error={resourcesError}
          onOpenChange={setScopePickerOpen}
          onRetry={onRetryResources}
          onApply={(nextScopes) => {
            setSelectedScopes(nextScopes)
            setScopePickerOpen(false)
          }}
        />
      ) : null}

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("segments.create.discardTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("segments.create.discardDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t-0 bg-transparent">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDiscardOpen(false)}
            >
              {t("segments.create.keepEditing")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDiscardOpen(false)
                onOpenChange(false)
              }}
            >
              {t("segments.create.discard")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
