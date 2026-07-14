import { ArrowLeft } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { localizedPath, resolveLang } from "@/features/layout/layout-context"
import { RemoveDialog } from "../components/remove-dialog"
import { deleteGroup, fetchGroup, type Group } from "../group-api"
import { GroupDetailsHeader } from "./components/group-details-header"
import {
  GroupRelationships,
  type GroupDetailTab,
} from "./components/group-relationships"

const validTabs = new Set<GroupDetailTab>(["team", "policies"])

export function GroupDetailsPage() {
  const params = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const lang = resolveLang(params.lang)
  const groupId = params.groupId ?? ""
  const requestedTab = params.tab as GroupDetailTab | undefined
  const activeTab =
    requestedTab && validTabs.has(requestedTab) ? requestedTab : "team"

  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (!requestedTab || !validTabs.has(requestedTab)) {
      navigate(localizedPath(lang, `/iam/groups/${groupId}/team`), {
        replace: true,
      })
    }
  }, [groupId, lang, navigate, requestedTab])

  const loadGroup = useCallback(() => {
    if (!groupId) return
    setLoading(true)
    setError(false)
    fetchGroup(groupId)
      .then(setGroup)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [groupId])

  useEffect(() => {
    const timeout = window.setTimeout(loadGroup, 0)
    return () => window.clearTimeout(timeout)
  }, [loadGroup])

  async function removeGroup() {
    if (!group) return
    setRemoving(true)
    try {
      await deleteGroup(group.id)
      toast.success(t("iam.groups.operationSucceeded"))
      navigate(localizedPath(lang, "/iam/groups"))
    } catch {
      toast.error(t("iam.groups.operationFailed"))
    } finally {
      setRemoving(false)
    }
  }

  function changeTab(tab: GroupDetailTab) {
    navigate(localizedPath(lang, `/iam/groups/${groupId}/${tab}`))
  }

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <Link
          to={localizedPath(lang, "/iam/groups")}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("iam.groups.groups")}
        </Link>

        <GroupDetailsHeader
          key={groupId}
          group={group}
          loading={loading}
          error={error}
          onRetry={loadGroup}
          onGroupChange={setGroup}
          onRemove={() => setRemoveOpen(true)}
        />

        <GroupRelationships
          groupId={groupId}
          groupName={group?.name ?? ""}
          lang={lang}
          activeTab={activeTab}
          onTabChange={changeTab}
        />

        <RemoveDialog
          open={removeOpen}
          title={t("iam.groups.removeGroupTitle")}
          description={
            group ? (
              <>
                {t("iam.groups.removeGroupDescriptionBefore")}
                <strong className="font-semibold text-foreground">
                  {group.name}
                </strong>
                {t("iam.groups.removeGroupDescriptionAfter")}
              </>
            ) : null
          }
          cancelLabel={t("iam.groups.cancel")}
          confirmLabel={t("iam.groups.remove")}
          savingLabel={t("iam.groups.removing")}
          saving={removing}
          onOpenChange={setRemoveOpen}
          onConfirm={removeGroup}
        />
      </div>
    </TooltipProvider>
  )
}
