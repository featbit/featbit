import { ArrowLeft, Check, Copy, Plus, Search, Star } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { memberResourceName, type TeamMember } from "../index/team-api"
import {
  addMemberToGroups,
  addPoliciesToMember,
  fetchAvailableGroups,
  fetchAvailablePolicies,
  fetchMemberDetail,
  fetchMemberDirectPolicies,
  fetchMemberGroups,
  fetchMemberInheritedPolicies,
  removeMemberFromGroup,
  removeMemberFromOrganization,
  removePolicyFromMember,
  type MemberDetailGroup,
  type MemberDirectPolicy,
  type MemberInheritedPolicy,
  type RelationshipOption,
} from "./details-api"
import { getDetailsTranslations } from "./details-translations"
import { DetailsDataTable } from "./details-data-table"
import { DetailsPagination } from "./details-pagination"
import {
  RemoveRelationshipDialog,
  type RemoveDialogTarget,
} from "./remove-relationship-dialog"
import { RelationshipPickerSheet } from "./relationship-picker-sheet"

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
  const copy = useMemo(() => getDetailsTranslations(lang), [lang])
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

  const memberName = member?.name || member?.email || copy.noName
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
        header: copy.name,
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
                          toast.success(copy.copied)
                        }}
                      />
                    }
                  >
                    <Copy className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>{copy.copyResourceName}</TooltipContent>
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
        header: copy.description,
        size: 500,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.description || "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: copy.actions,
        size: 220,
        cell: ({ row }) => (
          <RowActions
            detailsHref={localizedPath(
              lang,
              `/iam/groups/${encodeURIComponent(row.original.id)}/team`
            )}
            detailsLabel={copy.details}
            removeLabel={copy.remove}
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
    [copy, lang]
  )

  const directPolicyColumns = useMemo<ColumnDef<MemberDirectPolicy>[]>(
    () => [
      {
        accessorKey: "name",
        header: copy.name,
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
                          toast.success(copy.copied)
                        }}
                      />
                    }
                  >
                    <Copy className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>{copy.copyResourceName}</TooltipContent>
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
        header: copy.type,
        size: 180,
        cell: ({ row }) => {
          const typeLabel =
            row.original.type === "SysManaged"
              ? copy.systemManaged
              : row.original.type === "CustomerManaged"
                ? copy.customerManaged
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
        header: copy.description,
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
        header: copy.actions,
        size: 200,
        cell: ({ row }) => (
          <RowActions
            detailsHref={localizedPath(
              lang,
              `/iam/policies/${encodeURIComponent(row.original.id)}/permission`
            )}
            detailsLabel={copy.details}
            removeLabel={copy.remove}
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
    [copy, lang]
  )

  const inheritedPolicyColumns = useMemo<ColumnDef<MemberInheritedPolicy>[]>(
    () => [
      {
        accessorKey: "name",
        header: copy.name,
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
                          toast.success(copy.copied)
                        }}
                      />
                    }
                  >
                    <Copy className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>{copy.copyResourceName}</TooltipContent>
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
        header: copy.group,
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
        header: copy.type,
        size: 180,
        cell: ({ row }) => {
          const typeLabel =
            row.original.type === "SysManaged"
              ? copy.systemManaged
              : row.original.type === "CustomerManaged"
                ? copy.customerManaged
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
        header: copy.description,
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
        header: copy.actions,
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
            {copy.details}
          </Link>
        ),
      },
    ],
    [copy, lang]
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
      toast.success(copy.operationSucceeded)
      setGroupSheetOpen(false)
      loadRelationships()
      loadCounts()
    } catch {
      toast.error(copy.operationFailed)
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
      toast.success(copy.operationSucceeded)
      setPolicySheetOpen(false)
      loadRelationships()
      loadCounts()
    } catch {
      toast.error(copy.operationFailed)
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

      toast.success(copy.operationSucceeded)
      setRemoveTarget(null)
      if (removeTarget.kind === "member") {
        navigate(localizedPath(lang, "/iam/team"))
      } else {
        loadRelationships()
        loadCounts()
      }
    } catch {
      toast.error(copy.operationFailed)
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
    ? copy.noSearchResults
    : activeTab === "groups"
      ? copy.groupsEmpty
      : activeTab === "direct-policies"
        ? copy.directPoliciesEmpty
        : copy.inheritedPoliciesEmpty
  const emptyAction = hasSearch
    ? { label: copy.clearSearch, onClick: () => setSearch("") }
    : activeTab === "groups"
      ? { label: copy.addToGroup, onClick: () => setGroupSheetOpen(true) }
      : activeTab === "direct-policies"
        ? { label: copy.addPolicy, onClick: () => setPolicySheetOpen(true) }
        : undefined

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <Link
          to={localizedPath(lang, "/iam/team")}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {copy.team}
        </Link>

        {memberError ? (
          <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {copy.loadingFailed}
            <Button variant="outline" size="sm" onClick={loadMember}>
              {copy.retry}
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
                <div className="mt-3 inline-flex h-8 max-w-full items-stretch overflow-hidden rounded-lg border border-input/60 bg-background">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="flex w-10 shrink-0 cursor-default items-center justify-center border-r border-input/60 bg-muted/20 text-xs font-medium text-muted-foreground" />
                      }
                    >
                      RN
                    </TooltipTrigger>
                    <TooltipContent>{copy.resourceName}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <code className="max-w-[360px] min-w-0 truncate px-3 py-1.5 font-mono text-xs font-normal text-foreground" />
                      }
                    >
                      {resourceName}
                    </TooltipTrigger>
                    <TooltipContent>{resourceName}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="h-full w-9 shrink-0 rounded-none border-0 border-l border-input/60 hover:bg-muted/40"
                          aria-label={copy.copyResourceName}
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
                      {resourceNameCopied ? copy.copied : copy.copyResourceName}
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
              {copy.removeMember}
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
            <Tab value="groups" label={copy.groups} count={counts.groups} />
            <Tab
              value="direct-policies"
              label={copy.directPolicies}
              count={counts.direct}
            />
            <Tab
              value="inherited-policies"
              label={copy.inheritedPolicies}
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
                activeTab === "groups" ? copy.filterGroups : copy.filterPolicies
              }
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {activeTab === "groups" ? (
            <Button type="button" onClick={() => setGroupSheetOpen(true)}>
              <Plus className="size-4" />
              {copy.addToGroup}
            </Button>
          ) : activeTab === "direct-policies" ? (
            <Button type="button" onClick={() => setPolicySheetOpen(true)}>
              <Plus className="size-4" />
              {copy.addPolicy}
            </Button>
          ) : null}
        </div>

        {relationshipError ? (
          <div className="mb-3 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {copy.relationshipLoadFailed}
            <Button variant="outline" size="sm" onClick={loadRelationships}>
              {copy.retry}
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
            copy.showing(
              first,
              last,
              total,
              activeTab === "groups" ? copy.groupsNoun : copy.policiesNoun
            )
          }
          perPage={copy.perPage}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPageIndex(1)
          }}
        />

        {groupSheetOpen ? (
          <RelationshipPickerSheet
            open={groupSheetOpen}
            title={copy.addGroupsTitle(memberName)}
            kind="groups"
            copy={copy}
            saving={savingSheet}
            loadOptions={loadGroupOptions}
            onOpenChange={setGroupSheetOpen}
            onSubmit={addGroups}
          />
        ) : null}

        {policySheetOpen ? (
          <RelationshipPickerSheet
            open={policySheetOpen}
            title={copy.addPoliciesTitle(memberName)}
            kind="policies"
            copy={copy}
            saving={savingSheet}
            loadOptions={loadPolicyOptions}
            onOpenChange={setPolicySheetOpen}
            onSubmit={addPolicies}
          />
        ) : null}

        <RemoveRelationshipDialog
          target={removeTarget}
          saving={removing}
          copy={copy}
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
