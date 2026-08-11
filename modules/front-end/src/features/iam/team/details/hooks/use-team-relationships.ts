import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  addMemberToGroups,
  addPoliciesToMember,
  fetchAvailableGroups,
  fetchAvailablePolicies,
  fetchMemberDirectPolicies,
  fetchMemberGroups,
  fetchMemberInheritedPolicies,
  fetchMemberRelationshipCounts,
  removeMemberFromGroup,
  removePolicyFromMember,
  type MemberDetailGroup,
  type MemberDirectPolicy,
  type MemberInheritedPolicy,
  type RelationshipOption,
} from "../../team-api"
import type { TeamDetailTab } from "../details-types"

export type TeamRelationshipRemoveTarget = {
  kind: "group" | "policy"
  id: string
  name: string
}

const emptyGroups = { totalCount: 0, items: [] as MemberDetailGroup[] }
const emptyDirectPolicies = {
  totalCount: 0,
  items: [] as MemberDirectPolicy[],
}
const emptyInheritedPolicies = {
  totalCount: 0,
  items: [] as MemberInheritedPolicy[],
}

export function useTeamRelationships({
  memberId,
  activeTab,
}: {
  memberId: string
  activeTab: TeamDetailTab
}) {
  const { t } = useTranslation()
  const [counts, setCounts] = useState({
    groups: 0,
    direct: 0,
    inherited: 0,
  })
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [groups, setGroups] = useState(emptyGroups)
  const [directPolicies, setDirectPolicies] = useState(emptyDirectPolicies)
  const [inheritedPolicies, setInheritedPolicies] = useState(
    emptyInheritedPolicies
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPageIndex(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const loadCounts = useCallback(() => {
    if (!memberId) return
    fetchMemberRelationshipCounts(memberId)
      .then(setCounts)
      .catch(() => undefined)
  }, [memberId])

  const loadRelationships = useCallback(() => {
    if (!memberId || activeTab === "permissions") {
      setLoading(false)
      setError(false)
      return
    }
    setLoading(true)
    setError(false)

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

    request.catch(() => setError(true)).finally(() => setLoading(false))
  }, [activeTab, debouncedSearch, memberId, pageIndex, pageSize])

  useEffect(() => {
    const timeout = window.setTimeout(loadCounts, 0)
    return () => window.clearTimeout(timeout)
  }, [loadCounts])

  useEffect(() => {
    const timeout = window.setTimeout(loadRelationships, 0)
    return () => window.clearTimeout(timeout)
  }, [loadRelationships])

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
    setSaving(true)
    try {
      await addMemberToGroups(
        memberId,
        selected.map((item) => item.id)
      )
      toast.success(t("iam.team.details.operationSucceeded"))
      loadRelationships()
      loadCounts()
      return true
    } catch {
      toast.error(t("iam.team.details.operationFailed"))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function addPolicies(selected: RelationshipOption[]) {
    setSaving(true)
    try {
      await addPoliciesToMember(
        memberId,
        selected.map((item) => item.id)
      )
      toast.success(t("iam.team.details.operationSucceeded"))
      loadRelationships()
      loadCounts()
      return true
    } catch {
      toast.error(t("iam.team.details.operationFailed"))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function removeRelationship(target: TeamRelationshipRemoveTarget) {
    setRemoving(true)
    try {
      if (target.kind === "group") {
        await removeMemberFromGroup(memberId, target.id)
      } else {
        await removePolicyFromMember(memberId, target.id)
      }
      toast.success(t("iam.team.details.operationSucceeded"))
      loadRelationships()
      loadCounts()
      return true
    } catch {
      toast.error(t("iam.team.details.operationFailed"))
      return false
    } finally {
      setRemoving(false)
    }
  }

  function resetView() {
    setSearch("")
    setDebouncedSearch("")
    setPageIndex(1)
  }

  function changePageSize(size: number) {
    setPageSize(size)
    setPageIndex(1)
  }

  return {
    counts,
    search,
    debouncedSearch,
    pageIndex,
    pageSize,
    groups,
    directPolicies,
    inheritedPolicies,
    loading,
    error,
    saving,
    removing,
    setSearch,
    setPageIndex,
    changePageSize,
    resetView,
    reload: loadRelationships,
    loadGroupOptions,
    loadPolicyOptions,
    addGroups,
    addPolicies,
    removeRelationship,
  }
}
