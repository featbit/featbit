import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { KeyRound, Plus, Search, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TooltipProvider } from "@/components/ui/tooltip"
import { currentUserPoliciesQueryOptions } from "@/features/iam/current-user-policy-query"
import {
  getCurrentOrganization,
  getCurrentWorkspace,
  resolveLang,
} from "@/features/layout/layout-context"
import {
  getLicenseStatus,
  isFeatureGranted,
  parseLicense,
} from "@/features/workspace/license/license-utils"
import {
  fetchAccessTokens,
  removeAccessToken,
  toggleAccessTokenStatus,
} from "./access-tokens-api"
import {
  canListAccessTokens,
  canManageAccessTokenType,
} from "./access-token-permissions"
import type {
  AccessToken,
  AccessTokenCreator,
  AccessTokenSheetMode,
  AccessTokenType,
  PagedAccessTokens,
  UserPolicy,
} from "./access-token-types"
import {
  AccessTokenConfirmDialog,
  AccessTokenCreatedDialog,
  type AccessTokenConfirmTarget,
} from "./components/access-token-dialogs"
import { AccessTokenPagination } from "./components/access-token-pagination"
import { AccessTokenSheet } from "./components/access-token-sheet"
import { AccessTokenTable } from "./components/access-token-table"
import { CreatorFilter } from "./components/creator-filter"

type SheetState = {
  mode: AccessTokenSheetMode
  token: AccessToken | null
} | null

export function AccessTokensPage() {
  const { t } = useTranslation()
  const params = useParams()
  const lang = resolveLang(params.lang)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [creator, setCreator] = useState<AccessTokenCreator | null>(null)
  const [typeFilter, setTypeFilter] = useState<AccessTokenType | "">("")
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [confirmTarget, setConfirmTarget] =
    useState<AccessTokenConfirmTarget>(null)
  const [createdResult, setCreatedResult] = useState<{
    name: string
    token: string
  } | null>(null)
  const workspace = getCurrentWorkspace()
  const organizationId = getCurrentOrganization()?.id ?? ""

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPageIndex(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const permissionsQuery = useQuery({
    ...currentUserPoliciesQueryOptions<UserPolicy>(organizationId),
    staleTime: 5 * 60_000,
  })
  const policies = permissionsQuery.data ?? []
  const canList = permissionsQuery.isSuccess && canListAccessTokens(policies)
  const canManagePersonal = canManageAccessTokenType(policies, "Personal")
  const canManageService = canManageAccessTokenType(policies, "Service")
  const canCreate = canManagePersonal || canManageService

  const fineGrainedGranted = useMemo(() => {
    const license = parseLicense(workspace?.license)
    return isFeatureGranted(
      {
        id: "fine-grained-ac",
        labelKey: "workspace.license.features.fineGrainedAccessControl.title",
        descriptionKey:
          "workspace.license.features.fineGrainedAccessControl.description",
      },
      license,
      getLicenseStatus(license)
    )
  }, [workspace?.license])

  const accessTokensQuery = useQuery({
    queryKey: [
      "access-tokens",
      workspace?.id ?? "",
      debouncedSearch,
      creator?.id ?? "",
      typeFilter,
      pageIndex,
      pageSize,
    ],
    queryFn: () =>
      fetchAccessTokens({
        name: debouncedSearch,
        creatorId: creator?.id ?? "",
        type: typeFilter,
        pageIndex: pageIndex - 1,
        pageSize,
      }),
    enabled: canList,
  })
  const accessTokens = accessTokensQuery.data ?? {
    totalCount: 0,
    items: [],
  }

  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["access-tokens"] }),
    [queryClient]
  )

  const toggleMutation = useMutation({
    mutationFn: (token: AccessToken) => toggleAccessTokenStatus(token.id),
    onSuccess: (_, token) => {
      toast.success(t("accessTokens.operationSucceeded"))
      setConfirmTarget((current) =>
        current?.token.id === token.id ? null : current
      )
      void invalidateList()
    },
    onError: () => toast.error(t("accessTokens.operationFailed")),
  })

  const removeMutation = useMutation({
    mutationFn: (token: AccessToken) => removeAccessToken(token.id),
    onSuccess: (_, token) => {
      toast.success(t("accessTokens.operationSucceeded"))
      setConfirmTarget((current) =>
        current?.token.id === token.id ? null : current
      )
      if (accessTokens.items.length === 1 && pageIndex > 1) {
        setPageIndex(pageIndex - 1)
      }
      void invalidateList()
    },
    onError: () => toast.error(t("accessTokens.operationFailed")),
  })

  const isManageable = useCallback(
    (token: AccessToken) =>
      token.type === "Personal" ? canManagePersonal : canManageService,
    [canManagePersonal, canManageService]
  )

  function clearFilters() {
    setSearch("")
    setDebouncedSearch("")
    setCreator(null)
    setTypeFilter("")
    setPageIndex(1)
  }

  function openNewSheet() {
    setSheet({ mode: "new", token: null })
  }

  const hasFilters = Boolean(debouncedSearch || creator || typeFilter)
  const emptyAction = hasFilters
    ? { label: t("accessTokens.clearFilters"), onClick: clearFilters }
    : canCreate
      ? { label: t("accessTokens.newToken"), onClick: openNewSheet }
      : undefined
  const mutatingId =
    (toggleMutation.isPending ? toggleMutation.variables?.id : null) ??
    (removeMutation.isPending ? removeMutation.variables?.id : null) ??
    null

  if (permissionsQuery.isLoading) {
    return (
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="mt-3 h-4 w-96" />
        <Skeleton className="mt-10 h-96 w-full" />
      </div>
    )
  }

  if (permissionsQuery.isError || !canList) {
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-8">
        <div className="max-w-md text-center">
          <KeyRound className="mx-auto mb-4 size-8 text-muted-foreground" />
          <h1 className="text-xl font-semibold">
            {t("accessTokens.unavailableTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("accessTokens.unavailableDescription")}
          </p>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <header className="mb-10 space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">
            {t("accessTokens.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("accessTokens.subtitle")}
          </p>
        </header>

        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative w-80">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                placeholder={t("accessTokens.filterByName")}
                className="pl-9"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <CreatorFilter
              value={creator}
              onChange={(nextCreator) => {
                setCreator(nextCreator)
                setPageIndex(1)
              }}
            />

            <div className="flex items-center gap-1">
              <Select
                value={typeFilter || null}
                onValueChange={(value: AccessTokenType | null) => {
                  setTypeFilter(value ?? "")
                  setPageIndex(1)
                }}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder={t("accessTokens.type")} />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    <SelectItem value="Personal">
                      {t("accessTokens.types.Personal")}
                    </SelectItem>
                    <SelectItem value="Service">
                      {t("accessTokens.types.Service")}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {typeFilter ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("accessTokens.actions.clearType")}
                  onClick={() => {
                    setTypeFilter("")
                    setPageIndex(1)
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              ) : null}
            </div>
          </div>

          {canCreate ? (
            <Button type="button" onClick={openNewSheet}>
              <Plus className="size-4" />
              {t("accessTokens.newToken")}
            </Button>
          ) : null}
        </div>

        {accessTokensQuery.isError ? (
          <div className="mb-3 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {t("accessTokens.loadFailed")}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void accessTokensQuery.refetch()}
            >
              {t("accessTokens.retry")}
            </Button>
          </div>
        ) : null}

        <AccessTokenTable
          data={accessTokens.items}
          lang={lang}
          loading={accessTokensQuery.isPending}
          emptyMessage={
            hasFilters
              ? t("accessTokens.filteredEmpty")
              : t("accessTokens.empty")
          }
          emptyAction={emptyAction}
          isManageable={isManageable}
          mutatingId={mutatingId}
          onEdit={(token) => setSheet({ mode: "edit", token })}
          onView={(token) => setSheet({ mode: "view", token })}
          onActivate={(token) => toggleMutation.mutate(token)}
          onDeactivate={(token) =>
            setConfirmTarget({ kind: "deactivate", token })
          }
          onRemove={(token) => setConfirmTarget({ kind: "remove", token })}
        />

        <AccessTokenPagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={accessTokens.totalCount}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPageIndex(1)
          }}
        />

        {sheet ? (
          <AccessTokenSheet
            open
            mode={sheet.mode}
            token={sheet.token}
            policies={policies}
            fineGrainedGranted={fineGrainedGranted}
            canManagePersonal={canManagePersonal}
            canManageService={canManageService}
            onOpenChange={(open) => {
              if (!open) setSheet(null)
            }}
            onCreated={(result) => {
              setSheet(null)
              setCreatedResult(result)
              void invalidateList()
            }}
            onSaved={(updatedToken) => {
              queryClient.setQueriesData<PagedAccessTokens>(
                { queryKey: ["access-tokens"] },
                (current) =>
                  current
                    ? {
                        ...current,
                        items: current.items.map((item) =>
                          item.id === updatedToken.id
                            ? {
                                ...item,
                                ...updatedToken,
                                creator: updatedToken.creator ?? item.creator,
                              }
                            : item
                        ),
                      }
                    : current
              )
              setSheet(null)
              void invalidateList()
            }}
          />
        ) : null}

        <AccessTokenConfirmDialog
          target={confirmTarget}
          saving={toggleMutation.isPending || removeMutation.isPending}
          onOpenChange={(open) => {
            if (!open) setConfirmTarget(null)
          }}
          onConfirm={() => {
            if (!confirmTarget) return
            if (confirmTarget.kind === "remove") {
              removeMutation.mutate(confirmTarget.token)
            } else {
              toggleMutation.mutate(confirmTarget.token)
            }
          }}
        />

        <AccessTokenCreatedDialog
          result={createdResult}
          onClose={() => setCreatedResult(null)}
        />
      </div>
    </TooltipProvider>
  )
}
