import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Archive, Plus, Search } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
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
import {
  archiveSegment,
  createSegment,
  fetchCurrentEnvironmentSettings,
  fetchCurrentUserPolicies,
  fetchSegmentFlagReferences,
  fetchSegments,
  fetchSegmentScopes,
  isSegmentKeyUsed,
  removeSegment,
  restoreSegment,
} from "../segments-api"
import {
  canUseSegmentAction,
  environmentRn,
  segmentRn,
  type SegmentAction,
} from "../segments-permissions"
import type {
  ScopeResource,
  Segment,
  SegmentFlagReference,
  SegmentPayload,
  SegmentType,
} from "../segments-types"
import {
  SegmentConfirmDialog,
  SegmentReferencesDialog,
  type SegmentConfirmation,
} from "./components/segment-dialogs"
import { SegmentSheet } from "./components/segment-sheet"
import { SegmentsPagination } from "./components/segments-pagination"
import { SegmentsTable } from "./components/segments-table"

export function SegmentsPage() {
  const { t } = useTranslation()
  const { lang: langParam } = useParams()
  const lang = resolveLang(langParam)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const workspace = getCurrentWorkspace()
  const organization = getCurrentOrganization()
  const projectEnv = getCurrentProjectEnv()
  const envId = projectEnv?.envId ?? ""
  const envRn = environmentRn({
    organizationKey: organization?.key ?? "",
    projectKey: projectEnv?.projectKey ?? "",
    environmentKey: projectEnv?.envKey ?? "",
  })

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [archived, setArchived] = useState(false)
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<SegmentConfirmation>(null)
  const [referenceDialog, setReferenceDialog] = useState<{
    segmentName: string
    references: SegmentFlagReference[]
  } | null>(null)
  const [referenceLoadingId, setReferenceLoadingId] = useState<string | null>(
    null
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPageIndex(1)
    }, 400)
    return () => window.clearTimeout(timeout)
  }, [search])

  const permissionsQuery = useQuery({
    queryKey: ["segment-user-policies", workspace?.id ?? ""],
    queryFn: fetchCurrentUserPolicies,
    staleTime: 5 * 60_000,
  })
  const policies = useMemo(
    () => permissionsQuery.data ?? [],
    [permissionsQuery.data]
  )

  const settingsQuery = useQuery({
    queryKey: ["segment-environment-settings", envId],
    queryFn: () => fetchCurrentEnvironmentSettings(envId),
    enabled: Boolean(envId),
    staleTime: 5 * 60_000,
  })

  const listQuery = useQuery({
    queryKey: [
      "segments",
      envId,
      debouncedSearch,
      archived,
      pageIndex,
      pageSize,
    ],
    queryFn: () =>
      fetchSegments(envId, {
        name: debouncedSearch,
        isArchived: archived,
        pageIndex: pageIndex - 1,
        pageSize,
      }),
    enabled: Boolean(envId),
  })

  const scopesQuery = useQuery({
    queryKey: ["segment-scopes", workspace?.id ?? ""],
    queryFn: () => fetchSegmentScopes(),
    enabled: sheetOpen,
    staleTime: 5 * 60_000,
  })

  const license = useMemo(
    () => parseLicense(workspace?.license),
    [workspace?.license]
  )
  const shareableGranted = isFeatureGranted(
    {
      id: "shareable-segment",
      labelKey: "",
      descriptionKey: "",
    },
    license,
    getLicenseStatus(license)
  )

  const canPerform = useCallback(
    (segment: Segment, action: SegmentAction) =>
      permissionsQuery.isSuccess &&
      canUseSegmentAction(policies, segmentRn(envRn, segment), action),
    [envRn, permissionsQuery.isSuccess, policies]
  )
  const canCreate =
    permissionsQuery.isSuccess &&
    canUseSegmentAction(policies, `${envRn}:segment/*`, "CreateSegment")

  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["segments"] }),
    [queryClient]
  )

  const createMutation = useMutation({
    mutationFn: (payload: SegmentPayload) => createSegment(envId, payload),
    onSuccess: (segment) => {
      setSheetOpen(false)
      toast.success(t("segments.operationSucceeded"))
      void invalidateList()
      navigate(
        localizedPath(
          lang,
          `/segments/${encodeURIComponent(segment.id)}/targeting`
        )
      )
    },
    onError: () => toast.error(t("segments.create.failed")),
  })

  const actionMutation = useMutation({
    mutationFn: async ({
      target,
      comment,
    }: {
      target: NonNullable<SegmentConfirmation>
      comment: string
    }) => {
      if (target.kind === "archive") {
        return archiveSegment(envId, target.segment.id, comment)
      }
      if (target.kind === "restore") {
        return restoreSegment(envId, target.segment.id, comment)
      }
      return removeSegment(envId, target.segment.id, comment)
    },
    onSuccess: () => {
      setConfirmation(null)
      toast.success(t("segments.operationSucceeded"))
      if ((listQuery.data?.items.length ?? 0) === 1 && pageIndex > 1) {
        setPageIndex((current) => current - 1)
      }
      void invalidateList()
    },
    onError: () => toast.error(t("segments.operationFailed")),
  })

  async function startArchive(segment: Segment) {
    if (!canPerform(segment, "ArchiveSegment")) {
      toast.error(t("segments.permissionDenied"))
      return
    }
    setReferenceLoadingId(segment.id)
    try {
      const result = await fetchSegmentFlagReferences(envId, segment.id)
      if (result.length) {
        setReferenceDialog({ segmentName: segment.name, references: result })
      } else setConfirmation({ kind: "archive", segment })
    } catch {
      toast.error(t("segments.referencesLoadFailed"))
    } finally {
      setReferenceLoadingId(null)
    }
  }

  function startAction(
    kind: "restore" | "remove",
    segment: Segment,
    action: "RestoreSegment" | "DeleteSegment"
  ) {
    if (!canPerform(segment, action)) {
      toast.error(t("segments.permissionDenied"))
      return
    }
    setConfirmation({ kind, segment })
  }

  const currentScope: ScopeResource = {
    id: envId,
    name: projectEnv?.envName ?? "",
    pathName: `${organization?.name ?? ""} / ${projectEnv?.projectName ?? ""} / ${projectEnv?.envName ?? ""}`,
    rn: envRn,
    type: "env",
  }
  const data = listQuery.data ?? { items: [], totalCount: 0 }
  const mutatingId =
    referenceLoadingId ??
    (actionMutation.isPending
      ? (actionMutation.variables?.target.segment.id ?? null)
      : null)

  if (!envId) {
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-8">
        <p className="text-sm text-muted-foreground">
          {t("segments.loadFailed")}
        </p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <header className="mb-10 space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">
            {t("segments.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("segments.subtitle")}
          </p>
        </header>

        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="relative w-80">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                className="pl-9"
                placeholder={t("segments.search")}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              aria-pressed={archived}
              className={archived ? "bg-accent text-accent-foreground" : ""}
              onClick={() => {
                setArchived((current) => !current)
                setPageIndex(1)
              }}
            >
              <Archive />
              {t("segments.showArchived")}
            </Button>
          </div>

          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex" tabIndex={canCreate ? -1 : 0} />
              }
            >
              <Button
                type="button"
                disabled={!canCreate}
                onClick={() => setSheetOpen(true)}
              >
                <Plus />
                {t("segments.new")}
              </Button>
            </TooltipTrigger>
            {!canCreate ? (
              <TooltipContent>{t("segments.permissionDenied")}</TooltipContent>
            ) : null}
          </Tooltip>
        </div>

        <div className="overflow-hidden rounded-md border bg-background">
          {listQuery.isError ? (
            <div className="flex items-center justify-between border-b bg-destructive/5 px-5 py-3 text-sm text-destructive">
              {t("segments.loadFailed")}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void listQuery.refetch()}
              >
                {t("segments.retry")}
              </Button>
            </div>
          ) : null}
          {permissionsQuery.isLoading && !listQuery.data ? (
            <div className="p-5">
              <Skeleton className="h-72 w-full" />
            </div>
          ) : (
            <SegmentsTable
              items={data.items}
              loading={listQuery.isLoading}
              archived={archived}
              lang={lang}
              query={debouncedSearch}
              mutatingId={mutatingId}
              canArchive={(segment) => canPerform(segment, "ArchiveSegment")}
              canRestore={(segment) => canPerform(segment, "RestoreSegment")}
              canRemove={(segment) => canPerform(segment, "DeleteSegment")}
              onCopy={async (key) => {
                try {
                  await navigator.clipboard.writeText(key)
                  toast.success(t("segments.copied"))
                } catch {
                  toast.error(t("segments.operationFailed"))
                }
              }}
              onArchive={(segment) => void startArchive(segment)}
              onRestore={(segment) =>
                startAction("restore", segment, "RestoreSegment")
              }
              onRemove={(segment) =>
                startAction("remove", segment, "DeleteSegment")
              }
              onClearSearch={() => setSearch("")}
              onCreate={() => setSheetOpen(true)}
              canCreate={canCreate}
            />
          )}
        </div>

        <SegmentsPagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={data.totalCount}
          disabled={listQuery.isFetching}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPageIndex(1)
          }}
        />

        {sheetOpen ? (
          <SegmentSheet
            open
            currentScope={currentScope}
            resources={scopesQuery.data ?? [currentScope]}
            resourcesLoading={scopesQuery.isLoading}
            resourcesError={scopesQuery.isError}
            shareableGranted={shareableGranted}
            saving={createMutation.isPending}
            onOpenChange={setSheetOpen}
            onRetryResources={() => void scopesQuery.refetch()}
            onValidateKey={(key: string, type: SegmentType) =>
              isSegmentKeyUsed(envId, key, type)
            }
            onSubmit={(payload) =>
              createMutation.mutateAsync(payload).then(() => undefined)
            }
          />
        ) : null}

        <SegmentConfirmDialog
          key={
            confirmation
              ? `${confirmation.kind}-${confirmation.segment.id}`
              : "closed"
          }
          target={confirmation}
          requireComment={settingsQuery.data?.requireChangeComment ?? false}
          saving={actionMutation.isPending}
          onOpenChange={(open) => !open && setConfirmation(null)}
          onConfirm={(comment) => {
            if (confirmation) {
              actionMutation.mutate({ target: confirmation, comment })
            }
          }}
        />

        <SegmentReferencesDialog
          references={referenceDialog?.references ?? null}
          segmentName={referenceDialog?.segmentName ?? ""}
          envId={envId}
          lang={lang}
          onClose={() => setReferenceDialog(null)}
        />
      </div>
    </TooltipProvider>
  )
}
