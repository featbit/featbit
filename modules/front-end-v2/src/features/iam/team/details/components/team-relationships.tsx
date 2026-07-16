import { Plus, Search } from "lucide-react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Lang } from "@/features/layout/layout-types"
import type {
  MemberDetailGroup,
  MemberDirectPolicy,
  RelationshipOption,
} from "../../team-api"
import type { TeamDetailTab } from "../details-types"
import {
  useTeamRelationships,
  type TeamRelationshipRemoveTarget,
} from "../hooks/use-team-relationships"
import {
  clearRelationshipOptionsCache,
  prefetchRelationshipOptions,
} from "../relationship-options-cache"
import { DetailsPagination } from "./details-pagination"
import { DirectPoliciesTab } from "./direct-policies-tab"
import { GroupsTab } from "./groups-tab"
import { InheritedPoliciesTab } from "./inherited-policies-tab"
import { RelationshipPickerSheet } from "./relationship-picker-sheet"
import { RemoveRelationshipDialog } from "./remove-relationship-dialog"

export function TeamRelationships({
  memberId,
  memberName,
  lang,
  activeTab,
  onTabChange,
}: {
  memberId: string
  memberName: string
  lang: Lang
  activeTab: TeamDetailTab
  onTabChange: (tab: TeamDetailTab) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const relationships = useTeamRelationships({ memberId, activeTab })
  const [groupSheetOpen, setGroupSheetOpen] = useState(false)
  const [policySheetOpen, setPolicySheetOpen] = useState(false)
  const [removeTarget, setRemoveTarget] =
    useState<TeamRelationshipRemoveTarget | null>(null)
  const groupOptionsCacheKey = `team:${memberId}:groups`
  const policyOptionsCacheKey = `team:${memberId}:policies`

  const prefetchGroups = useCallback(() => {
    void prefetchRelationshipOptions(
      queryClient,
      groupOptionsCacheKey,
      relationships.loadGroupOptions
    )
  }, [groupOptionsCacheKey, queryClient, relationships.loadGroupOptions])

  const prefetchPolicies = useCallback(() => {
    void prefetchRelationshipOptions(
      queryClient,
      policyOptionsCacheKey,
      relationships.loadPolicyOptions
    )
  }, [policyOptionsCacheKey, queryClient, relationships.loadPolicyOptions])

  const openGroupSheet = useCallback(() => {
    prefetchGroups()
    setGroupSheetOpen(true)
  }, [prefetchGroups])

  const openPolicySheet = useCallback(() => {
    prefetchPolicies()
    setPolicySheetOpen(true)
  }, [prefetchPolicies])

  const copyRowResource = useCallback(
    async (value: string) => {
      await navigator.clipboard.writeText(value)
      toast.success(t("iam.team.details.copied"))
    },
    [t]
  )

  const selectGroupForRemoval = useCallback((group: MemberDetailGroup) => {
    setRemoveTarget({
      kind: "group",
      id: group.id,
      name: group.name,
    })
  }, [])

  const selectPolicyForRemoval = useCallback((policy: MemberDirectPolicy) => {
    setRemoveTarget({
      kind: "policy",
      id: policy.id,
      name: policy.name,
    })
  }, [])

  async function addGroups(selected: RelationshipOption[]) {
    if (await relationships.addGroups(selected)) {
      clearRelationshipOptionsCache(queryClient, groupOptionsCacheKey)
      setGroupSheetOpen(false)
    }
  }

  async function addPolicies(selected: RelationshipOption[]) {
    if (await relationships.addPolicies(selected)) {
      clearRelationshipOptionsCache(queryClient, policyOptionsCacheKey)
      setPolicySheetOpen(false)
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return
    if (await relationships.removeRelationship(removeTarget)) {
      clearRelationshipOptionsCache(
        queryClient,
        removeTarget.kind === "group"
          ? groupOptionsCacheKey
          : policyOptionsCacheKey
      )
      setRemoveTarget(null)
    }
  }

  function changeTab(tab: TeamDetailTab) {
    relationships.resetView()
    onTabChange(tab)
  }

  const activeData =
    activeTab === "groups"
      ? relationships.groups
      : activeTab === "direct-policies"
        ? relationships.directPolicies
        : relationships.inheritedPolicies
  const hasSearch = Boolean(relationships.debouncedSearch)
  const emptyMessage = hasSearch
    ? t("iam.team.details.noSearchResults")
    : activeTab === "groups"
      ? t("iam.team.details.groupsEmpty")
      : activeTab === "direct-policies"
        ? t("iam.team.details.directPoliciesEmpty")
        : t("iam.team.details.inheritedPoliciesEmpty")
  const emptyAction = hasSearch
    ? {
        label: t("iam.team.details.clearSearch"),
        onClick: () => relationships.setSearch(""),
      }
    : activeTab === "groups"
      ? {
          label: t("iam.team.details.addToGroups"),
          onClick: openGroupSheet,
        }
      : activeTab === "direct-policies"
        ? {
            label: t("iam.team.details.addPolicy"),
            onClick: openPolicySheet,
          }
        : undefined

  return (
    <>
      <Tabs
        value={activeTab}
        onValueChange={(value) => changeTab(value as TeamDetailTab)}
        className="[scrollbar-width:none] overflow-x-auto border-b [&::-webkit-scrollbar]:hidden"
      >
        <TabsList variant="line" className="flex min-w-max gap-8">
          <DetailTabTrigger
            value="groups"
            label={t("iam.team.details.groups")}
            count={relationships.counts.groups}
          />
          <DetailTabTrigger
            value="direct-policies"
            label={t("iam.team.details.directPolicies")}
            count={relationships.counts.direct}
          />
          <DetailTabTrigger
            value="inherited-policies"
            label={t("iam.team.details.inheritedPolicies")}
            count={relationships.counts.inherited}
          />
        </TabsList>
      </Tabs>

      <div className="flex items-center justify-between gap-4 py-5">
        <div className="relative w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={relationships.search}
            placeholder={
              activeTab === "groups"
                ? t("iam.team.details.filterGroups")
                : t("iam.team.details.filterPolicies")
            }
            className="pl-9"
            onChange={(event) => relationships.setSearch(event.target.value)}
          />
        </div>
        {activeTab === "groups" ? (
          <Button
            type="button"
            onPointerEnter={prefetchGroups}
            onFocus={prefetchGroups}
            onClick={openGroupSheet}
          >
            <Plus className="size-4" />
            {t("iam.team.details.addToGroups")}
          </Button>
        ) : activeTab === "direct-policies" ? (
          <Button
            type="button"
            onPointerEnter={prefetchPolicies}
            onFocus={prefetchPolicies}
            onClick={openPolicySheet}
          >
            <Plus className="size-4" />
            {t("iam.team.details.addPolicy")}
          </Button>
        ) : null}
      </div>

      {relationships.error ? (
        <div className="mb-3 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {t("iam.team.details.relationshipLoadFailed")}
          <Button variant="outline" size="sm" onClick={relationships.reload}>
            {t("iam.team.details.retry")}
          </Button>
        </div>
      ) : null}

      {activeTab === "groups" ? (
        <GroupsTab
          data={relationships.groups.items}
          lang={lang}
          loading={relationships.loading}
          emptyMessage={emptyMessage}
          emptyAction={emptyAction}
          onCopyResource={copyRowResource}
          onRemove={selectGroupForRemoval}
        />
      ) : activeTab === "direct-policies" ? (
        <DirectPoliciesTab
          data={relationships.directPolicies.items}
          lang={lang}
          loading={relationships.loading}
          emptyMessage={emptyMessage}
          emptyAction={emptyAction}
          onCopyResource={copyRowResource}
          onRemove={selectPolicyForRemoval}
        />
      ) : (
        <InheritedPoliciesTab
          data={relationships.inheritedPolicies.items}
          lang={lang}
          loading={relationships.loading}
          emptyMessage={emptyMessage}
          onCopyResource={copyRowResource}
        />
      )}

      <DetailsPagination
        pageIndex={relationships.pageIndex}
        pageSize={relationships.pageSize}
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
        onPageIndexChange={relationships.setPageIndex}
        onPageSizeChange={relationships.changePageSize}
      />

      {groupSheetOpen ? (
        <RelationshipPickerSheet
          open={groupSheetOpen}
          title={t("iam.team.details.addGroupsTitle", { name: memberName })}
          kind="groups"
          cacheKey={groupOptionsCacheKey}
          saving={relationships.saving}
          loadOptions={relationships.loadGroupOptions}
          onOpenChange={setGroupSheetOpen}
          onSubmit={addGroups}
        />
      ) : null}

      {policySheetOpen ? (
        <RelationshipPickerSheet
          open={policySheetOpen}
          title={t("iam.team.details.addPoliciesTitle", { name: memberName })}
          kind="policies"
          cacheKey={policyOptionsCacheKey}
          saving={relationships.saving}
          loadOptions={relationships.loadPolicyOptions}
          onOpenChange={setPolicySheetOpen}
          onSubmit={addPolicies}
        />
      ) : null}

      <RemoveRelationshipDialog
        target={removeTarget}
        saving={relationships.removing}
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
  value: TeamDetailTab
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
