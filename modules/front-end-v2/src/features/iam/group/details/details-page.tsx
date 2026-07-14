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
import { localizedPath, resolveLang } from "@/features/layout/layout-context"
import { cn } from "@/lib/utils"
import { GroupDataTable } from "../components/data-table"
import { GroupPagination } from "../components/pagination"
import { RelationshipPickerSheet } from "../components/relationship-picker-sheet"
import { RemoveDialog } from "../components/remove-dialog"
import {
  addMembersToGroup,
  addPoliciesToGroup,
  deleteGroup,
  fetchAvailableMembers,
  fetchAvailablePolicies,
  fetchGroup,
  fetchGroupMembers,
  fetchGroupPolicies,
  groupResourceName,
  memberResourceName,
  policyResourceName,
  removeMemberFromGroup,
  removePolicyFromGroup,
  type Group,
  type GroupMember,
  type GroupPolicy,
  type RelationshipOption,
} from "../group-api"
import { getGroupTranslations } from "../group-translations"

type DetailTab = "team" | "policies"
type RemoveTarget = {
  kind: "group" | "member" | "policy"
  id: string
  name: string
} | null

const validTabs = new Set<DetailTab>(["team", "policies"])
const emptyMembers = { totalCount: 0, items: [] as GroupMember[] }
const emptyPolicies = { totalCount: 0, items: [] as GroupPolicy[] }

export function GroupDetailsPage() {
  const params = useParams()
  const navigate = useNavigate()
  const lang = resolveLang(params.lang)
  const copy = useMemo(() => getGroupTranslations(lang), [lang])
  const groupId = params.groupId ?? ""
  const requestedTab = params.tab as DetailTab | undefined
  const activeTab =
    requestedTab && validTabs.has(requestedTab) ? requestedTab : "team"

  const [group, setGroup] = useState<Group | null>(null)
  const [groupLoading, setGroupLoading] = useState(true)
  const [groupError, setGroupError] = useState(false)
  const [resourceCopied, setResourceCopied] = useState(false)
  const copyTimeoutRef = useRef<number | null>(null)
  const [counts, setCounts] = useState({ team: 0, policies: 0 })
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [members, setMembers] = useState(emptyMembers)
  const [policies, setPolicies] = useState(emptyPolicies)
  const [relationshipLoading, setRelationshipLoading] = useState(true)
  const [relationshipError, setRelationshipError] = useState(false)
  const [memberSheetOpen, setMemberSheetOpen] = useState(false)
  const [policySheetOpen, setPolicySheetOpen] = useState(false)
  const [savingSheet, setSavingSheet] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (!requestedTab || !validTabs.has(requestedTab)) {
      navigate(localizedPath(lang, `/iam/groups/${groupId}/team`), {
        replace: true,
      })
    }
  }, [groupId, lang, navigate, requestedTab])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPageIndex(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const loadGroup = useCallback(() => {
    if (!groupId) return
    setGroupLoading(true)
    setGroupError(false)
    fetchGroup(groupId)
      .then(setGroup)
      .catch(() => setGroupError(true))
      .finally(() => setGroupLoading(false))
  }, [groupId])

  const loadCounts = useCallback(() => {
    if (!groupId) return
    Promise.all([
      fetchGroupMembers(groupId, {
        searchText: "",
        getAllMembers: false,
        pageIndex: 0,
        pageSize: 1,
      }),
      fetchGroupPolicies(groupId, {
        name: "",
        getAllPolicies: false,
        pageIndex: 0,
        pageSize: 1,
      }),
    ])
      .then(([memberResult, policyResult]) =>
        setCounts({
          team: memberResult.totalCount,
          policies: policyResult.totalCount,
        })
      )
      .catch(() => undefined)
  }, [groupId])

  const loadRelationships = useCallback(() => {
    if (!groupId) return
    setRelationshipLoading(true)
    setRelationshipError(false)
    const request =
      activeTab === "team"
        ? fetchGroupMembers(groupId, {
            searchText: debouncedSearch,
            getAllMembers: false,
            pageIndex: pageIndex - 1,
            pageSize,
          }).then(setMembers)
        : fetchGroupPolicies(groupId, {
            name: debouncedSearch,
            getAllPolicies: false,
            pageIndex: pageIndex - 1,
            pageSize,
          }).then(setPolicies)
    request
      .catch(() => setRelationshipError(true))
      .finally(() => setRelationshipLoading(false))
  }, [activeTab, debouncedSearch, groupId, pageIndex, pageSize])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadGroup()
      loadCounts()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadCounts, loadGroup])

  useEffect(() => {
    const timeout = window.setTimeout(loadRelationships, 0)
    return () => window.clearTimeout(timeout)
  }, [loadRelationships])

  const resourceName = group ? groupResourceName(group) : ""

  const copyHeaderResource = useCallback(async () => {
    if (!resourceName) return
    await navigator.clipboard.writeText(resourceName)
    setResourceCopied(true)
    if (copyTimeoutRef.current !== null) {
      window.clearTimeout(copyTimeoutRef.current)
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setResourceCopied(false)
      copyTimeoutRef.current = null
    }, 1500)
  }, [resourceName])

  useEffect(
    () => () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current)
      }
    },
    []
  )

  const copyRowResource = useCallback(
    async (value: string) => {
      await navigator.clipboard.writeText(value)
      toast.success(copy.copied)
    },
    [copy.copied]
  )

  const memberColumns = useMemo<ColumnDef<GroupMember>[]>(
    () => [
      {
        accessorKey: "name",
        header: copy.name,
        size: 440,
        cell: ({ row }) => {
          const rn = memberResourceName(row.original)
          const name = row.original.name || row.original.email || copy.noName
          return (
            <div className="min-w-0 space-y-1">
              <Link
                to={localizedPath(
                  lang,
                  `/iam/team/${encodeURIComponent(row.original.id)}/groups`
                )}
                target="_blank"
                className="block truncate font-semibold text-foreground hover:underline"
              >
                {name}
              </Link>
              <ResourceLine
                value={rn}
                copyLabel={copy.copyResourceName}
                onCopy={() => copyRowResource(rn)}
              />
            </div>
          )
        },
      },
      {
        accessorKey: "email",
        header: copy.email,
        size: 480,
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger render={<span className="block truncate" />}>
              {row.original.email || "-"}
            </TooltipTrigger>
            {row.original.email ? (
              <TooltipContent>{row.original.email}</TooltipContent>
            ) : null}
          </Tooltip>
        ),
      },
      {
        id: "actions",
        header: copy.actions,
        size: 240,
        cell: ({ row }) => (
          <RowActions
            detailsHref={localizedPath(
              lang,
              `/iam/team/${encodeURIComponent(row.original.id)}/groups`
            )}
            detailsLabel={copy.details}
            removeLabel={copy.remove}
            onRemove={() =>
              setRemoveTarget({
                kind: "member",
                id: row.original.id,
                name: row.original.name || row.original.email,
              })
            }
          />
        ),
      },
    ],
    [copy, copyRowResource, lang]
  )

  const policyColumns = useMemo<ColumnDef<GroupPolicy>[]>(
    () => [
      {
        accessorKey: "name",
        header: copy.name,
        size: 350,
        cell: ({ row }) => {
          const rn = policyResourceName(row.original)
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
              <ResourceLine
                value={rn}
                copyLabel={copy.copyResourceName}
                onCopy={() => copyRowResource(rn)}
              />
            </div>
          )
        },
      },
      {
        accessorKey: "type",
        header: copy.type,
        size: 210,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            {row.original.type === "SysManaged" ? (
              <Star className="size-3.5 text-muted-foreground" />
            ) : null}
            {row.original.type === "SysManaged"
              ? copy.systemManaged
              : row.original.type === "CustomerManaged"
                ? copy.customerManaged
                : "-"}
          </span>
        ),
      },
      {
        accessorKey: "description",
        header: copy.description,
        size: 420,
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="block min-w-0 truncate text-muted-foreground" />
              }
            >
              {row.original.description || "-"}
            </TooltipTrigger>
            {row.original.description ? (
              <TooltipContent className="max-w-80">
                {row.original.description}
              </TooltipContent>
            ) : null}
          </Tooltip>
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
    [copy, copyRowResource, lang]
  )

  const loadMemberOptions = useCallback(
    (query: string, nextPage: number) =>
      fetchAvailableMembers(groupId, query, nextPage),
    [groupId]
  )
  const loadPolicyOptions = useCallback(
    (query: string, nextPage: number) =>
      fetchAvailablePolicies(groupId, query, nextPage),
    [groupId]
  )

  async function addMembers(selected: RelationshipOption[]) {
    setSavingSheet(true)
    try {
      await addMembersToGroup(
        groupId,
        selected.map((item) => item.id)
      )
      toast.success(copy.operationSucceeded)
      setMemberSheetOpen(false)
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
      await addPoliciesToGroup(
        groupId,
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
        await deleteGroup(groupId)
      } else if (removeTarget.kind === "member") {
        await removeMemberFromGroup(groupId, removeTarget.id)
      } else {
        await removePolicyFromGroup(groupId, removeTarget.id)
      }
      toast.success(copy.operationSucceeded)
      setRemoveTarget(null)
      if (removeTarget.kind === "group") {
        navigate(localizedPath(lang, "/iam/groups"))
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

  const activeData = activeTab === "team" ? members : policies
  const hasSearch = Boolean(debouncedSearch)
  const emptyMessage = hasSearch
    ? copy.noSearchResults
    : activeTab === "team"
      ? copy.membersEmpty
      : copy.policiesEmpty
  const emptyAction = hasSearch
    ? { label: copy.clearSearch, onClick: () => setSearch("") }
    : activeTab === "team"
      ? { label: copy.addMember, onClick: () => setMemberSheetOpen(true) }
      : { label: copy.addPolicy, onClick: () => setPolicySheetOpen(true) }

  const dialogCopy = getDialogCopy(removeTarget, copy)

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <Link
          to={localizedPath(lang, "/iam/groups")}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {copy.groups}
        </Link>

        {groupError ? (
          <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {copy.detailLoadFailed}
            <Button variant="outline" size="sm" onClick={loadGroup}>
              {copy.retry}
            </Button>
          </div>
        ) : (
          <header className="flex min-h-28 items-start justify-between gap-6">
            {groupLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-8 w-80" />
              </div>
            ) : (
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-normal">
                  {group?.name || copy.noName}
                </h1>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {group?.description || copy.noDescription}
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
                    <TooltipContent>{copy.copyResourceName}</TooltipContent>
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
                          onClick={copyHeaderResource}
                        />
                      }
                    >
                      {resourceCopied ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </TooltipTrigger>
                    <TooltipContent>
                      {resourceCopied ? copy.copied : copy.copyResourceName}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              className="border-destructive/50 text-destructive hover:bg-destructive/5 hover:text-destructive"
              disabled={!group}
              onClick={() =>
                group &&
                setRemoveTarget({
                  kind: "group",
                  id: group.id,
                  name: group.name,
                })
              }
            >
              {copy.removeGroup}
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
              localizedPath(
                lang,
                `/iam/groups/${groupId}/${value as DetailTab}`
              )
            )
          }}
          className="gap-0"
        >
          <TabsList
            variant="line"
            className="h-10 w-full justify-start gap-7 border-b p-0"
          >
            <DetailTabTrigger
              value="team"
              label={copy.team}
              count={counts.team}
            />
            <DetailTabTrigger
              value="policies"
              label={copy.policies}
              count={counts.policies}
            />
          </TabsList>
        </Tabs>

        <div className="flex items-center justify-between gap-4 py-5">
          <div className="relative w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              placeholder={
                activeTab === "team" ? copy.filterMembers : copy.filterPolicies
              }
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button
            type="button"
            onClick={() =>
              activeTab === "team"
                ? setMemberSheetOpen(true)
                : setPolicySheetOpen(true)
            }
          >
            <Plus className="size-4" />
            {activeTab === "team" ? copy.addMember : copy.addPolicy}
          </Button>
        </div>

        {relationshipError ? (
          <div className="mb-3 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {copy.relationshipLoadFailed}
            <Button variant="outline" size="sm" onClick={loadRelationships}>
              {copy.retry}
            </Button>
          </div>
        ) : null}

        {activeTab === "team" ? (
          <GroupDataTable
            data={members.items}
            columns={memberColumns}
            loading={relationshipLoading}
            emptyMessage={emptyMessage}
            emptyAction={emptyAction}
          />
        ) : (
          <GroupDataTable
            data={policies.items}
            columns={policyColumns}
            loading={relationshipLoading}
            emptyMessage={emptyMessage}
            emptyAction={emptyAction}
            minWidth={1000}
          />
        )}

        <GroupPagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={activeData.totalCount}
          summary={(first, last, total) =>
            copy.showing(
              first,
              last,
              total,
              activeTab === "team" ? copy.membersNoun : copy.policiesNoun
            )
          }
          perPage={copy.perPage}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPageIndex(1)
          }}
        />

        {memberSheetOpen ? (
          <RelationshipPickerSheet
            open={memberSheetOpen}
            title={copy.addMembersTitle(group?.name || copy.noName)}
            kind="members"
            copy={copy}
            saving={savingSheet}
            loadOptions={loadMemberOptions}
            onOpenChange={setMemberSheetOpen}
            onSubmit={addMembers}
          />
        ) : null}

        {policySheetOpen ? (
          <RelationshipPickerSheet
            open={policySheetOpen}
            title={copy.addPoliciesTitle(group?.name || copy.noName)}
            kind="policies"
            copy={copy}
            saving={savingSheet}
            loadOptions={loadPolicyOptions}
            onOpenChange={setPolicySheetOpen}
            onSubmit={addPolicies}
          />
        ) : null}

        <RemoveDialog
          open={Boolean(removeTarget)}
          title={dialogCopy.title}
          description={dialogCopy.description}
          cancelLabel={copy.cancel}
          confirmLabel={copy.remove}
          savingLabel={copy.removing}
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

function DetailTabTrigger({
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

function ResourceLine({
  value,
  copyLabel,
  onCopy,
}: {
  value: string
  copyLabel: string
  onCopy: () => void
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-5 shrink-0 text-muted-foreground"
              aria-label={copyLabel}
              onClick={onCopy}
            />
          }
        >
          <Copy className="size-3" />
        </TooltipTrigger>
        <TooltipContent>{copyLabel}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="block min-w-0 truncate font-mono text-[0.72rem]" />
          }
        >
          {value}
        </TooltipTrigger>
        <TooltipContent>{value}</TooltipContent>
      </Tooltip>
    </div>
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

function getDialogCopy(
  target: RemoveTarget,
  copy: ReturnType<typeof getGroupTranslations>
) {
  if (!target) return { title: "", description: null }
  if (target.kind === "group") {
    return {
      title: copy.removeGroupTitle,
      description: (
        <>
          {copy.removeGroupDescriptionBefore}
          <strong className="font-semibold text-foreground">
            {target.name}
          </strong>
          {copy.removeGroupDescriptionAfter}
        </>
      ),
    }
  }
  const isMember = target.kind === "member"
  return {
    title: isMember ? copy.removeMemberTitle : copy.removePolicyTitle,
    description: (
      <>
        {isMember
          ? copy.removeMemberDescriptionBefore
          : copy.removePolicyDescriptionBefore}
        <strong className="font-semibold text-foreground">{target.name}</strong>
        {isMember
          ? copy.removeMemberDescriptionAfter
          : copy.removePolicyDescriptionAfter}
      </>
    ),
  }
}
