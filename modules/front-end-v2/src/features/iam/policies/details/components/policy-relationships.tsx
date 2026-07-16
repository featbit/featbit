import { Copy, Plus, Search } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { RemoveDialog } from "@/features/iam/groups/components/remove-dialog"
import { RelationshipPickerSheet as MemberPickerSheet } from "@/features/iam/groups/details/components/relationship-picker-sheet"
import { RelationshipPickerSheet as GroupPickerSheet } from "@/features/iam/team/details/components/relationship-picker-sheet"
import { DetailsDataTable } from "@/features/iam/team/details/components/details-data-table"
import { DetailsPagination } from "@/features/iam/team/details/components/details-pagination"
import {
  clearRelationshipOptionsCache,
  prefetchRelationshipOptions,
} from "@/features/iam/team/details/relationship-options-cache"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import { cn } from "@/lib/utils"
import {
  addPolicyToGroups,
  addPolicyToMembers,
  fetchAvailableGroups,
  fetchAvailableMembers,
  fetchPolicyGroups,
  fetchPolicyMembers,
  removePolicyFromGroup,
  removePolicyFromMember,
  type PolicyGroup,
  type PolicyMember,
  type RelationshipOption,
} from "../policy-details-api"

export type PolicyRelationshipTab = "team" | "groups"

type RemoveTarget =
  | { kind: "member"; id: string; name: string }
  | { kind: "group"; id: string; name: string }
  | null

const emptyMembers = { totalCount: 0, items: [] as PolicyMember[] }
const emptyGroups = { totalCount: 0, items: [] as PolicyGroup[] }

export function PolicyRelationships({
  policyId,
  policyName,
  lang,
  activeTab,
  onCountsChange,
}: {
  policyId: string
  policyName: string
  lang: Lang
  activeTab: PolicyRelationshipTab
  onCountsChange: (counts: { team: number; groups: number }) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [members, setMembers] = useState(emptyMembers)
  const [groups, setGroups] = useState(emptyGroups)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [memberPickerOpen, setMemberPickerOpen] = useState(false)
  const [groupPickerOpen, setGroupPickerOpen] = useState(false)
  const [savingPicker, setSavingPicker] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget>(null)
  const [removing, setRemoving] = useState(false)
  const groupOptionsCacheKey = `policy:${policyId}:groups`

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPageIndex(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const loadCounts = useCallback(() => {
    Promise.all([
      fetchPolicyMembers(policyId, {
        searchText: "",
        getAllMembers: false,
        pageIndex: 0,
        pageSize: 1,
      }),
      fetchPolicyGroups(policyId, {
        name: "",
        getAllGroups: false,
        pageIndex: 0,
        pageSize: 1,
      }),
    ])
      .then(([memberResult, groupResult]) =>
        onCountsChange({
          team: memberResult.totalCount,
          groups: groupResult.totalCount,
        })
      )
      .catch(() => undefined)
  }, [onCountsChange, policyId])

  const loadRelationships = useCallback(() => {
    setLoading(true)
    setError(false)
    const request =
      activeTab === "team"
        ? fetchPolicyMembers(policyId, {
            searchText: debouncedSearch,
            getAllMembers: false,
            pageIndex: pageIndex - 1,
            pageSize,
          }).then(setMembers)
        : fetchPolicyGroups(policyId, {
            name: debouncedSearch,
            getAllGroups: false,
            pageIndex: pageIndex - 1,
            pageSize,
          }).then(setGroups)

    request.catch(() => setError(true)).finally(() => setLoading(false))
  }, [activeTab, debouncedSearch, pageIndex, pageSize, policyId])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadCounts()
      loadRelationships()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadCounts, loadRelationships])

  const copyResourceName = useCallback(
    async (value: string) => {
      await navigator.clipboard.writeText(value)
      toast.success(t("iam.policies.copied"))
    },
    [t]
  )

  const memberColumns = useMemo<ColumnDef<PolicyMember>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("iam.groups.name"),
        size: 440,
        cell: ({ row }) => {
          const name = row.original.name || row.original.email
          const resourceName = `member/${row.original.email}`
          return (
            <div className="min-w-0 space-y-1">
              <Link
                to={localizedPath(
                  lang,
                  `/iam/team/${encodeURIComponent(row.original.id)}/groups`
                )}
                target="_blank"
                className="block truncate font-semibold hover:underline"
              >
                {name}
              </Link>
              <ResourceLine
                value={resourceName}
                label={t("iam.policies.copyResourceName")}
                onCopy={() => void copyResourceName(resourceName)}
              />
            </div>
          )
        },
      },
      {
        accessorKey: "email",
        header: t("iam.groups.email"),
        size: 480,
        cell: ({ row }) => (
          <span className="block truncate">{row.original.email || "-"}</span>
        ),
      },
      {
        id: "actions",
        header: t("iam.groups.actions"),
        size: 240,
        cell: ({ row }) => (
          <RowActions
            detailsHref={localizedPath(
              lang,
              `/iam/team/${encodeURIComponent(row.original.id)}/groups`
            )}
            detailsLabel={t("iam.groups.details")}
            removeLabel={t("iam.groups.remove")}
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
    [copyResourceName, lang, t]
  )

  const groupColumns = useMemo<ColumnDef<PolicyGroup>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("iam.team.details.name"),
        size: 440,
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
                className="block truncate font-semibold hover:underline"
              >
                {row.original.name}
              </Link>
              <ResourceLine
                value={resourceName}
                label={t("iam.policies.copyResourceName")}
                onCopy={() => void copyResourceName(resourceName)}
              />
            </div>
          )
        },
      },
      {
        accessorKey: "description",
        header: t("iam.team.details.description"),
        size: 480,
        cell: ({ row }) => (
          <span className="block truncate text-muted-foreground">
            {row.original.description || "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("iam.team.details.actions"),
        size: 240,
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
    [copyResourceName, lang, t]
  )

  const loadMemberOptions = useCallback(
    (query: string, nextPage: number) =>
      fetchAvailableMembers(policyId, query, nextPage),
    [policyId]
  )
  const loadGroupOptions = useCallback(
    (query: string, nextPage: number) =>
      fetchAvailableGroups(policyId, query, nextPage),
    [policyId]
  )

  const prefetchGroupPicker = useCallback(() => {
    void prefetchRelationshipOptions(
      queryClient,
      groupOptionsCacheKey,
      loadGroupOptions
    )
  }, [groupOptionsCacheKey, loadGroupOptions, queryClient])

  const openGroupPicker = useCallback(() => {
    prefetchGroupPicker()
    setGroupPickerOpen(true)
  }, [prefetchGroupPicker])

  async function addMembers(selected: RelationshipOption[]) {
    setSavingPicker(true)
    try {
      await addPolicyToMembers(
        policyId,
        selected.map((item) => item.id)
      )
      toast.success(t("iam.policies.operationSucceeded"))
      setMemberPickerOpen(false)
      loadRelationships()
      loadCounts()
    } catch {
      toast.error(t("iam.policies.operationFailed"))
    } finally {
      setSavingPicker(false)
    }
  }

  async function addGroups(selected: RelationshipOption[]) {
    setSavingPicker(true)
    try {
      await addPolicyToGroups(
        policyId,
        selected.map((item) => item.id)
      )
      clearRelationshipOptionsCache(queryClient, groupOptionsCacheKey)
      toast.success(t("iam.policies.operationSucceeded"))
      setGroupPickerOpen(false)
      loadRelationships()
      loadCounts()
    } catch {
      toast.error(t("iam.policies.operationFailed"))
    } finally {
      setSavingPicker(false)
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return
    setRemoving(true)
    try {
      if (removeTarget.kind === "member") {
        await removePolicyFromMember(policyId, removeTarget.id)
      } else {
        await removePolicyFromGroup(policyId, removeTarget.id)
        clearRelationshipOptionsCache(queryClient, groupOptionsCacheKey)
      }
      toast.success(t("iam.policies.operationSucceeded"))
      setRemoveTarget(null)
      loadRelationships()
      loadCounts()
    } catch {
      toast.error(t("iam.policies.operationFailed"))
    } finally {
      setRemoving(false)
    }
  }

  const activeData = activeTab === "team" ? members : groups
  const emptyMessage =
    activeTab === "team"
      ? t("iam.policies.details.membersEmpty", {
          defaultValue: "No members are assigned to this policy yet.",
        })
      : t("iam.policies.details.groupsEmpty", {
          defaultValue: "No groups are assigned to this policy yet.",
        })

  return (
    <>
      <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            className="pl-9"
            placeholder={
              activeTab === "team"
                ? t("iam.groups.filterMembers")
                : t("iam.team.details.filterGroups")
            }
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button
          type="button"
          onPointerEnter={
            activeTab === "groups" ? prefetchGroupPicker : undefined
          }
          onFocus={activeTab === "groups" ? prefetchGroupPicker : undefined}
          onClick={() =>
            activeTab === "team" ? setMemberPickerOpen(true) : openGroupPicker()
          }
        >
          <Plus className="size-4" />
          {activeTab === "team"
            ? t("iam.groups.addMember")
            : t("iam.team.details.addToGroups")}
        </Button>
      </div>

      {error ? (
        <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {t("iam.policies.details.relationshipsLoadFailed", {
            defaultValue: "Failed to load policy relationships",
          })}
          <Button variant="outline" size="sm" onClick={loadRelationships}>
            {t("iam.policies.retry")}
          </Button>
        </div>
      ) : activeTab === "team" ? (
        <DetailsDataTable
          data={members.items}
          columns={memberColumns}
          loading={loading}
          emptyMessage={emptyMessage}
          emptyAction={{
            label: t("iam.groups.addMember"),
            onClick: () => setMemberPickerOpen(true),
          }}
        />
      ) : (
        <DetailsDataTable
          data={groups.items}
          columns={groupColumns}
          loading={loading}
          emptyMessage={emptyMessage}
          emptyAction={{
            label: t("iam.team.details.addToGroups"),
            onClick: openGroupPicker,
          }}
        />
      )}

      <DetailsPagination
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={activeData.totalCount}
        summary={(first, last, total) =>
          activeTab === "team"
            ? t("iam.policies.details.showingMembers", {
                defaultValue:
                  "Showing {{first}} to {{last}} of {{total}} members",
                first,
                last,
                total,
              })
            : t("iam.policies.details.showingGroups", {
                defaultValue:
                  "Showing {{first}} to {{last}} of {{total}} groups",
                first,
                last,
                total,
              })
        }
        perPage={(count) => t("iam.policies.perPage", { count })}
        onPageIndexChange={setPageIndex}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPageIndex(1)
        }}
      />

      <MemberPickerSheet
        open={memberPickerOpen}
        title={t("iam.policies.details.addMembersTitle", {
          defaultValue: "Add members to {{name}}",
          name: policyName,
        })}
        kind="members"
        saving={savingPicker}
        loadOptions={loadMemberOptions}
        onOpenChange={setMemberPickerOpen}
        onSubmit={addMembers}
      />
      <GroupPickerSheet
        open={groupPickerOpen}
        title={t("iam.policies.details.addGroupsTitle", {
          defaultValue: "Add groups to {{name}}",
          name: policyName,
        })}
        kind="groups"
        cacheKey={groupOptionsCacheKey}
        saving={savingPicker}
        loadOptions={loadGroupOptions}
        onOpenChange={setGroupPickerOpen}
        onSubmit={addGroups}
      />
      <RemoveDialog
        open={Boolean(removeTarget)}
        title={
          removeTarget?.kind === "member"
            ? t("iam.policies.details.removeMemberTitle", {
                defaultValue: "Remove member",
              })
            : t("iam.policies.details.removeGroupTitle", {
                defaultValue: "Remove group",
              })
        }
        description={
          removeTarget ? (
            removeTarget.kind === "member" ? (
              <>
                {t("iam.policies.details.removeMemberDescriptionBefore", {
                  defaultValue: "Are you sure to remove the member ",
                })}
                <strong className="font-semibold text-foreground">
                  {removeTarget.name}
                </strong>
                {t("iam.policies.details.removeMemberDescriptionAfter", {
                  defaultValue: " from the current policy?",
                })}
              </>
            ) : (
              <>
                {t("iam.policies.details.removeGroupDescriptionBefore", {
                  defaultValue:
                    "Are you sure to remove the policy from the group ",
                })}
                <strong className="font-semibold text-foreground">
                  {removeTarget.name}
                </strong>
                {t("iam.policies.details.removeGroupDescriptionAfter", {
                  defaultValue: "?",
                })}
              </>
            )
          ) : null
        }
        cancelLabel={t("iam.policies.cancel")}
        confirmLabel={t("iam.policies.remove")}
        savingLabel={t("iam.policies.removing")}
        saving={removing}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
        onConfirm={() => void confirmRemove()}
      />
    </>
  )
}

function ResourceLine({
  value,
  label,
  onCopy,
}: {
  value: string
  label: string
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
              aria-label={label}
              onClick={onCopy}
            />
          }
        >
          <Copy className="size-3" />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <span className="block min-w-0 truncate font-mono text-[0.72rem]">
        {value}
      </span>
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
