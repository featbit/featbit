import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  getLicenseStatus,
  isFineGrainedAccessControlGranted,
  isFeatureGranted,
  parseLicense,
} from "@/features/workspace/license/license-utils"
import {
  getCurrentOrganization,
  getCurrentProjectEnv,
  getCurrentWorkspace,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"
import {
  archiveFeatureFlag,
  cloneFeatureFlag,
  createFeatureFlag,
  fetchFeatureFlags,
  fetchFeatureFlagTags,
  fetchFlagEnvironmentSettings,
  fetchFlagPolicies,
  isFeatureFlagKeyUsed,
  removeFeatureFlag,
  restoreFeatureFlag,
  toggleFeatureFlag,
} from "../flags-api"
import {
  canUseFlagAction,
  environmentRn,
  featureFlagRn,
  type FlagAction,
} from "../flags-permissions"
import type { FeatureFlag, FlagCreationPayload } from "../flags-types"
import { CopyFlagsDialog } from "../components/copy-flags-dialog"
import { FlagDifferencesSheet } from "../components/flag-differences-sheet"
import { FlagEditorSheet } from "./components/flag-editor-sheet"
import {
  FlagConfirmDialog,
  type FlagConfirmation,
} from "./components/flag-confirm-dialog"
import { FlagsPagination } from "../components/flags-pagination"
import { FlagsTable } from "./components/flags-table"
import { FlagsToolbar } from "./components/flags-toolbar"

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

export function FlagsPage() {
  const { lang: langParam } = useParams()
  const lang = resolveLang(langParam)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const workspace = getCurrentWorkspace()
  const organization = getCurrentOrganization() as ReturnType<
    typeof getCurrentOrganization
  > & { settings?: { flagSortedBy?: "created_at" | "key" } }
  const projectEnv = getCurrentProjectEnv()
  const envId = projectEnv?.envId ?? ""
  const envRn = environmentRn({
    projectKey: projectEnv?.projectKey ?? "",
    environmentKey: projectEnv?.envKey ?? "",
  })

  const [search, setSearch] = useState(() => searchParams.get("name") ?? "")
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedFlags, setSelectedFlags] = useState<Map<string, FeatureFlag>>(
    new Map()
  )
  const [confirmation, setConfirmation] = useState<FlagConfirmation>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [cloneTarget, setCloneTarget] = useState<FeatureFlag | null>(null)
  const [copyTargets, setCopyTargets] = useState<FeatureFlag[]>([])
  const [compareTarget, setCompareTarget] = useState<FeatureFlag | null>(null)

  const selectedTags = useMemo(
    () => searchParams.get("tags")?.split(",").filter(Boolean) ?? [],
    [searchParams]
  )
  const status = (
    searchParams.get("status") === "on" || searchParams.get("status") === "off"
      ? searchParams.get("status")
      : "all"
  ) as "all" | "on" | "off"
  const archived = searchParams.get("archived") === "true"
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

  const listQuery = useQuery({
    queryKey: [
      "feature-flags",
      envId,
      debouncedSearch,
      selectedTags.join(","),
      status,
      archived,
      pageIndex,
      pageSize,
      organization?.settings?.flagSortedBy,
    ],
    queryFn: () =>
      fetchFeatureFlags(envId, {
        name: debouncedSearch,
        tags: selectedTags,
        isEnabled: status === "all" ? undefined : status === "on",
        isArchived: archived,
        sortBy: organization?.settings?.flagSortedBy ?? "created_at",
        pageIndex,
        pageSize,
      }),
    enabled: Boolean(envId),
    placeholderData: (previous) => previous,
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
  const settingsQuery = useQuery({
    queryKey: ["feature-flag-environment-settings", envId],
    queryFn: () => fetchFlagEnvironmentSettings(envId),
    enabled: Boolean(envId),
    staleTime: 5 * 60_000,
  })
  const policies = useMemo(
    () => permissionsQuery.data ?? [],
    [permissionsQuery.data]
  )
  const fineGrainedGranted = useMemo(
    () => isFineGrainedAccessControlGranted(workspace?.license),
    [workspace?.license]
  )
  const canPerform = useCallback(
    (flag: FeatureFlag, action: FlagAction) =>
      permissionsQuery.isSuccess &&
      canUseFlagAction(
        policies,
        featureFlagRn(envRn, flag),
        action,
        fineGrainedGranted
      ),
    [envRn, fineGrainedGranted, permissionsQuery.isSuccess, policies]
  )
  const canCreate =
    permissionsQuery.isSuccess &&
    canUseFlagAction(
      policies,
      `${envRn}:flag/*`,
      "CreateFlag",
      fineGrainedGranted
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

  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["feature-flags"] }),
    [queryClient]
  )
  const mutation = useMutation({
    mutationFn: async ({
      target,
      comment,
    }: {
      target: NonNullable<FlagConfirmation>
      comment: string
    }) => {
      if (target.kind === "toggle")
        return toggleFeatureFlag(
          envId,
          target.flag.key,
          Boolean(target.nextEnabled),
          comment
        )
      if (target.kind === "archive")
        return archiveFeatureFlag(envId, target.flag.key, comment)
      if (target.kind === "restore")
        return restoreFeatureFlag(envId, target.flag.key, comment)
      return removeFeatureFlag(envId, target.flag.key, comment)
    },
    onSuccess: (_, variables) => {
      const target = variables.target
      setConfirmation(null)
      toast.success(t("featureFlags.operationSucceeded"))
      setSelectedIds((current) => {
        const next = new Set(current)
        next.delete(target.flag.id)
        return next
      })
      setSelectedFlags((current) => {
        const next = new Map(current)
        next.delete(target.flag.id)
        return next
      })
      if (
        (listQuery.data?.items.length ?? 0) === 1 &&
        pageIndex > 1 &&
        target.kind !== "toggle"
      )
        updateParams({ page: String(pageIndex - 1) })
      void invalidateList()
    },
    onError: () => toast.error(t("featureFlags.operationFailed")),
  })
  const createMutation = useMutation({
    mutationFn: (payload: FlagCreationPayload) =>
      createFeatureFlag(envId, payload),
    onSuccess: (_, payload) => {
      setEditorOpen(false)
      toast.success(t("featureFlags.operationSucceeded"))
      void invalidateList()
      navigate(
        localizedPath(
          lang,
          `/feature-flags/${encodeURIComponent(payload.key)}/targeting`
        )
      )
    },
    onError: () => toast.error(t("featureFlags.operationFailed")),
  })
  const cloneMutation = useMutation({
    mutationFn: ({
      source,
      payload,
    }: {
      source: FeatureFlag
      payload: {
        name: string
        key: string
        description: string
        tags: string[]
      }
    }) => cloneFeatureFlag(envId, source.key, payload),
    onSuccess: (_, variables) => {
      setEditorOpen(false)
      setCloneTarget(null)
      toast.success(t("featureFlags.operationSucceeded"))
      void invalidateList()
      navigate(
        localizedPath(
          lang,
          `/feature-flags/${encodeURIComponent(variables.payload.key)}/targeting`
        )
      )
    },
    onError: () => toast.error(t("featureFlags.operationFailed")),
  })

  const data = listQuery.data ?? { items: [], totalCount: 0 }
  const selectedCount = selectedIds.size
  const canCopySelected =
    selectedCount > 0 &&
    [...selectedFlags.values()].every((flag) => canPerform(flag, "CopyFlagTo"))

  function toggleSelected(flag: FeatureFlag) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(flag.id)) next.delete(flag.id)
      else next.add(flag.id)
      return next
    })
    setSelectedFlags((current) => {
      const next = new Map(current)
      if (next.has(flag.id)) next.delete(flag.id)
      else next.set(flag.id, flag)
      return next
    })
  }
  function togglePage() {
    const allSelected =
      data.items.length > 0 &&
      data.items.every((flag) => selectedIds.has(flag.id))
    setSelectedIds((current) => {
      const next = new Set(current)
      data.items.forEach((flag) =>
        allSelected ? next.delete(flag.id) : next.add(flag.id)
      )
      return next
    })
    setSelectedFlags((current) => {
      const next = new Map(current)
      data.items.forEach((flag) =>
        allSelected ? next.delete(flag.id) : next.set(flag.id, flag)
      )
      return next
    })
  }
  function clearSelection() {
    setSelectedIds(new Set())
    setSelectedFlags(new Map())
  }
  function clearFilters() {
    setSearch("")
    updateParams({ name: null, tags: null, status: null, archived: null }, true)
  }
  function requirePermission(
    flag: FeatureFlag,
    action: FlagAction,
    next: () => void
  ) {
    if (canPerform(flag, action)) next()
    else toast.error(t("featureFlags.permissionDenied"))
  }

  if (!envId)
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-8">
        <p className="text-sm text-muted-foreground">
          {t("featureFlags.loadFailed")}
        </p>
      </div>
    )

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-6 py-6 lg:px-8">
        <header className="mb-9 space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">
            {t("featureFlags.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("featureFlags.subtitle")}
          </p>
        </header>
        <FlagsToolbar
          lang={lang}
          search={search}
          tags={tagsQuery.data ?? []}
          selectedTags={selectedTags}
          tagsLoading={tagsQuery.isLoading}
          status={status}
          archived={archived}
          selectedCount={selectedCount}
          canCreate={canCreate}
          canCopySelected={canCopySelected}
          onSearchChange={setSearch}
          onTagsChange={(tags) =>
            updateParams({ tags: tags.length ? tags.join(",") : null }, true)
          }
          onStatusChange={(value) =>
            updateParams({ status: value === "all" ? null : value }, true)
          }
          onArchivedChange={(value) =>
            updateParams({ archived: value ? "true" : null }, true)
          }
          onClearFilters={clearFilters}
          onClearSelection={clearSelection}
          onCopySelected={() => setCopyTargets([...selectedFlags.values()])}
          onCompare={() =>
            navigate(localizedPath(lang, "/feature-flags/compare"))
          }
          onCreate={() => {
            setCloneTarget(null)
            setEditorOpen(true)
          }}
        />
        <div className="overflow-x-auto rounded-md border bg-background">
          {listQuery.isError ? (
            <div className="flex items-center justify-between border-b bg-destructive/5 px-5 py-3 text-sm text-destructive">
              <span>{t("featureFlags.loadFailed")}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void listQuery.refetch()}
              >
                {t("featureFlags.retry")}
              </Button>
            </div>
          ) : null}
          <FlagsTable
            lang={lang}
            items={data.items}
            loading={listQuery.isLoading && !listQuery.data}
            archived={archived}
            hasFilters={Boolean(
              debouncedSearch || selectedTags.length || status !== "all"
            )}
            selectedIds={selectedIds}
            mutatingId={
              mutation.isPending
                ? (mutation.variables?.target.flag.id ?? null)
                : null
            }
            canToggle={(flag) => canPerform(flag, "ToggleFlag")}
            canArchive={(flag) => canPerform(flag, "ArchiveFlag")}
            canRestore={(flag) => canPerform(flag, "RestoreFlag")}
            canRemove={(flag) => canPerform(flag, "DeleteFlag")}
            onToggleSelected={toggleSelected}
            onTogglePage={togglePage}
            onToggle={(flag) =>
              requirePermission(flag, "ToggleFlag", () =>
                setConfirmation({
                  kind: "toggle",
                  flag,
                  nextEnabled: !flag.isEnabled,
                })
              )
            }
            onCopyKey={async (key) => {
              try {
                await navigator.clipboard.writeText(key)
                toast.success(t("featureFlags.copied"))
              } catch {
                toast.error(t("featureFlags.operationFailed"))
              }
            }}
            onCopyTo={(flag) =>
              requirePermission(flag, "CopyFlagTo", () =>
                setCopyTargets([flag])
              )
            }
            onClone={(flag) =>
              requirePermission(flag, "CloneFlag", () => {
                setCloneTarget(flag)
                setEditorOpen(true)
              })
            }
            onCompare={(flag) => setCompareTarget(flag)}
            onArchive={(flag) => setConfirmation({ kind: "archive", flag })}
            onRestore={(flag) => setConfirmation({ kind: "restore", flag })}
            onRemove={(flag) => setConfirmation({ kind: "remove", flag })}
            onClearFilters={clearFilters}
            onCreate={() => {
              setCloneTarget(null)
              setEditorOpen(true)
            }}
            canCreate={canCreate}
          />
        </div>
        <FlagsPagination
          lang={lang}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={data.totalCount}
          disabled={listQuery.isFetching}
          onPageIndexChange={(page) =>
            updateParams({ page: page === 1 ? null : String(page) })
          }
          onPageSizeChange={(size) =>
            updateParams({ pageSize: String(size) }, true)
          }
        />
        <FlagConfirmDialog
          key={
            confirmation
              ? `${confirmation.kind}-${confirmation.flag.id}`
              : "closed"
          }
          target={confirmation}
          saving={mutation.isPending}
          requireComment={settingsQuery.data?.requireChangeComment ?? false}
          onOpenChange={(open) => !open && setConfirmation(null)}
          onConfirm={(comment) =>
            confirmation && mutation.mutate({ target: confirmation, comment })
          }
        />
        <FlagDifferencesSheet
          lang={lang}
          envId={envId}
          flag={compareTarget}
          open={Boolean(compareTarget)}
          comparisonGranted={comparisonGranted}
          canCopy={
            compareTarget ? canPerform(compareTarget, "CopyFlagTo") : false
          }
          onOpenChange={(open) => {
            if (!open) setCompareTarget(null)
          }}
          onCopied={() => void invalidateList()}
        />
        <FlagEditorSheet
          envId={envId}
          open={editorOpen}
          source={cloneTarget}
          saving={createMutation.isPending || cloneMutation.isPending}
          onOpenChange={(open) => {
            setEditorOpen(open)
            if (!open) setCloneTarget(null)
          }}
          onValidateKey={(key) => isFeatureFlagKeyUsed(envId, key)}
          onCreate={(payload) =>
            createMutation.mutateAsync(payload).then(() => undefined)
          }
          onClone={(source, payload) =>
            cloneMutation.mutateAsync({ source, payload }).then(() => undefined)
          }
        />
        {copyTargets.length ? (
          <CopyFlagsDialog
            lang={lang}
            envId={envId}
            flags={copyTargets}
            open
            onOpenChange={(open) => !open && setCopyTargets([])}
            onSuccess={() => {
              clearSelection()
              void invalidateList()
            }}
          />
        ) : null}
      </div>
    </TooltipProvider>
  )
}
