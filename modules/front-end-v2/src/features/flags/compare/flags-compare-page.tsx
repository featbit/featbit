import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowLeft,
  ChevronsUpDown,
  Lock,
  Search,
} from "lucide-react"
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
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
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  fetchProjects,
  getCurrentOrganization,
  getCurrentProjectEnv,
  getCurrentWorkspace,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"
import {
  getLicenseStatus,
  isFeatureGranted,
  parseLicense,
} from "@/features/workspace/license/license-utils"
import { fetchApi } from "@/lib/api/authenticated-api"
import {
  canUseFlagAction,
  environmentRn,
  featureFlagRn,
} from "../flags-permissions"
import { fetchFeatureFlagTags, fetchFlagPolicies } from "../flags-api"
import type { FeatureFlag } from "../flags-types"
import { CopyFlagsDialog } from "../components/copy-flags-dialog"
import { FlagDifferencesSheet } from "../components/flag-differences-sheet"
import { FlagsCompareMatrix } from "./components/flags-compare-matrix"
import { FlagsCompareScope } from "./components/flags-compare-scope"
import { FlagsPagination } from "../components/flags-pagination"
import type {
  CompareEnvironment,
  CompareOverviewRequest,
  FlagCompareOverview,
  PagedFlagCompareOverview,
} from "./flags-compare-types"

function positiveInt(
  value: string | null,
  fallback: number,
  allowed?: number[]
) {
  const parsed = Number(value)
  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    (allowed && !allowed.includes(parsed))
  )
    return fallback
  return parsed
}

function compareOverviewQueryKey(request: CompareOverviewRequest) {
  return [
    "feature-flag-compare-overview",
    request.envId,
    request.targetEnvIds.join(","),
    request.name,
    request.tags.join(","),
    request.sortBy,
    request.pageIndex,
    request.pageSize,
  ] as const
}

function fetchCompareOverview(request: CompareOverviewRequest) {
  return fetchApi<PagedFlagCompareOverview>(
    `/api/v1/envs/${encodeURIComponent(request.envId)}/feature-flags/compare-overview`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetEnvIds: request.targetEnvIds,
        filter: {
          name: request.name,
          tags: request.tags,
          isArchived: false,
          sortBy: request.sortBy,
          pageIndex: request.pageIndex - 1,
          pageSize: request.pageSize,
        },
      }),
    }
  )
}

function toFeatureFlag(flag: FlagCompareOverview): FeatureFlag {
  return {
    id: flag.id,
    name: flag.name,
    key: flag.key,
    description: flag.description,
    tags: flag.tags,
    isEnabled: false,
    createdAt: "",
    updatedAt: "",
    variationType: "boolean",
  }
}

function CompareTagsPopoverContent({ children }: { children: ReactNode }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align="start"
        side="bottom"
        sideOffset={4}
        className="isolate z-[60]"
      >
        <PopoverPrimitive.Popup className="w-60 rounded-md border bg-popover text-popover-foreground shadow-md outline-none">
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function CompareTagsFilter({
  tags,
  selectedTags,
  loading,
  error,
  disabled,
  onChange,
  onRetry,
}: {
  tags: string[]
  selectedTags: string[]
  loading: boolean
  error: boolean
  disabled: boolean
  onChange: (tags: string[]) => void
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const visibleTags = selectedTags.slice(0, 2)
  const hiddenTagCount = selectedTags.length - visibleTags.length
  const label = selectedTags.length
    ? t("featureFlags.comparePage.tags.selectedLabel", {
        tags: `${visibleTags.join(", ")}${hiddenTagCount ? ` +${hiddenTagCount}` : ""}`,
      })
    : t("featureFlags.comparePage.tags.label")

  function toggle(tag: string) {
    onChange(
      selectedTags.includes(tag)
        ? selectedTags.filter((item) => item !== tag)
        : [...selectedTags, tag]
    )
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="w-52 justify-between font-normal"
          />
        }
      >
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <CompareTagsPopoverContent>
        <Command>
          <CommandInput
            placeholder={t("featureFlags.comparePage.tags.search")}
          />
          <CommandList>
            {error ? (
              <div className="flex items-center justify-between gap-3 px-3 py-4 text-sm text-destructive">
                <span>{t("featureFlags.comparePage.tags.loadFailed")}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                >
                  {t("featureFlags.comparePage.tags.retry")}
                </Button>
              </div>
            ) : null}
            {!error ? (
              <CommandEmpty>
                {loading
                  ? t("featureFlags.comparePage.tags.loading")
                  : t("featureFlags.comparePage.tags.empty")}
              </CommandEmpty>
            ) : null}
            {!error ? (
              <CommandGroup>
                {tags.map((tag) => (
                  <CommandItem
                    key={tag}
                    value={tag}
                    data-checked={selectedTags.includes(tag)}
                    onSelect={() => toggle(tag)}
                  >
                    <span className="truncate">{tag}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
        {selectedTags.length ? (
          <div className="border-t p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onChange([])}
            >
              {t("featureFlags.comparePage.tags.clearAll")}
            </Button>
          </div>
        ) : null}
      </CompareTagsPopoverContent>
    </Popover>
  )
}

export function FlagsComparePage() {
  const { lang: langParam } = useParams()
  const lang = resolveLang(langParam)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const workspace = getCurrentWorkspace()
  const organization = getCurrentOrganization() as ReturnType<
    typeof getCurrentOrganization
  > & { settings?: { flagSortedBy?: "created_at" | "key" } }
  const projectEnv = getCurrentProjectEnv()
  const envId = projectEnv?.envId ?? ""
  const sortBy = organization?.settings?.flagSortedBy ?? "created_at"

  const [search, setSearch] = useState(() => searchParams.get("name") ?? "")
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim())
  const [draftTargetIds, setDraftTargetIds] = useState<string[]>([])
  const [appliedTargetIds, setAppliedTargetIds] = useState<string[]>([])
  const [reviewTarget, setReviewTarget] = useState<{
    sourceEnvId: string
    flag: FlagCompareOverview
    target: CompareEnvironment
  } | null>(null)
  const [copyTarget, setCopyTarget] = useState<{
    sourceEnvId: string
    flag: FeatureFlag
    target: CompareEnvironment
  } | null>(null)

  const selectedTags = useMemo(
    () => searchParams.get("tags")?.split(",").filter(Boolean) ?? [],
    [searchParams]
  )
  const pageIndex = positiveInt(searchParams.get("page"), 1)
  const pageSize = positiveInt(searchParams.get("pageSize"), 10, [10, 20, 30])

  const updateParams = useCallback(
    (updates: Record<string, string | null>, resetPage = false) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          Object.entries(updates).forEach(([key, value]) =>
            value ? next.set(key, value) : next.delete(key)
          )
          if (resetPage) next.delete("page")
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const value = search.trim()
      setDebouncedSearch(value)
      updateParams({ name: value || null }, true)
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [search, updateParams])

  const projectsQuery = useQuery({
    queryKey: ["projects", "flag-compare"],
    queryFn: fetchProjects,
    staleTime: 60_000,
  })
  const tagsQuery = useQuery({
    queryKey: ["feature-flag-tags", envId],
    queryFn: () => fetchFeatureFlagTags(envId),
    enabled: Boolean(envId),
    staleTime: 5 * 60_000,
  })
  const permissionsQuery = useQuery({
    queryKey: ["feature-flag-policies", workspace?.id ?? ""],
    queryFn: fetchFlagPolicies,
    staleTime: 5 * 60_000,
  })

  const environments: CompareEnvironment[] = (projectsQuery.data ?? []).flatMap(
    (project) =>
      project.environments
        .filter((environment) => environment.id !== envId)
        .map((environment) => ({
          id: environment.id,
          projectId: project.id,
          projectName: project.name,
          environmentName: environment.name,
          label: `${project.name} / ${environment.name}`,
        }))
  )

  const decodedLicense = parseLicense(workspace?.license)
  const comparisonGranted = isFeatureGranted(
    {
      id: "flag-comparison",
      labelKey: "workspace.license.features.flagComparison.title",
      descriptionKey: "workspace.license.features.flagComparison.description",
    },
    decodedLicense,
    getLicenseStatus(decodedLicense)
  )

  const envRn = environmentRn({
    projectKey: projectEnv?.projectKey ?? "",
    environmentKey: projectEnv?.envKey ?? "",
  })
  function canCopyFlag(flag: Pick<FlagCompareOverview, "key" | "tags">) {
    return (
      permissionsQuery.isSuccess &&
      canUseFlagAction(
        permissionsQuery.data ?? [],
        featureFlagRn(envRn, flag),
        "CopyFlagTo"
      )
    )
  }

  function normalizeTargetIds(ids: string[]) {
    const selected = new Set(ids)
    return environments
      .filter((environment) => selected.has(environment.id))
      .map((environment) => environment.id)
  }

  const normalizedDraftIds = normalizeTargetIds(draftTargetIds)
  const normalizedAppliedTargetIds = normalizeTargetIds(appliedTargetIds)

  const request: CompareOverviewRequest = {
    envId,
    targetEnvIds: normalizedAppliedTargetIds,
    name: debouncedSearch,
    tags: selectedTags,
    sortBy,
    pageIndex,
    pageSize,
  }
  const overviewQuery = useQuery({
    queryKey: compareOverviewQueryKey(request),
    queryFn: () => fetchCompareOverview(request),
    enabled: Boolean(
      envId && normalizedAppliedTargetIds.length && comparisonGranted
    ),
    placeholderData: (previous) => previous,
  })

  const applyMutation = useMutation({
    mutationFn: async (targetEnvIds: string[]) => {
      const nextRequest: CompareOverviewRequest = {
        ...request,
        targetEnvIds,
        pageIndex: 1,
      }
      return {
        data: await fetchCompareOverview(nextRequest),
        request: nextRequest,
      }
    },
    onSuccess: ({ data, request: nextRequest }) => {
      queryClient.setQueryData(compareOverviewQueryKey(nextRequest), data)
      setAppliedTargetIds(nextRequest.targetEnvIds)
      updateParams({ page: null })
    },
  })

  const appliedTargetSet = new Set(normalizedAppliedTargetIds)
  const appliedTargets = environments.filter((environment) =>
    appliedTargetSet.has(environment.id)
  )
  const draftSet = new Set(normalizedDraftIds)
  const hasUnappliedChanges =
    normalizedDraftIds.length !== normalizedAppliedTargetIds.length ||
    normalizedAppliedTargetIds.some((id) => !draftSet.has(id))
  const hasFilters = Boolean(debouncedSearch || selectedTags.length)
  const overview = overviewQuery.data ?? { items: [], totalCount: 0 }
  const resultsError = applyMutation.isError || overviewQuery.isError
  const activeReviewTarget =
    reviewTarget?.sourceEnvId === envId ? reviewTarget : null
  const activeCopyTarget = copyTarget?.sourceEnvId === envId ? copyTarget : null

  function changeDraftTargets(ids: string[]) {
    applyMutation.reset()
    setDraftTargetIds(normalizeTargetIds(ids))
  }

  function applyTargets() {
    const targets = normalizeTargetIds(draftTargetIds)
    if (!targets.length) return
    applyMutation.mutate(targets)
  }

  function clearFilters() {
    setSearch("")
    updateParams({ name: null, tags: null }, true)
  }

  function invalidateOverview() {
    void queryClient.invalidateQueries({
      queryKey: ["feature-flag-compare-overview", envId],
    })
  }

  if (!projectEnv || !envId) {
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-8">
        <p className="text-sm text-muted-foreground">
          {t("featureFlags.comparePage.loadContextFailed")}
        </p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-6 py-6 lg:px-8">
        <header className="mb-6">
          <Button
            type="button"
            variant="link"
            className="mb-3 h-auto px-0 text-sm font-normal"
            onClick={() => {
              if (location.key !== "default") navigate(-1)
              else navigate(localizedPath(lang, "/feature-flags"))
            }}
          >
            <ArrowLeft />
            {t("featureFlags.comparePage.back")}
          </Button>
          <h1 className="text-2xl font-semibold tracking-normal">
            {t("featureFlags.comparePage.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("featureFlags.comparePage.subtitle")}
          </p>
        </header>

        <FlagsCompareScope
          source={projectEnv}
          environments={environments}
          selectedIds={normalizedDraftIds}
          loading={projectsQuery.isLoading}
          error={projectsQuery.isError}
          disabled={!comparisonGranted}
          applying={applyMutation.isPending}
          hasUnappliedChanges={hasUnappliedChanges}
          onChange={changeDraftTargets}
          onApply={applyTargets}
          onRetry={() => void projectsQuery.refetch()}
        />

        {!comparisonGranted ? (
          <Alert className="mt-4 bg-muted/30">
            <Lock />
            <AlertTitle>
              {t("featureFlags.comparePage.unavailableTitle")}
            </AlertTitle>
            <AlertDescription>
              {t("featureFlags.comparePage.unavailableDescription")}
            </AlertDescription>
          </Alert>
        ) : null}

        {resultsError ? (
          <Alert variant="destructive" className="mt-4 bg-destructive/5">
            <AlertTriangle />
            <AlertTitle>
              {t("featureFlags.comparePage.resultsFailed")}
            </AlertTitle>
            <AlertDescription>
              {t("featureFlags.comparePage.resultsFailedHelp")}
            </AlertDescription>
            <AlertAction>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (applyMutation.isError) applyTargets()
                  else void overviewQuery.refetch()
                }}
              >
                {t("featureFlags.comparePage.retry")}
              </Button>
            </AlertAction>
          </Alert>
        ) : null}

        {appliedTargets.length ? (
          <>
            <div className="my-4 flex flex-wrap items-center gap-3">
              <div className="relative w-full min-w-0 lg:w-80">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  className="pl-9"
                  placeholder={t("featureFlags.comparePage.search")}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <CompareTagsFilter
                tags={tagsQuery.data ?? []}
                selectedTags={selectedTags}
                loading={tagsQuery.isLoading}
                error={tagsQuery.isError}
                disabled={overviewQuery.isFetching && !overviewQuery.data}
                onChange={(tags) =>
                  updateParams(
                    { tags: tags.length ? tags.join(",") : null },
                    true
                  )
                }
                onRetry={() => void tagsQuery.refetch()}
              />
              {hasFilters ? (
                <Button type="button" variant="ghost" onClick={clearFilters}>
                  {t("featureFlags.comparePage.clearFilters")}
                </Button>
              ) : null}
              <p className="ml-auto text-sm text-muted-foreground">
                {t("featureFlags.comparePage.comparing", {
                  count: appliedTargets.length,
                })}
              </p>
            </div>

            <FlagsCompareMatrix
              lang={lang}
              source={projectEnv}
              items={overview.items}
              targets={appliedTargets}
              loading={overviewQuery.isLoading && !overviewQuery.data}
              hasFilters={hasFilters}
              permissionPending={permissionsQuery.isLoading}
              canCopy={canCopyFlag}
              onReview={(flag, target) =>
                setReviewTarget({ sourceEnvId: envId, flag, target })
              }
              onCopy={(flag, target) =>
                setCopyTarget({
                  sourceEnvId: envId,
                  flag: toFeatureFlag(flag),
                  target,
                })
              }
              onCopyKey={async (key) => {
                try {
                  await navigator.clipboard.writeText(key)
                  toast.success(t("featureFlags.comparePage.keyCopied"))
                } catch {
                  toast.error(t("featureFlags.comparePage.keyCopyFailed"))
                }
              }}
              onClearFilters={clearFilters}
            />
            <FlagsPagination
              lang={lang}
              pageIndex={pageIndex}
              pageSize={pageSize}
              totalCount={overview.totalCount}
              disabled={overviewQuery.isFetching}
              onPageIndexChange={(page) =>
                updateParams({ page: page === 1 ? null : String(page) })
              }
              onPageSizeChange={(size) =>
                updateParams({ pageSize: String(size) }, true)
              }
            />
          </>
        ) : null}

        <FlagDifferencesSheet
          lang={lang}
          envId={envId}
          flag={activeReviewTarget?.flag ?? null}
          open={Boolean(activeReviewTarget)}
          lockedTarget={
            activeReviewTarget
              ? {
                  id: activeReviewTarget.target.id,
                  name: activeReviewTarget.target.label,
                }
              : null
          }
          comparisonGranted={comparisonGranted}
          canCopy={
            activeReviewTarget ? canCopyFlag(activeReviewTarget.flag) : false
          }
          onOpenChange={(open) => {
            if (!open) setReviewTarget(null)
          }}
          onCopied={invalidateOverview}
        />

        {activeCopyTarget ? (
          <CopyFlagsDialog
            key={`${activeCopyTarget.flag.id}-${activeCopyTarget.target.id}`}
            lang={lang}
            envId={envId}
            flags={[activeCopyTarget.flag]}
            lockedTarget={{
              id: activeCopyTarget.target.id,
              name: activeCopyTarget.target.label,
            }}
            open
            onOpenChange={(open) => {
              if (!open) setCopyTarget(null)
            }}
            onSuccess={invalidateOverview}
          />
        ) : null}
      </div>
    </TooltipProvider>
  )
}
