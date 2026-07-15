import { ArrowLeft, Check, Copy, Plus, Search, Star } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getStoredUserProfile } from "@/features/auth/auth-api"
import { localizedPath, resolveLang } from "@/features/layout/layout-context"
import { cn } from "@/lib/utils"
import {
  addMemberToGroups,
  addPoliciesToMember,
  fetchAvailableGroups,
  fetchAvailablePolicies,
  fetchMemberDetail,
  fetchMemberDirectPolicies,
  fetchMemberGroups,
  fetchMemberInheritedPolicies,
  memberResourceName,
  removeMemberFromGroup,
  removeMemberFromOrganization,
  removePolicyFromMember,
  type MemberDetailGroup,
  type MemberDirectPolicy,
  type MemberInheritedPolicy,
  type RelationshipOption,
  type TeamMember,
} from "../team-api"
import { DetailsDataTable } from "./components/details-data-table"
import { DetailsPagination } from "./components/details-pagination"
import {
  RemoveRelationshipDialog,
  type RemoveDialogTarget,
} from "./components/remove-relationship-dialog"
import { RelationshipPickerSheet } from "./components/relationship-picker-sheet"

type DetailTab = "groups" | "direct-policies" | "inherited-policies"

const validTabs = new Set<DetailTab>([
  "groups",
  "direct-policies",
  "inherited-policies",
])

const emptyGroups = { totalCount: 0, items: [] as MemberDetailGroup[] }
const emptyDirectPolicies = {
  totalCount: 0,
  items: [] as MemberDirectPolicy[],
}
const emptyInheritedPolicies = {
  totalCount: 0,
  items: [] as MemberInheritedPolicy[],
}

export function TeamDetailsPage() {
  const params = useParams()
  const navigate = useNavigate()
  const lang = resolveLang(params.lang)
  const { t } = useTranslation()
  const memberId = params.memberId ?? ""
  const requestedTab = params.tab as DetailTab | undefined
  const activeTab =
    requestedTab && validTabs.has(requestedTab) ? requestedTab : "groups"
  const profile = useMemo(() => getStoredUserProfile(), [])

  const [member, setMember] = useState<TeamMember | null>(null)
  const [memberLoading, setMemberLoading] = useState(true)
  const [memberError, setMemberError] = useState(false)
  const [resourceNameCopied, setResourceNameCopied] = useState(false)
  const copyFeedbackTimeoutRef = useRef<number | null>(null)
  const [counts, setCounts] = useState({ groups: 0, direct: 0, inherited: 0 })
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [groups, setGroups] = useState(emptyGroups)
  const [directPolicies, setDirectPolicies] = useState(emptyDirectPolicies)
  const [inheritedPolicies, setInheritedPolicies] = useState(
    emptyInheritedPolicies
  )
  const [relationshipLoading, setRelationshipLoading] = useState(true)
  const [relationshipError, setRelationshipError] = useState(false)
  const [groupSheetOpen, setGroupSheetOpen] = useState(false)
  const [policySheetOpen, setPolicySheetOpen] = useState(false)
  const [savingSheet, setSavingSheet] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<RemoveDialogTarget>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (!requestedTab || !validTabs.has(requestedTab)) {
      navigate(localizedPath(lang, `/iam/team/${memberId}/groups`), {
        replace: true,
      })
    }
  }, [lang, memberId, navigate, requestedTab])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPageIndex(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const loadMember = useCallback(() => {
    if (!memberId) return
    setMemberLoading(true)
    setMemberError(false)
    fetchMemberDetail(memberId)
      .then(setMember)
      .catch(() => setMemberError(true))
      .finally(() => setMemberLoading(false))
  }, [memberId])

  const loadCounts = useCallback(() => {
    if (!memberId) return
    Promise.all([
      fetchMemberGroups(memberId, { name: "", pageIndex: 0, pageSize: 1 }),
      fetchMemberDirectPolicies(memberId, {
        name: "",
        pageIndex: 0,
        pageSize: 1,
      }),
      fetchMemberInheritedPolicies(memberId, {
        name: "",
        pageIndex: 0,
        pageSize: 1,
      }),
    ])
      .then(([groupResult, directResult, inheritedResult]) =>
        setCounts({
          groups: groupResult.totalCount,
          direct: directResult.totalCount,
          inherited: inheritedResult.totalCount,
        })
      )
      .catch(() => undefined)
  }, [memberId])

  const loadRelationships = useCallback(() => {
    if (!memberId) return
    setRelationshipLoading(true)
    setRelationshipError(false)

    const params = {
      name: debouncedSearch,
      pageIndex: pageIndex - 1,
      pageSize,
    }
    const request =
      activeTab === "groups"
        ? fetchMemberGroups(memberId, params).then(setGroups)
        : activeTab === "direct-policies"
          ? fetchMemberDirectPolicies(memberId, params).then(setDirectPolicies)
          : fetchMemberInheritedPolicies(memberId, params).then(
              setInheritedPolicies
            )

    request
      .catch(() => setRelationshipError(true))
      .finally(() => setRelationshipLoading(false))
  }, [activeTab, debouncedSearch, memberId, pageIndex, pageSize])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadMember()
      loadCounts()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadCounts, loadMember])

  useEffect(() => {
    const timeout = window.setTimeout(loadRelationships, 0)
    return () => window.clearTimeout(timeout)
  }, [loadRelationships])

  const memberName =
    member?.name || member?.email || t("iam.team.details.noName")
  const resourceName = member ? memberResourceName(member) : ""
  const isCurrentUser = member?.email === profile.email

  const copyResourceName = useCallback(async () => {
    if (!resourceName) return
    await navigator.clipboard.writeText(resourceName)
    setResourceNameCopied(true)
    if (copyFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(copyFeedbackTimeoutRef.current)
    }
    copyFeedbackTimeoutRef.current = window.setTimeout(() => {
      setResourceNameCopied(false)
      copyFeedbackTimeoutRef.current = null
    }, 1500)
  }, [resourceName])

  useEffect(
    () => () => {
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current)
      }
    },
    []
  )

  const groupColumns = useMemo<ColumnDef<MemberDetailGroup>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("iam.team.details.name"),
        size: 320,
        cell: ({ row }) => {
          const resourceName = `group/${row.original.name}`
          return (
            <div className="min-w-0 space-y-1">
              <Link
                to={localizedPath(
                  lang,
                  `/iam/groups/${encodeURIComponent(row.original.id)}/team`
                )}
                target="_blank"
                className="block truncate font-semibold text-foreground hover:underline"
              >
                {row.original.name}
              </Link>
              <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="size-5 shrink-0 text-muted-foreground"
                        onClick={async () => {
                          await navigator.clipboard.writeText(resourceName)
                          toast.success(t("iam.team.details.copied"))
                        }}
                      />
                    }
                  >
                    <Copy className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("iam.team.details.copyResourceName")}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="block min-w-0 truncate font-mono text-[0.72rem]" />
                    }
                  >
                    {resourceName}
                  </TooltipTrigger>
                  <TooltipContent>{resourceName}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "description",
        header: t("iam.team.details.description"),
        size: 500,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.description || "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("iam.team.details.actions"),
        size: 220,
        cell: ({ row }) => (
          <RowActions
            detailsHref={localizedPath(
              lang,
              `/iam/groups/${encodeURIComponent(row.original.id)}/team`
            )}
            detailsLabel={t("iam.team.details.details")}
            removeLabel={t("iam.team.details.remove")}
            onRemove={() =>
              setRemoveTarget({
                kind: "group",
                id: row.original.id,
                name: row.original.name,
              })
            }
          />
        ),
      },
    ],
    [lang, t]
  )

  const directPolicyColumns = useMemo<ColumnDef<MemberDirectPolicy>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("iam.team.details.name"),
        size: 300,
        cell: ({ row }) => {
          const resourceName = `policy/${row.original.key || row.original.id}`
          return (
            <div className="min-w-0 space-y-1">
              <Link
                to={localizedPath(
                  lang,
                  `/iam/policies/${encodeURIComponent(row.original.id)}/permission`
                )}
                target="_blank"
                className="block truncate font-semibold text-foreground hover:underline"
              >
                {row.original.name}
              </Link>
              <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="size-5 shrink-0 text-muted-foreground"
                        onClick={async () => {
                          await navigator.clipboard.writeText(resourceName)
                          toast.success(t("iam.team.details.copied"))
                        }}
                      />
                    }
                  >
                    <Copy className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("iam.team.details.copyResourceName")}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="block min-w-0 truncate font-mono text-[0.72rem]" />
                    }
                  >
                    {resourceName}
                  </TooltipTrigger>
                  <TooltipContent>{resourceName}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "type",
        header: t("iam.team.details.type"),
        size: 180,
        cell: ({ row }) => {
          const typeLabel =
            row.original.type === "SysManaged"
              ? t("iam.team.details.systemManaged")
              : row.original.type === "CustomerManaged"
                ? t("iam.team.details.customerManaged")
                : "-"
          return (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              {row.original.type === "SysManaged" ? (
                <Star className="size-3.5 text-muted-foreground" />
              ) : null}
              {typeLabel}
            </span>
          )
        },
      },
      {
        accessorKey: "description",
        header: t("iam.team.details.description"),
        size: 420,
        cell: ({ row }) => {
          const description = row.original.description || "-"
          return (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="block min-w-0 truncate text-muted-foreground" />
                }
              >
                {description}
              </TooltipTrigger>
              {row.original.description ? (
                <TooltipContent className="max-w-80">
                  {row.original.description}
                </TooltipContent>
              ) : null}
            </Tooltip>
          )
        },
      },
      {
        id: "actions",
        header: t("iam.team.details.actions"),
        size: 200,
        cell: ({ row }) => (
          <RowActions
            detailsHref={localizedPath(
              lang,
              `/iam/policies/${encodeURIComponent(row.original.id)}/permission`
            )}
            detailsLabel={t("iam.team.details.details")}
            removeLabel={t("iam.team.details.remove")}
            onRemove={() =>
              setRemoveTarget({
                kind: "policy",
                id: row.original.id,
                name: row.original.name,
              })
            }
          />
        ),
      },
    ],
    [lang, t]
  )

  const inheritedPolicyColumns = useMemo<ColumnDef<MemberInheritedPolicy>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("iam.team.details.name"),
        size: 280,
        cell: ({ row }) => {
          const resourceName = `policy/${row.original.key || row.original.id}`
          return (
            <div className="min-w-0 space-y-1">
              <Link
                to={localizedPath(
                  lang,
                  `/iam/policies/${encodeURIComponent(row.original.id)}/permission`
                )}
                target="_blank"
                className="block truncate font-semibold text-foreground hover:underline"
              >
                {row.original.name}
              </Link>
              <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="size-5 shrink-0 text-muted-foreground"
                        onClick={async () => {
                          await navigator.clipboard.writeText(resourceName)
                          toast.success(t("iam.team.details.copied"))
                        }}
                      />
                    }
                  >
                    <Copy className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("iam.team.details.copyResourceName")}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="block min-w-0 truncate font-mono text-[0.72rem]" />
                    }
                  >
                    {resourceName}
                  </TooltipTrigger>
                  <TooltipContent>{resourceName}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "groupName",
        header: t("iam.team.details.group"),
        size: 180,
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger
              render={<span className="block min-w-0 truncate" />}
            >
              {row.original.groupName}
            </TooltipTrigger>
            <TooltipContent>{row.original.groupName}</TooltipContent>
          </Tooltip>
        ),
      },
      {
        accessorKey: "type",
        header: t("iam.team.details.type"),
        size: 180,
        cell: ({ row }) => {
          const typeLabel =
            row.original.type === "SysManaged"
              ? t("iam.team.details.systemManaged")
              : row.original.type === "CustomerManaged"
                ? t("iam.team.details.customerManaged")
                : "-"
          return (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              {row.original.type === "SysManaged" ? (
                <Star className="size-3.5 text-muted-foreground" />
              ) : null}
              {typeLabel}
            </span>
          )
        },
      },
      {
        accessorKey: "description",
        header: t("iam.team.details.description"),
        size: 380,
        cell: ({ row }) => {
          const description = row.original.description || "-"
          return (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="block min-w-0 truncate text-muted-foreground" />
                }
              >
                {description}
              </TooltipTrigger>
              {row.original.description ? (
                <TooltipContent className="max-w-80">
                  {row.original.description}
                </TooltipContent>
              ) : null}
            </Tooltip>
          )
        },
      },
      {
        id: "actions",
        header: t("iam.team.details.actions"),
        size: 160,
        cell: ({ row }) => (
          <Link
            to={localizedPath(
              lang,
              `/iam/policies/${encodeURIComponent(row.original.id)}/permission`
            )}
            target="_blank"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "font-medium whitespace-nowrap"
            )}
          >
            {t("iam.team.details.details")}
          </Link>
        ),
      },
    ],
    [lang, t]
  )

  const loadGroupOptions = useCallback(
    (query: string, nextPage: number) =>
      fetchAvailableGroups(memberId, query, nextPage),
    [memberId]
  )
  const loadPolicyOptions = useCallback(
    (query: string, nextPage: number) =>
      fetchAvailablePolicies(memberId, query, nextPage),
    [memberId]
  )

  async function addGroups(selected: RelationshipOption[]) {
    setSavingSheet(true)
    try {
      await addMemberToGroups(
        memberId,
        selected.map((item) => item.id)
      )
      toast.success(t("iam.team.details.operationSucceeded"))
      setGroupSheetOpen(false)
      loadRelationships()
      loadCounts()
    } catch {
      toast.error(t("iam.team.details.operationFailed"))
    } finally {
      setSavingSheet(false)
    }
  }

  async function addPolicies(selected: RelationshipOption[]) {
    setSavingSheet(true)
    try {
      await addPoliciesToMember(
        memberId,
        selected.map((item) => item.id)
      )
      toast.success(t("iam.team.details.operationSucceeded"))
      setPolicySheetOpen(false)
      loadRelationships()
      loadCounts()
    } catch {
      toast.error(t("iam.team.details.operationFailed"))
    } finally {
      setSavingSheet(false)
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return
    setRemoving(true)
    try {
      if (removeTarget.kind === "group") {
        await removeMemberFromGroup(memberId, removeTarget.id)
      } else if (removeTarget.kind === "policy") {
        await removePolicyFromMember(memberId, removeTarget.id)
      } else {
        await removeMemberFromOrganization(memberId)
      }

      toast.success(t("iam.team.details.operationSucceeded"))
      setRemoveTarget(null)
      if (removeTarget.kind === "member") {
        navigate(localizedPath(lang, "/iam/team"))
      } else {
        loadRelationships()
        loadCounts()
      }
    } catch {
      toast.error(t("iam.team.details.operationFailed"))
    } finally {
      setRemoving(false)
    }
  }

  const activeData =
    activeTab === "groups"
      ? groups
      : activeTab === "direct-policies"
        ? directPolicies
        : inheritedPolicies
  const hasSearch = Boolean(debouncedSearch)
  const emptyMessage = hasSearch
    ? t("iam.team.details.noSearchResults")
    : activeTab === "groups"
      ? t("iam.team.details.groupsEmpty")
      : activeTab === "direct-policies"
        ? t("iam.team.details.directPoliciesEmpty")
        : t("iam.team.details.inheritedPoliciesEmpty")
  const emptyAction = hasSearch
    ? { label: t("iam.team.details.clearSearch"), onClick: () => setSearch("") }
    : activeTab === "groups"
      ? {
          label: t("iam.team.details.addToGroups"),
          onClick: () => setGroupSheetOpen(true),
        }
      : activeTab === "direct-policies"
        ? {
            label: t("iam.team.details.addPolicy"),
            onClick: () => setPolicySheetOpen(true),
          }
        : undefined

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <Link
          to={localizedPath(lang, "/iam/team")}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("iam.team.details.team")}
        </Link>

        {memberError ? (
          <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {t("iam.team.details.loadingFailed")}
            <Button variant="outline" size="sm" onClick={loadMember}>
              {t("iam.team.details.retry")}
            </Button>
          </div>
        ) : (
          <header className="flex min-h-28 items-start justify-between gap-6">
            {memberLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-7 w-96" />
              </div>
            ) : (
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-normal">
                  {memberName}
                </h1>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {member?.email}
                </p>
                <div className="mt-3 inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-md bg-muted/60 pr-0.5 pl-2">
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    RN
                  </span>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <code
                          tabIndex={0}
                          className="max-w-[360px] min-w-0 truncate rounded-sm px-1 font-mono text-xs leading-5 font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        />
                      }
                    >
                      {resourceName}
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[min(28rem,calc(100vw-2rem))] font-mono break-all">
                      {resourceName}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-7 shrink-0 text-muted-foreground hover:bg-background/80 hover:text-foreground"
                          aria-label={t("iam.team.details.copyResourceName")}
                          onClick={copyResourceName}
                        />
                      }
                    >
                      {resourceNameCopied ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </TooltipTrigger>
                    <TooltipContent>
                      {resourceNameCopied
                        ? t("iam.team.details.copied")
                        : t("iam.team.details.copyResourceName")}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              className="border-destructive/50 text-destructive hover:bg-destructive/5 hover:text-destructive"
              disabled={!member || isCurrentUser}
              onClick={() =>
                member &&
                setRemoveTarget({
                  kind: "member",
                  id: member.id,
                  name: memberName,
                })
              }
            >
              {t("iam.team.details.removeMember")}
            </Button>
          </header>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setSearch("")
            setDebouncedSearch("")
            setPageIndex(1)
            navigate(
              localizedPath(lang, `/iam/team/${memberId}/${value as DetailTab}`)
            )
          }}
          className="gap-0"
        >
          <TabsList
            variant="line"
            className="h-10 w-full justify-start gap-7 border-b p-0"
          >
            <Tab
              value="groups"
              label={t("iam.team.details.groups")}
              count={counts.groups}
            />
            <Tab
              value="direct-policies"
              label={t("iam.team.details.directPolicies")}
              count={counts.direct}
            />
            <Tab
              value="inherited-policies"
              label={t("iam.team.details.inheritedPolicies")}
              count={counts.inherited}
            />
          </TabsList>
        </Tabs>

        <div className="flex items-center justify-between gap-4 py-5">
          <div className="relative w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              placeholder={
                activeTab === "groups"
                  ? t("iam.team.details.filterGroups")
                  : t("iam.team.details.filterPolicies")
              }
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {activeTab === "groups" ? (
            <Button type="button" onClick={() => setGroupSheetOpen(true)}>
              <Plus className="size-4" />
              {t("iam.team.details.addToGroups")}
            </Button>
          ) : activeTab === "direct-policies" ? (
            <Button type="button" onClick={() => setPolicySheetOpen(true)}>
              <Plus className="size-4" />
              {t("iam.team.details.addPolicy")}
            </Button>
          ) : null}
        </div>

        {relationshipError ? (
          <div className="mb-3 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {t("iam.team.details.relationshipLoadFailed")}
            <Button variant="outline" size="sm" onClick={loadRelationships}>
              {t("iam.team.details.retry")}
            </Button>
          </div>
        ) : null}

        {activeTab === "groups" ? (
          <DetailsDataTable
            data={groups.items}
            columns={groupColumns}
            loading={relationshipLoading}
            emptyMessage={emptyMessage}
            emptyAction={emptyAction}
          />
        ) : activeTab === "direct-policies" ? (
          <DetailsDataTable
            data={directPolicies.items}
            columns={directPolicyColumns}
            loading={relationshipLoading}
            emptyMessage={emptyMessage}
            emptyAction={emptyAction}
          />
        ) : (
          <DetailsDataTable
            data={inheritedPolicies.items}
            columns={inheritedPolicyColumns}
            loading={relationshipLoading}
            emptyMessage={emptyMessage}
          />
        )}

        <DetailsPagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={activeData.totalCount}
          summary={(first, last, total) =>
            t("iam.team.details.showing", {
              first,
              last,
              total,
              noun:
                activeTab === "groups"
                  ? t("iam.team.details.groupsNoun")
                  : t("iam.team.details.policiesNoun"),
            })
          }
          perPage={(count) => t("iam.team.details.perPage", { count })}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPageIndex(1)
          }}
        />

        {groupSheetOpen ? (
          <RelationshipPickerSheet
            open={groupSheetOpen}
            title={t("iam.team.details.addGroupsTitle", { name: memberName })}
            kind="groups"
            saving={savingSheet}
            loadOptions={loadGroupOptions}
            onOpenChange={setGroupSheetOpen}
            onSubmit={addGroups}
          />
        ) : null}

        {policySheetOpen ? (
          <RelationshipPickerSheet
            open={policySheetOpen}
            title={t("iam.team.details.addPoliciesTitle", {
              name: memberName,
            })}
            kind="policies"
            saving={savingSheet}
            loadOptions={loadPolicyOptions}
            onOpenChange={setPolicySheetOpen}
            onSubmit={addPolicies}
          />
        ) : null}

        <RemoveRelationshipDialog
          target={removeTarget}
          saving={removing}
          onOpenChange={(open) => {
            if (!open) setRemoveTarget(null)
          }}
          onConfirm={confirmRemove}
        />
      </div>
    </TooltipProvider>
  )
}

function Tab({
  value,
  label,
  count,
}: {
  value: DetailTab
  label: string
  count: number
}) {
  return (
    <TabsTrigger value={value} className="h-10 flex-none gap-2 px-4">
      {label}
      <Badge variant="secondary" className="rounded-full px-1.5 font-normal">
        {count}
      </Badge>
    </TabsTrigger>
  )
}

function RowActions({
  detailsHref,
  detailsLabel,
  removeLabel,
  onRemove,
}: {
  detailsHref: string
  detailsLabel: string
  removeLabel: string
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <Link
        to={detailsHref}
        target="_blank"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "font-medium"
        )}
      >
        {detailsLabel}
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/5 hover:text-destructive"
        onClick={onRemove}
      >
        {removeLabel}
      </Button>
    </div>
  )
}
