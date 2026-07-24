import { zodResolver } from "@hookform/resolvers/zod"
import { Box, Plus, X } from "lucide-react"
import { useMemo, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  checkAgentAvailability,
  syncRelayProxyAgent,
} from "../relay-proxies-api"
import { parseAutoAgentStatus } from "../relay-proxy-permissions"
import type {
  EnvironmentResource,
  RelayProxy,
  RelayProxyAgent,
  RelayProxyAutoAgent,
  RelayProxyPayload,
  RelayProxySheetMode,
} from "../relay-proxy-types"
import { EnvironmentPickerDialog } from "./environment-picker-dialog"
import { ManualAgentDialog } from "./manual-agent-dialog"

const formSchema = z
  .object({
    name: z.string().trim().min(1, "relayProxies.sheet.nameRequired"),
    description: z.string(),
    scopeMode: z.enum(["all", "selected"]),
    scopes: z.array(z.string()),
  })
  .refine((value) => value.scopeMode === "all" || value.scopes.length > 0, {
    message: "relayProxies.sheet.chooseAtLeastOne",
    path: ["scopes"],
  })

type FormValues = z.infer<typeof formSchema>

type Props = {
  open: boolean
  mode: RelayProxySheetMode
  relayProxy: RelayProxy | null
  environments: EnvironmentResource[]
  environmentsLoading: boolean
  environmentsError: boolean
  isSaving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: RelayProxyPayload) => Promise<void>
  onValidateName: (name: string) => Promise<boolean>
  onRetryEnvironments: () => void
}

function Section({
  title,
  description,
  count,
  action,
  fullWidth = false,
  children,
}: {
  title: string
  description: string
  count?: number
  action?: React.ReactNode
  fullWidth?: boolean
  children: React.ReactNode
}) {
  const heading = (
    <div>
      <div className="flex items-center gap-2">
        <h3 className="font-medium">{title}</h3>
        {count !== undefined && (
          <Badge variant="secondary" className="tabular-nums">
            {count}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  )

  if (fullWidth) {
    return (
      <section className="py-6">
        <div className="flex items-start justify-between gap-4">
          {heading}
          {action}
        </div>
        <div className="mt-4 min-w-0">{children}</div>
      </section>
    )
  }

  return (
    <section className="grid gap-5 py-6 md:grid-cols-[180px_minmax(0,1fr)]">
      {heading}
      <div className="min-w-0">
        {action && <div className="mb-3 flex justify-end">{action}</div>}
        {children}
      </div>
    </section>
  )
}

function formatDate(value: string | undefined, locale: string, never: string) {
  if (!value) return never
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return never

  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size)
      return formatter.format(Math.round(seconds / size), unit)
  }
  return formatter.format(seconds, "second")
}

export function RelayProxySheet({
  open,
  mode,
  relayProxy,
  environments,
  environmentsLoading,
  environmentsError,
  isSaving,
  onOpenChange,
  onSubmit,
  onValidateName,
  onRetryEnvironments,
}: Props) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage === "zh" ? "zh-CN" : "en-US"
  const never = t("relayProxies.sheet.never")
  const readOnly = mode === "view"
  const [environmentPickerOpen, setEnvironmentPickerOpen] = useState(false)
  const [agents, setAgents] = useState<RelayProxyAgent[]>(
    relayProxy?.agents ?? []
  )
  const [autoAgents, setAutoAgents] = useState<RelayProxyAutoAgent[]>(
    relayProxy?.autoAgents ?? []
  )
  const [agentDialog, setAgentDialog] = useState<
    RelayProxyAgent | null | "new"
  >(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [removeAgentTarget, setRemoveAgentTarget] =
    useState<RelayProxyAgent | null>(null)
  const [renderedAt] = useState(() => Date.now())

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: relayProxy?.name ?? "",
      description: relayProxy?.description ?? "",
      scopeMode: relayProxy?.isAllEnvs === false ? "selected" : "all",
      scopes: relayProxy?.scopes ?? [],
    },
  })

  const selectedScopes = useWatch({ control: form.control, name: "scopes" })
  const scopeMode = useWatch({ control: form.control, name: "scopeMode" })
  const selectedEnvironments = useMemo(
    () =>
      environments.filter((environment) =>
        selectedScopes.includes(environment.id)
      ),
    [environments, selectedScopes]
  )

  async function submit(values: FormValues) {
    const nameUsed =
      values.name !== relayProxy?.name && (await onValidateName(values.name))
    if (nameUsed) {
      form.setError("name", {
        message: "relayProxies.sheet.nameDuplicate",
      })
      return
    }

    await onSubmit({
      name: values.name,
      description: values.description.trim(),
      isAllEnvs: values.scopeMode === "all",
      scopes: values.scopeMode === "all" ? [] : values.scopes,
      agents,
      autoAgents,
    })
  }

  async function syncAgent(agent: RelayProxyAgent) {
    if (!relayProxy) return
    setSyncingId(agent.id)
    try {
      const result = await syncRelayProxyAgent(
        relayProxy.id,
        agent.id,
        agent.host
      )
      if (!result.success) throw new Error(result.reason)
      setAgents((current) =>
        current.map((item) =>
          item.id === agent.id
            ? {
                ...item,
                syncAt: result.syncAt,
                serves: result.serves,
                dataVersion: result.dataVersion,
              }
            : item
        )
      )
      toast.success(t("relayProxies.sheet.agentSynchronized"))
    } catch {
      toast.error(t("relayProxies.sheet.syncFailed"))
    } finally {
      setSyncingId(null)
    }
  }

  async function checkAgent(agent: RelayProxyAgent) {
    setCheckingId(agent.id)
    try {
      const status = await checkAgentAvailability(agent.host)
      if (status === 200) {
        toast.success(t("relayProxies.manualAgent.available"))
      } else {
        toast.error(
          t("relayProxies.manualAgent.unavailable", {
            status,
          })
        )
      }
    } catch {
      toast.error(t("relayProxies.sheet.availabilityFailed"))
    } finally {
      setCheckingId(null)
    }
  }

  const titleKey =
    mode === "new"
      ? "relayProxies.sheet.newTitle"
      : mode === "edit"
        ? "relayProxies.sheet.editTitle"
        : "relayProxies.sheet.viewTitle"
  const savedAgentIds = new Set(
    relayProxy?.agents.map((agent) => agent.id) ?? []
  )
  const savedScopes = relayProxy?.isAllEnvs
    ? ["__all__"]
    : [...(relayProxy?.scopes ?? [])].sort()
  const currentScopes =
    scopeMode === "all" ? ["__all__"] : [...selectedScopes].sort()
  const scopesChanged =
    JSON.stringify(savedScopes) !== JSON.stringify(currentScopes)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="data-[side=right]:w-[min(100vw,850px)] data-[side=right]:sm:max-w-[850px]">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle className="text-lg">{t(titleKey)}</SheetTitle>
          </SheetHeader>

          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={form.handleSubmit(submit)}
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-6">
              <Section
                title={t("relayProxies.sheet.general")}
                description={t("relayProxies.sheet.generalDescription")}
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="relay-proxy-name">
                      {t("relayProxies.sheet.name")}
                    </Label>
                    <Input
                      id="relay-proxy-name"
                      readOnly={readOnly}
                      placeholder={t("relayProxies.sheet.namePlaceholder")}
                      {...form.register("name")}
                    />
                    {form.formState.errors.name && (
                      <p className="text-xs text-destructive">
                        {t(
                          form.formState.errors.name.message ??
                            "relayProxies.sheet.nameRequired"
                        )}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="relay-proxy-description">
                      {t("relayProxies.sheet.description")}
                    </Label>
                    <Textarea
                      id="relay-proxy-description"
                      readOnly={readOnly}
                      rows={3}
                      placeholder={t(
                        "relayProxies.sheet.descriptionPlaceholder"
                      )}
                      {...form.register("description")}
                    />
                  </div>
                </div>
              </Section>

              <Separator />
              <Section
                title={t("relayProxies.sheet.scopes")}
                description={t("relayProxies.sheet.scopesDescription")}
              >
                <Controller
                  control={form.control}
                  name="scopeMode"
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value}
                      onValueChange={(value) => {
                        if (!readOnly) field.onChange(value)
                      }}
                      className={cn(
                        "grid gap-2 sm:grid-cols-2",
                        readOnly && "pointer-events-none"
                      )}
                    >
                      {[
                        [
                          "all",
                          t("relayProxies.sheet.allEnvironments"),
                          t("relayProxies.sheet.allEnvironmentsHelper"),
                        ],
                        [
                          "selected",
                          t("relayProxies.sheet.selectedEnvironments"),
                          t("relayProxies.sheet.selectedEnvironmentsHelper"),
                        ],
                      ].map(([value, label, helper]) => (
                        <Label
                          key={value}
                          className={cn(
                            "flex min-h-16 cursor-pointer items-start gap-3 rounded-lg border p-3",
                            readOnly && "cursor-default",
                            field.value === value &&
                              "border-primary bg-primary/5"
                          )}
                        >
                          <RadioGroupItem value={value} className="mt-0.5" />
                          <span>
                            <span className="block font-medium">{label}</span>
                            <span className="mt-1 block text-xs font-normal text-muted-foreground">
                              {helper}
                            </span>
                          </span>
                        </Label>
                      ))}
                    </RadioGroup>
                  )}
                />

                {scopeMode === "selected" && (
                  <div className="mt-4 space-y-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">
                        {t("relayProxies.sheet.environmentsSelected", {
                          count: selectedScopes.length,
                        })}
                      </p>
                      {!readOnly && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEnvironmentPickerOpen(true)}
                        >
                          {t("relayProxies.sheet.chooseEnvironments")}
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <TooltipProvider delay={300}>
                        {selectedEnvironments.map((environment) => (
                          <Tooltip key={environment.id}>
                            <TooltipTrigger
                              render={
                                <Badge variant="secondary" className="gap-1" />
                              }
                            >
                              <Box aria-hidden className="size-3.5" />
                              {environment.pathName}
                              {!readOnly && (
                                <button
                                  type="button"
                                  aria-label={t(
                                    "relayProxies.environments.remove",
                                    { name: environment.name }
                                  )}
                                  onClick={() =>
                                    form.setValue(
                                      "scopes",
                                      selectedScopes.filter(
                                        (id) => id !== environment.id
                                      ),
                                      {
                                        shouldValidate: true,
                                        shouldDirty: true,
                                      }
                                    )
                                  }
                                >
                                  <X className="size-3" />
                                </button>
                              )}
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[min(28rem,calc(100vw-2rem))] font-mono break-all">
                              {environment.rn}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </TooltipProvider>
                      {selectedEnvironments.length === 0 && (
                        <span className="text-sm text-muted-foreground">
                          {t("relayProxies.sheet.noEnvironments")}
                        </span>
                      )}
                    </div>
                    {form.formState.errors.scopes && (
                      <p className="text-xs text-destructive">
                        {t(
                          form.formState.errors.scopes.message ??
                            "relayProxies.sheet.chooseAtLeastOne"
                        )}
                      </p>
                    )}
                  </div>
                )}
              </Section>

              <Separator />
              <Section
                title={t("relayProxies.sheet.autoAgents")}
                description={t("relayProxies.sheet.autoAgentsDescription")}
                count={autoAgents.length}
                fullWidth
              >
                {autoAgents.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">
                    {t("relayProxies.sheet.noAutoAgents")}
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead>
                            {t("relayProxies.sheet.agentId")}
                          </TableHead>
                          <TableHead>
                            {t("relayProxies.sheet.servesColumn")}
                          </TableHead>
                          <TableHead>
                            {t("relayProxies.sheet.syncStatus")}
                          </TableHead>
                          {mode === "edit" && (
                            <TableHead className="text-right">
                              {t("relayProxies.sheet.actionsColumn")}
                            </TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {autoAgents.map((agent) => {
                          const status = parseAutoAgentStatus(
                            agent.status
                          ) as Record<string, unknown>
                          const reportedAt = new Date(
                            String(status.reportedAt ?? agent.registeredAt)
                          ).getTime()
                          const removable = renderedAt - reportedAt > 5 * 60_000
                          return (
                            <TableRow key={agent.id}>
                              <TableCell className="min-w-40 align-middle">
                                <p className="font-medium">{agent.id}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {t("relayProxies.sheet.registered", {
                                    time: formatDate(
                                      agent.registeredAt,
                                      locale,
                                      never
                                    ),
                                  })}
                                </p>
                              </TableCell>
                              <TableCell className="min-w-36 align-middle">
                                <p>{String(status.serves ?? "—")}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {t("relayProxies.sheet.reportedValue", {
                                    time: formatDate(
                                      String(status.reportedAt ?? ""),
                                      locale,
                                      never
                                    ),
                                  })}
                                </p>
                              </TableCell>
                              <TableCell className="min-w-40 align-middle">
                                <Badge variant="outline">
                                  {String(
                                    status.syncState ??
                                      t("relayProxies.sheet.connected")
                                  )}
                                </Badge>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {t("relayProxies.sheet.lastSyncedValue", {
                                    time: formatDate(
                                      String(status.lastSyncedAt ?? ""),
                                      locale,
                                      never
                                    ),
                                  })}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {t("relayProxies.sheet.dataVersionValue", {
                                    version: String(status.dataVersion ?? "—"),
                                  })}
                                </p>
                              </TableCell>
                              {mode === "edit" && (
                                <TableCell className="text-right align-middle">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={!removable}
                                    title={
                                      removable
                                        ? t("relayProxies.sheet.removeAgent")
                                        : t("relayProxies.sheet.inactiveRemove")
                                    }
                                    onClick={() =>
                                      setAutoAgents((current) =>
                                        current.filter(
                                          (item) => item.id !== agent.id
                                        )
                                      )
                                    }
                                  >
                                    {t("relayProxies.actions.remove")}
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Section>

              <Separator />
              <Section
                title={t("relayProxies.sheet.manualAgents")}
                description={t("relayProxies.sheet.manualAgentsDescription")}
                count={agents.length}
                fullWidth
                action={
                  !readOnly ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAgentDialog("new")}
                    >
                      <Plus /> {t("relayProxies.sheet.addManualAgent")}
                    </Button>
                  ) : undefined
                }
              >
                <div>
                  {agents.length === 0 ? (
                    <p className="py-2 text-sm text-muted-foreground">
                      {t("relayProxies.sheet.noManualAgents")}
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <Table className="table-fixed">
                        <TableHeader className="bg-muted/40">
                          <TableRow>
                            <TableHead className="w-[20%]">
                              {t("relayProxies.sheet.agent")}
                            </TableHead>
                            <TableHead className="w-[11%]">
                              {t("relayProxies.sheet.servesColumn")}
                            </TableHead>
                            <TableHead className="w-[18%]">
                              {t("relayProxies.sheet.lastSynchronized")}
                            </TableHead>
                            <TableHead className="w-[11%]">
                              {t("relayProxies.sheet.dataVersionColumn")}
                            </TableHead>
                            <TableHead className="w-[40%] text-right">
                              {t("relayProxies.sheet.actionsColumn")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {agents.map((agent) => (
                            <TableRow key={agent.id}>
                              <TableCell className="align-middle">
                                <p className="font-medium">{agent.name}</p>
                                <p className="mt-1 max-w-52 truncate text-xs text-muted-foreground">
                                  {agent.host}
                                </p>
                              </TableCell>
                              <TableCell className="align-middle">
                                {agent.serves || "—"}
                              </TableCell>
                              <TableCell className="align-middle text-sm text-muted-foreground">
                                {agent.syncAt
                                  ? formatDate(agent.syncAt, locale, never)
                                  : t("relayProxies.sheet.notSyncedYet")}
                              </TableCell>
                              <TableCell className="align-middle text-sm text-muted-foreground">
                                {agent.dataVersion ?? "—"}
                              </TableCell>
                              <TableCell className="align-middle">
                                <div className="flex flex-wrap justify-end gap-0.5">
                                  {!readOnly && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-auto px-2 py-1"
                                      onClick={() => setAgentDialog(agent)}
                                    >
                                      {t("relayProxies.actions.edit")}
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto px-2 py-1"
                                    disabled={checkingId === agent.id}
                                    onClick={() => void checkAgent(agent)}
                                  >
                                    {checkingId === agent.id
                                      ? t("relayProxies.sheet.checking")
                                      : t("relayProxies.sheet.check")}
                                  </Button>
                                  {mode === "edit" && relayProxy && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-auto px-2 py-1"
                                      disabled={
                                        syncingId === agent.id ||
                                        !savedAgentIds.has(agent.id)
                                      }
                                      title={
                                        savedAgentIds.has(agent.id)
                                          ? t(
                                              "relayProxies.sheet.synchronizeAgent"
                                            )
                                          : t(
                                              "relayProxies.sheet.saveBeforeSync"
                                            )
                                      }
                                      onClick={() => void syncAgent(agent)}
                                    >
                                      {syncingId === agent.id
                                        ? t("relayProxies.sheet.syncing")
                                        : t("relayProxies.sheet.sync")}
                                    </Button>
                                  )}
                                  {!readOnly && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-auto px-2 py-1"
                                      onClick={() =>
                                        setRemoveAgentTarget(agent)
                                      }
                                    >
                                      {t("relayProxies.actions.remove")}
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </Section>

              {mode === "edit" && scopesChanged && (
                <Alert className="mb-6">
                  <AlertTitle>
                    {t("relayProxies.sheet.scopeWarningTitle")}
                  </AlertTitle>
                  <AlertDescription>
                    {t("relayProxies.sheet.scopeWarning")}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {!readOnly && (
              <SheetFooter className="flex-row justify-end px-6 py-4">
                <Button type="submit" disabled={isSaving}>
                  {isSaving
                    ? t("relayProxies.sheet.saving")
                    : mode === "new"
                      ? t("relayProxies.sheet.create")
                      : t("relayProxies.sheet.save")}
                </Button>
              </SheetFooter>
            )}
          </form>
        </SheetContent>
      </Sheet>

      <EnvironmentPickerDialog
        open={environmentPickerOpen}
        environments={environments}
        selected={selectedScopes}
        isLoading={environmentsLoading}
        isError={environmentsError}
        onOpenChange={setEnvironmentPickerOpen}
        onApply={(resources) =>
          form.setValue(
            "scopes",
            resources.map((resource) => resource.id),
            { shouldDirty: true, shouldValidate: true }
          )
        }
        onRetry={onRetryEnvironments}
      />
      <ManualAgentDialog
        key={agentDialog === "new" ? "new" : (agentDialog?.id ?? "closed")}
        open={agentDialog !== null}
        agent={agentDialog === "new" ? null : agentDialog}
        onOpenChange={(nextOpen) => !nextOpen && setAgentDialog(null)}
        onCheck={checkAgentAvailability}
        onSave={(nextAgent) =>
          setAgents((current) => {
            const exists = current.some((item) => item.id === nextAgent.id)
            return exists
              ? current.map((item) =>
                  item.id === nextAgent.id ? nextAgent : item
                )
              : [...current, nextAgent]
          })
        }
      />
      <AlertDialog
        open={Boolean(removeAgentTarget)}
        onOpenChange={(nextOpen) => !nextOpen && setRemoveAgentTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("relayProxies.sheet.removeManualTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("relayProxies.sheet.removeManualDescription", {
                name: removeAgentTarget?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveAgentTarget(null)}
            >
              {t("relayProxies.sheet.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setAgents((current) =>
                  current.filter((item) => item.id !== removeAgentTarget?.id)
                )
                setRemoveAgentTarget(null)
              }}
            >
              {t("relayProxies.sheet.removeAgent")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
