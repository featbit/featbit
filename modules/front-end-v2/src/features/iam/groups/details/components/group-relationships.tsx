import { Plus, Search } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Lang } from "@/features/layout/layout-types"
import { GroupDataTable } from "../../components/data-table"
import { GroupPagination } from "../../components/pagination"
import { RemoveDialog } from "../../components/remove-dialog"
import {
  addMembersToGroup,
  addPoliciesToGroup,
  fetchAvailableMembers,
  fetchAvailablePolicies,
  fetchGroupMembers,
  fetchGroupPolicies,
  removeMemberFromGroup,
  removePolicyFromGroup,
  type GroupMember,
  type GroupPolicy,
  type RelationshipOption,
} from "../../group-api"
import { createMemberColumns } from "./member-columns"
import { createPolicyColumns } from "./policy-columns"
import { RelationshipPickerSheet } from "./relationship-picker-sheet"

export type GroupDetailTab = "team" | "policies"

type RemoveTarget = {
  kind: "member" | "policy"
  id: string
  name: string
} | null

const emptyMembers = { totalCount: 0, items: [] as GroupMember[] }
const emptyPolicies = { totalCount: 0, items: [] as GroupPolicy[] }

export function GroupRelationships({
  groupId,
  groupName,
  lang,
  activeTab,
  onTabChange,
}: {
  groupId: string
  groupName: string
  lang: Lang
  activeTab: GroupDetailTab
  onTabChange: (tab: GroupDetailTab) => void
}) {
  const { t } = useTranslation()
  const [counts, setCounts] = useState({ team: 0, policies: 0 })
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [members, setMembers] = useState(emptyMembers)
  const [policies, setPolicies] = useState(emptyPolicies)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [memberSheetOpen, setMemberSheetOpen] = useState(false)
  const [policySheetOpen, setPolicySheetOpen] = useState(false)
  const [savingSheet, setSavingSheet] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPageIndex(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search])

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
    setLoading(true)
    setError(false)
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
    request.catch(() => setError(true)).finally(() => setLoading(false))
  }, [activeTab, debouncedSearch, groupId, pageIndex, pageSize])

  useEffect(() => {
    const timeout = window.setTimeout(loadCounts, 0)
    return () => window.clearTimeout(timeout)
  }, [loadCounts])

  useEffect(() => {
    const timeout = window.setTimeout(loadRelationships, 0)
    return () => window.clearTimeout(timeout)
  }, [loadRelationships])

  const copyRowResource = useCallback(
    async (value: string) => {
      await navigator.clipboard.writeText(value)
      toast.success(t("iam.groups.copied"))
    },
    [t]
  )

  const memberColumns = useMemo(
    () =>
      createMemberColumns({
        t,
        lang,
        onCopyResource: (value) => void copyRowResource(value),
        onRemove: (member) =>
          setRemoveTarget({
            kind: "member",
            id: member.id,
            name: member.name || member.email,
          }),
      }),
    [copyRowResource, lang, t]
  )

  const policyColumns = useMemo(
    () =>
      createPolicyColumns({
        t,
        lang,
        onCopyResource: (value) => void copyRowResource(value),
        onRemove: (policy) =>
          setRemoveTarget({
            kind: "policy",
            id: policy.id,
            name: policy.name,
          }),
      }),
    [copyRowResource, lang, t]
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
      toast.success(t("iam.groups.operationSucceeded"))
      setMemberSheetOpen(false)
      loadRelationships()
      loadCounts()
    } catch {
      toast.error(t("iam.groups.operationFailed"))
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
      toast.success(t("iam.groups.operationSucceeded"))
      setPolicySheetOpen(false)
      loadRelationships()
      loadCounts()
    } catch {
      toast.error(t("iam.groups.operationFailed"))
    } finally {
      setSavingSheet(false)
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return
    setRemoving(true)
    try {
      if (removeTarget.kind === "member") {
        await removeMemberFromGroup(groupId, removeTarget.id)
      } else {
        await removePolicyFromGroup(groupId, removeTarget.id)
      }
      toast.success(t("iam.groups.operationSucceeded"))
      setRemoveTarget(null)
      loadRelationships()
      loadCounts()
    } catch {
      toast.error(t("iam.groups.operationFailed"))
    } finally {
      setRemoving(false)
    }
  }

  function changeTab(tab: GroupDetailTab) {
    setSearch("")
    setDebouncedSearch("")
    setPageIndex(1)
    onTabChange(tab)
  }

  const activeData = activeTab === "team" ? members : policies
  const hasSearch = Boolean(debouncedSearch)
  const emptyMessage = hasSearch
    ? t("iam.groups.noSearchResults")
    : activeTab === "team"
      ? t("iam.groups.membersEmpty")
      : t("iam.groups.policiesEmpty")
  const emptyAction = hasSearch
    ? { label: t("iam.groups.clearSearch"), onClick: () => setSearch("") }
    : activeTab === "team"
      ? {
          label: t("iam.groups.addMember"),
          onClick: () => setMemberSheetOpen(true),
        }
      : {
          label: t("iam.groups.addPolicy"),
          onClick: () => setPolicySheetOpen(true),
        }

  const removeDialog = removeTarget
    ? {
        title:
          removeTarget.kind === "member"
            ? t("iam.groups.removeMemberTitle")
            : t("iam.groups.removePolicyTitle"),
        before:
          removeTarget.kind === "member"
            ? t("iam.groups.removeMemberDescriptionBefore")
            : t("iam.groups.removePolicyDescriptionBefore"),
        after:
          removeTarget.kind === "member"
            ? t("iam.groups.removeMemberDescriptionAfter")
            : t("iam.groups.removePolicyDescriptionAfter"),
      }
    : null

  return (
    <>
      <Tabs
        value={activeTab}
        onValueChange={(value) => changeTab(value as GroupDetailTab)}
        className="[scrollbar-width:none] overflow-x-auto border-b [&::-webkit-scrollbar]:hidden"
      >
        <TabsList variant="line" className="flex min-w-max gap-8">
          <DetailTabTrigger
            value="team"
            label={t("iam.groups.team")}
            count={counts.team}
          />
          <DetailTabTrigger
            value="policies"
            label={t("iam.groups.policies")}
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
              activeTab === "team"
                ? t("iam.groups.filterMembers")
                : t("iam.groups.filterPolicies")
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
          {activeTab === "team"
            ? t("iam.groups.addMember")
            : t("iam.groups.addPolicy")}
        </Button>
      </div>

      {error ? (
        <div className="mb-3 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {t("iam.groups.relationshipLoadFailed")}
          <Button variant="outline" size="sm" onClick={loadRelationships}>
            {t("iam.groups.retry")}
          </Button>
        </div>
      ) : null}

      {activeTab === "team" ? (
        <GroupDataTable
          data={members.items}
          columns={memberColumns}
          loading={loading}
          emptyMessage={emptyMessage}
          emptyAction={emptyAction}
        />
      ) : (
        <GroupDataTable
          data={policies.items}
          columns={policyColumns}
          loading={loading}
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
          t("iam.groups.showing", {
            first,
            last,
            total,
            noun:
              activeTab === "team"
                ? t("iam.groups.membersNoun")
                : t("iam.groups.policiesNoun"),
          })
        }
        perPage={(count) => t("iam.groups.perPage", { count })}
        onPageIndexChange={setPageIndex}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPageIndex(1)
        }}
      />

      {memberSheetOpen ? (
        <RelationshipPickerSheet
          open={memberSheetOpen}
          title={t("iam.groups.addMembersTitle", {
            name: groupName || t("iam.groups.noName"),
          })}
          kind="members"
          saving={savingSheet}
          loadOptions={loadMemberOptions}
          onOpenChange={setMemberSheetOpen}
          onSubmit={addMembers}
        />
      ) : null}

      {policySheetOpen ? (
        <RelationshipPickerSheet
          open={policySheetOpen}
          title={t("iam.groups.addPoliciesTitle", {
            name: groupName || t("iam.groups.noName"),
          })}
          kind="policies"
          saving={savingSheet}
          loadOptions={loadPolicyOptions}
          onOpenChange={setPolicySheetOpen}
          onSubmit={addPolicies}
        />
      ) : null}

      <RemoveDialog
        open={Boolean(removeTarget)}
        title={removeDialog?.title ?? ""}
        description={
          removeTarget && removeDialog ? (
            <>
              {removeDialog.before}
              <strong className="font-semibold text-foreground">
                {removeTarget.name}
              </strong>
              {removeDialog.after}
            </>
          ) : null
        }
        cancelLabel={t("iam.groups.cancel")}
        confirmLabel={t("iam.groups.remove")}
        savingLabel={t("iam.groups.removing")}
        saving={removing}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
        onConfirm={confirmRemove}
      />
    </>
  )
}

function DetailTabTrigger({
  value,
  label,
  count,
}: {
  value: GroupDetailTab
  label: string
  count: number
}) {
  return (
    <TabsTrigger value={value} className="flex-none gap-2 px-0 py-2.5">
      {label}
      <Badge variant="secondary" className="rounded-full px-1.5 font-normal">
        {count}
      </Badge>
    </TabsTrigger>
  )
}
