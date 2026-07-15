import { ArrowLeft, ShieldCheck } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { RemoveDialog } from "@/features/iam/groups/components/remove-dialog"
import { localizedPath, resolveLang } from "@/features/layout/layout-context"
import { PolicyDetailsHeader } from "./components/policy-details-header"
import {
  PolicyRelationships,
  type PolicyRelationshipTab,
} from "./components/policy-relationships"
import {
  fetchPolicyDetail,
  fetchPolicyGroups,
  fetchPolicyMembers,
  removePolicy,
  type PolicyDetail,
} from "./policy-details-api"

type PolicyDetailTab = "permission" | PolicyRelationshipTab

const validTabs = new Set<PolicyDetailTab>(["permission", "team", "groups"])

export function PolicyDetailsPage() {
  const params = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const lang = resolveLang(params.lang)
  const policyId = params.policyId ?? ""
  const requestedTab = params.tab as PolicyDetailTab | undefined
  const activeTab =
    requestedTab && validTabs.has(requestedTab) ? requestedTab : "permission"

  const [policy, setPolicy] = useState<PolicyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [counts, setCounts] = useState({ team: 0, groups: 0 })
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (!requestedTab || !validTabs.has(requestedTab)) {
      navigate(localizedPath(lang, `/iam/policies/${policyId}/permission`), {
        replace: true,
      })
    }
  }, [lang, navigate, policyId, requestedTab])

  const loadPolicy = useCallback(() => {
    if (!policyId) return
    setLoading(true)
    setError(false)
    fetchPolicyDetail(policyId)
      .then(setPolicy)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [policyId])

  useEffect(() => {
    const timeout = window.setTimeout(loadPolicy, 0)
    return () => window.clearTimeout(timeout)
  }, [loadPolicy])

  const loadCounts = useCallback(() => {
    if (!policyId) return
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
        setCounts({
          team: memberResult.totalCount,
          groups: groupResult.totalCount,
        })
      )
      .catch(() => undefined)
  }, [policyId])

  useEffect(() => {
    const timeout = window.setTimeout(loadCounts, 0)
    return () => window.clearTimeout(timeout)
  }, [loadCounts])

  const updateCounts = useCallback(
    (nextCounts: { team: number; groups: number }) => setCounts(nextCounts),
    []
  )

  async function confirmRemovePolicy() {
    if (!policy) return
    setRemoving(true)
    try {
      await removePolicy(policy.id)
      toast.success(t("iam.policies.operationSucceeded"))
      navigate(localizedPath(lang, "/iam/policies"))
    } catch {
      toast.error(t("iam.policies.operationFailed"))
    } finally {
      setRemoving(false)
    }
  }

  function changeTab(value: string) {
    navigate(
      localizedPath(
        lang,
        `/iam/policies/${policyId}/${value as PolicyDetailTab}`
      )
    )
  }

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <Link
          to={localizedPath(lang, "/iam/policies")}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("iam.policies.title")}
        </Link>

        <PolicyDetailsHeader
          key={policyId}
          policy={policy}
          loading={loading}
          error={error}
          onRetry={loadPolicy}
          onPolicyChange={setPolicy}
          onRemove={() => setRemoveOpen(true)}
        />

        {!error ? (
          <>
            <Tabs value={activeTab} onValueChange={changeTab} className="gap-0">
              <TabsList
                variant="line"
                className="h-10 w-full justify-start gap-7 border-b p-0"
              >
                <DetailTab
                  value="permission"
                  label={t("iam.policies.details.permissions", {
                    defaultValue: "Permissions",
                  })}
                  count={policy?.statements?.length ?? 0}
                />
                <DetailTab
                  value="team"
                  label={t("iam.groups.team")}
                  count={counts.team}
                />
                <DetailTab
                  value="groups"
                  label={t("iam.team.details.groups")}
                  count={counts.groups}
                />
              </TabsList>
            </Tabs>

            {activeTab === "permission" ? (
              <PermissionsPlaceholder />
            ) : (
              <PolicyRelationships
                key={activeTab}
                policyId={policyId}
                policyName={policy?.name ?? ""}
                lang={lang}
                activeTab={activeTab}
                onCountsChange={updateCounts}
              />
            )}
          </>
        ) : null}

        <RemoveDialog
          open={removeOpen}
          title={t("iam.policies.removePolicyTitle")}
          description={
            policy ? (
              <>
                {t("iam.policies.removePolicyDescriptionBefore")}
                <strong className="font-semibold text-foreground">
                  {policy.name}
                </strong>
                {t("iam.policies.removePolicyDescriptionAfter")}
              </>
            ) : null
          }
          cancelLabel={t("iam.policies.cancel")}
          confirmLabel={t("iam.policies.remove")}
          savingLabel={t("iam.policies.removing")}
          saving={removing}
          onOpenChange={setRemoveOpen}
          onConfirm={() => void confirmRemovePolicy()}
        />
      </div>
    </TooltipProvider>
  )
}

function DetailTab({
  value,
  label,
  count,
}: {
  value: PolicyDetailTab
  label: string
  count: number
}) {
  return (
    <TabsTrigger value={value} className="h-10 flex-none gap-2 px-4">
      {label}
      <Badge
        variant="secondary"
        className="h-5 min-w-5 rounded-full px-1.5 text-[0.68rem] font-normal"
      >
        {count}
      </Badge>
    </TabsTrigger>
  )
}

function PermissionsPlaceholder() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-52 items-center justify-center rounded-md border border-dashed bg-muted/10 px-6 py-12 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg border bg-background">
          <ShieldCheck className="size-5 text-muted-foreground" />
        </div>
        <h2 className="font-semibold text-foreground">
          {t("iam.policies.details.permissionsPlaceholderTitle", {
            defaultValue: "Permissions editor coming next",
          })}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("iam.policies.details.permissionsPlaceholderDescription", {
            defaultValue:
              "Team and group assignments are available now. Permission statements will be added in the next step.",
          })}
        </p>
      </div>
    </div>
  )
}
