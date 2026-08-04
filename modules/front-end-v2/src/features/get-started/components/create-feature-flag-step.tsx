import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CheckCircle2,
  ChevronsUpDown,
  CircleAlert,
  Flag,
  Loader2,
  Plus,
  Search,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  createFeatureFlag,
  fetchFeatureFlags,
  fetchFlagPolicies,
  isFeatureFlagKeyUsed,
} from "@/features/flags/flags-api"
import {
  canUseFlagAction,
  environmentRn,
} from "@/features/flags/flags-permissions"
import type {
  FeatureFlag,
  FlagCreationPayload,
} from "@/features/flags/flags-types"
import {
  getCurrentProjectEnv,
  getCurrentWorkspace,
} from "@/features/layout/layout-context"
import { isFineGrainedAccessControlGranted } from "@/features/workspace/license/license-utils"
import { cn } from "@/lib/utils"
import type { GetStartedFlag } from "../get-started-types"
import { createBooleanFlagPayload, toFlagKey } from "../get-started-utils"

const KEY_PATTERN = /^[A-Za-z0-9._-]+$/
const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "getStarted.createFlag.validation.nameRequired")
    .max(200),
  key: z
    .string()
    .trim()
    .min(1, "getStarted.createFlag.validation.keyRequired")
    .max(200)
    .regex(KEY_PATTERN, "getStarted.createFlag.validation.keyFormat"),
  description: z
    .string()
    .max(512, "getStarted.createFlag.validation.descriptionTooLong"),
})

type FormValues = z.infer<typeof formSchema>
type PickerMode = "select" | "create" | "existing"
type KeyValidation = "idle" | "checking" | "available" | "used" | "error"
type KeyValidationState = {
  key: string
  status: KeyValidation
}

function asGetStartedFlag(flag: FeatureFlag): GetStartedFlag {
  return {
    id: flag.id,
    name: flag.name,
    key: flag.key,
    description: flag.description,
    variationType: flag.variationType,
    isEnabled: flag.isEnabled,
  }
}

export function CreateFeatureFlagStep({
  value,
  onComplete,
}: {
  value: GetStartedFlag | null
  onComplete: (flag: GetStartedFlag) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const projectEnv = getCurrentProjectEnv()
  const workspace = getCurrentWorkspace()
  const envId = projectEnv?.envId ?? ""
  const envRn = environmentRn({
    projectKey: projectEnv?.projectKey ?? "",
    environmentKey: projectEnv?.envKey ?? "",
  })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [mode, setMode] = useState<PickerMode>(value ? "existing" : "select")
  const [candidate, setCandidate] = useState<GetStartedFlag | null>(value)
  const [keyValidation, setKeyValidation] = useState<KeyValidationState>({
    key: "",
    status: "idle",
  })
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      key: "",
      description: "",
    },
  })
  const watchedKey = useWatch({ control: form.control, name: "key" })
  const watchedName = useWatch({ control: form.control, name: "name" })
  const watchedDescription = useWatch({
    control: form.control,
    name: "description",
  })

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      350
    )
    return () => window.clearTimeout(timeout)
  }, [search])

  const flagsQuery = useQuery({
    queryKey: ["get-started", "feature-flags", envId, debouncedSearch],
    queryFn: () =>
      fetchFeatureFlags(envId, {
        name: debouncedSearch,
        tags: [],
        isArchived: false,
        sortBy: "created_at",
        pageIndex: 1,
        pageSize: 50,
      }),
    enabled: Boolean(envId),
    placeholderData: (previous) => previous,
  })
  const permissionsQuery = useQuery({
    queryKey: ["feature-flag-policies", workspace?.id ?? ""],
    queryFn: fetchFlagPolicies,
    staleTime: 5 * 60_000,
  })
  const canCreate =
    permissionsQuery.isSuccess &&
    canUseFlagAction(
      permissionsQuery.data ?? [],
      `${envRn}:flag/*`,
      "CreateFlag",
      isFineGrainedAccessControlGranted(workspace?.license)
    )
  const autoCreate = Boolean(
    !value &&
    mode === "select" &&
    !debouncedSearch &&
    flagsQuery.isSuccess &&
    flagsQuery.data.totalCount === 0 &&
    permissionsQuery.isSuccess &&
    canCreate
  )
  const effectiveMode: PickerMode = autoCreate ? "create" : mode
  const keyEligible = Boolean(
    effectiveMode === "create" &&
    envId &&
    watchedKey.trim() &&
    KEY_PATTERN.test(watchedKey.trim())
  )

  useEffect(() => {
    const key = watchedKey.trim()
    if (!keyEligible) return

    let cancelled = false
    const timeout = window.setTimeout(() => {
      setKeyValidation({ key, status: "checking" })
      void isFeatureFlagKeyUsed(envId, key)
        .then((used) => {
          if (!cancelled) {
            setKeyValidation({
              key,
              status: used ? "used" : "available",
            })
          }
        })
        .catch(() => {
          if (!cancelled) setKeyValidation({ key, status: "error" })
        })
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [envId, keyEligible, watchedKey])

  const createMutation = useMutation({
    mutationFn: (payload: FlagCreationPayload) =>
      createFeatureFlag(envId, payload),
    onSuccess: (result, payload) => {
      const created: GetStartedFlag = {
        name: payload.name,
        key: result.key ?? payload.key,
        description: payload.description,
        variationType: payload.variationType,
        isEnabled: payload.isEnabled,
      }
      void queryClient.invalidateQueries({ queryKey: ["feature-flags"] })
      void queryClient.invalidateQueries({
        queryKey: ["get-started", "feature-flags", envId],
      })
      toast.success(t("getStarted.createFlag.created"))
      onComplete(created)
    },
    onError: () => {
      toast.error(t("getStarted.createFlag.createFailed"))
    },
  })

  const flags = flagsQuery.data?.items ?? []
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const exactMatch = flags.some(
    (flag) =>
      flag.name.toLocaleLowerCase() === normalizedSearch ||
      flag.key.toLocaleLowerCase() === normalizedSearch
  )
  const showCreateOption = Boolean(normalizedSearch && canCreate && !exactMatch)
  const trimmedKey = watchedKey.trim()
  const displayedKeyValidation: KeyValidation =
    keyEligible && keyValidation.key === trimmedKey
      ? keyValidation.status
      : keyEligible
        ? "checking"
        : "idle"
  const pickerLabel =
    effectiveMode === "create"
      ? watchedName.trim()
        ? t("getStarted.createFlag.createNamed", {
            name: watchedName.trim(),
          })
        : t("getStarted.createFlag.createNew")
      : candidate
        ? candidate.name
        : t("getStarted.createFlag.selectOrCreate")

  function beginCreate(name: string) {
    const nextName = name.trim()
    form.reset({
      name: nextName,
      key: toFlagKey(nextName),
      description: "",
    })
    setCandidate(null)
    setMode("create")
    setSearch(nextName)
    setPickerOpen(false)
  }

  function chooseExisting(flag: FeatureFlag) {
    setCandidate(asGetStartedFlag(flag))
    setMode("existing")
    setSearch(flag.name)
    setPickerOpen(false)
  }

  function handlePickerOpenChange(open: boolean) {
    if (open) {
      setSearch("")
      setDebouncedSearch("")
    }
    setPickerOpen(open)
  }

  const submitCreate = form.handleSubmit(async (values) => {
    const key = values.key.trim()
    try {
      setKeyValidation({ key, status: "checking" })
      const used = await isFeatureFlagKeyUsed(envId, key)
      if (used) {
        setKeyValidation({ key, status: "used" })
        form.setError("key", {
          message: "getStarted.createFlag.validation.keyUsed",
        })
        return
      }
      setKeyValidation({ key, status: "available" })
      createMutation.mutate(createBooleanFlagPayload(values))
    } catch {
      setKeyValidation({ key, status: "error" })
      form.setError("key", {
        message: "getStarted.createFlag.validation.keyFailed",
      })
    }
  })

  const nameField = form.register("name")
  const nameError = form.formState.errors.name?.message
  const keyError =
    form.formState.errors.key?.message ??
    (displayedKeyValidation === "used"
      ? "getStarted.createFlag.validation.keyUsed"
      : "")
  const descriptionError = form.formState.errors.description?.message
  const createDisabled =
    !form.formState.isValid ||
    displayedKeyValidation !== "available" ||
    createMutation.isPending

  if (!envId) {
    return (
      <section className="rounded-lg border bg-card p-5">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{t("getStarted.noEnvironment.title")}</AlertTitle>
          <AlertDescription>
            {t("getStarted.noEnvironment.description")}
          </AlertDescription>
        </Alert>
      </section>
    )
  }

  return (
    <section className="flex flex-col rounded-lg border bg-card">
      <header className="px-5 pt-5">
        <h2
          data-get-started-step-heading
          tabIndex={-1}
          className="rounded-sm text-xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {t("getStarted.createFlag.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("getStarted.createFlag.subtitle")}
        </p>
      </header>

      <div className="space-y-5 px-5 py-5">
        <div className="space-y-2">
          <Label>{t("getStarted.createFlag.featureFlag")}</Label>
          <Popover open={pickerOpen} onOpenChange={handlePickerOpenChange}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-label={t("getStarted.createFlag.selectOrCreate")}
                  className="h-10 w-full justify-between px-3 font-normal"
                />
              }
            >
              <span className="flex min-w-0 items-center gap-2">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <span
                  className={cn(
                    "truncate",
                    !candidate &&
                      effectiveMode === "select" &&
                      "text-muted-foreground"
                  )}
                >
                  {pickerLabel}
                </span>
                {effectiveMode === "create" ? (
                  <Badge variant="outline" className="ml-1 shrink-0">
                    {t("getStarted.common.new")}
                  </Badge>
                ) : null}
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[var(--anchor-width)] min-w-80 p-0"
            >
              <Command shouldFilter={false}>
                <CommandInput
                  value={search}
                  placeholder={t("getStarted.createFlag.searchPlaceholder")}
                  onValueChange={setSearch}
                />
                <CommandList>
                  {flagsQuery.isFetching ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      {t("getStarted.createFlag.searching")}
                    </div>
                  ) : null}
                  {flagsQuery.isError ? (
                    <div className="flex items-center justify-between gap-3 px-3 py-4 text-sm text-destructive">
                      <span>{t("getStarted.createFlag.loadFailed")}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void flagsQuery.refetch()}
                      >
                        {t("getStarted.common.retry")}
                      </Button>
                    </div>
                  ) : null}
                  {!flagsQuery.isFetching && !showCreateOption ? (
                    <CommandEmpty>
                      {t("getStarted.createFlag.notFound")}
                    </CommandEmpty>
                  ) : null}
                  {flags.length ? (
                    <CommandGroup
                      heading={t("getStarted.createFlag.groupTitle")}
                    >
                      {flags.map((flag) => (
                        <CommandItem
                          key={flag.id}
                          value={flag.id}
                          onSelect={() => chooseExisting(flag)}
                        >
                          <Flag className="size-4 text-muted-foreground" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{flag.name}</span>
                            <code className="block truncate text-xs text-muted-foreground">
                              {flag.key}
                            </code>
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {flag.isEnabled
                              ? t("getStarted.common.on")
                              : t("getStarted.common.off")}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                  {showCreateOption ? (
                    <CommandGroup>
                      <CommandItem
                        value={`create-${search.trim()}`}
                        onSelect={() => beginCreate(search)}
                      >
                        <Plus className="size-4" />
                        <span className="min-w-0 flex-1 truncate">
                          {t("getStarted.createFlag.createNamed", {
                            name: search.trim(),
                          })}
                        </span>
                        <Badge variant="outline">
                          {t("getStarted.common.new")}
                        </Badge>
                      </CommandItem>
                    </CommandGroup>
                  ) : null}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            {t("getStarted.createFlag.searchHelp")}
          </p>
        </div>

        {flagsQuery.isLoading && !flagsQuery.data ? (
          <div className="space-y-4">
            <Skeleton className="h-5 w-28" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
            <Skeleton className="h-24" />
          </div>
        ) : null}

        {effectiveMode === "select" && !flagsQuery.isLoading ? (
          <div className="rounded-lg border border-dashed px-5 py-8 text-center">
            <Flag className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">
              {t("getStarted.createFlag.chooseTitle")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("getStarted.createFlag.chooseDescription")}
            </p>
          </div>
        ) : null}

        {effectiveMode === "existing" && candidate ? (
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{candidate.name}</p>
                <code className="mt-1 block truncate text-xs text-muted-foreground">
                  {candidate.key}
                </code>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline">
                  {t("getStarted.common.boolean")}
                </Badge>
                <Badge variant="secondary">
                  {candidate.isEnabled
                    ? t("getStarted.common.on")
                    : t("getStarted.common.off")}
                </Badge>
              </div>
            </div>
            {candidate.description ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {candidate.description}
              </p>
            ) : null}
          </div>
        ) : null}

        {effectiveMode === "create" ? (
          <form
            id="get-started-flag-form"
            className="space-y-5"
            onSubmit={submitCreate}
          >
            <h3 className="text-base font-semibold">
              {t("getStarted.createFlag.flagDetails")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="get-started-flag-name">
                  {t("getStarted.createFlag.name")}
                </Label>
                <Input
                  id="get-started-flag-name"
                  disabled={createMutation.isPending}
                  {...nameField}
                  onChange={(event) => {
                    nameField.onChange(event)
                    form.setValue("key", toFlagKey(event.target.value), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }}
                />
                {nameError ? (
                  <p className="text-xs text-destructive">{t(nameError)}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="get-started-flag-key">
                  {t("getStarted.createFlag.key")}
                </Label>
                <div className="relative">
                  <Input
                    id="get-started-flag-key"
                    className="pr-28 font-mono"
                    disabled={createMutation.isPending}
                    {...form.register("key")}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1.5 text-xs">
                    {displayedKeyValidation === "checking" ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {t("getStarted.createFlag.checking")}
                        </span>
                      </>
                    ) : null}
                    {displayedKeyValidation === "available" ? (
                      <>
                        <CheckCircle2 className="size-3.5 text-green-600 dark:text-green-500" />
                        <span className="text-green-700 dark:text-green-400">
                          {t("getStarted.createFlag.available")}
                        </span>
                      </>
                    ) : null}
                  </span>
                </div>
                {keyError ? (
                  <p className="text-xs text-destructive">{t(keyError)}</p>
                ) : displayedKeyValidation === "error" ? (
                  <p className="text-xs text-destructive">
                    {t("getStarted.createFlag.validation.keyFailed")}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="get-started-flag-description">
                  {t("getStarted.createFlag.descriptionOptional")}
                </Label>
                {watchedDescription.length >= 450 ? (
                  <span
                    className={cn(
                      "text-xs text-muted-foreground tabular-nums",
                      watchedDescription.length > 512 && "text-destructive"
                    )}
                  >
                    {watchedDescription.length} / 512
                  </span>
                ) : null}
              </div>
              <Textarea
                id="get-started-flag-description"
                rows={3}
                disabled={createMutation.isPending}
                {...form.register("description")}
              />
              {descriptionError ? (
                <p className="text-xs text-destructive">
                  {t(descriptionError)}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold">
                  {t("getStarted.createFlag.booleanPreset")}
                </h3>
                <Badge variant="outline">
                  {t("getStarted.common.boolean")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("getStarted.createFlag.variationTypeLocked")}
              </p>
              <div className="overflow-hidden rounded-lg border text-sm">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(8rem,1fr)] items-center border-b px-4 py-2.5">
                  <span>{t("getStarted.createFlag.whenOn")}</span>
                  <span className="flex items-center gap-3">
                    <span className="size-2.5 rounded-full bg-green-600" />
                    {t("getStarted.createFlag.true")}
                  </span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(8rem,1fr)] items-center px-4 py-2.5">
                  <span>{t("getStarted.createFlag.whenOff")}</span>
                  <span className="flex items-center gap-3">
                    <span className="size-2.5 rounded-full bg-slate-400" />
                    {t("getStarted.createFlag.false")}
                  </span>
                </div>
              </div>
            </div>

            {createMutation.isError ? (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>
                  {t("getStarted.createFlag.createFailedTitle")}
                </AlertTitle>
                <AlertDescription>
                  {t("getStarted.createFlag.createFailedDescription")}
                </AlertDescription>
              </Alert>
            ) : null}
          </form>
        ) : null}

        {!canCreate &&
        permissionsQuery.isSuccess &&
        flagsQuery.isSuccess &&
        flagsQuery.data.totalCount === 0 ? (
          <Alert>
            <CircleAlert />
            <AlertTitle>
              {t("getStarted.createFlag.unavailableTitle")}
            </AlertTitle>
            <AlertDescription>
              {t("getStarted.createFlag.unavailableDescription")}
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <footer className="flex min-h-16 items-center justify-end border-t bg-muted/10 px-5 py-3">
        {effectiveMode === "create" ? (
          <Button
            type="submit"
            form="get-started-flag-form"
            disabled={createDisabled}
          >
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {t("getStarted.createFlag.createAndContinue")}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={!candidate}
            onClick={() => candidate && onComplete(candidate)}
          >
            {t("getStarted.createFlag.continueWithFlag")}
          </Button>
        )}
      </footer>
    </section>
  )
}
