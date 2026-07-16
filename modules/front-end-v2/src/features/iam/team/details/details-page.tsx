import { ArrowLeft, Check, Copy } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getStoredUserProfile } from "@/features/auth/auth-api"
import { localizedPath, resolveLang } from "@/features/layout/layout-context"
import {
  fetchMemberDetail,
  memberResourceName,
  removeMemberFromOrganization,
  type TeamMember,
} from "../team-api"
import {
  RemoveRelationshipDialog,
  type RemoveDialogTarget,
} from "./components/remove-relationship-dialog"
import { TeamRelationships } from "./components/team-relationships"
import type { TeamDetailTab } from "./details-types"

const validTabs = new Set<TeamDetailTab>([
  "permissions",
  "groups",
  "direct-policies",
  "inherited-policies",
])

export function TeamDetailsPage() {
  const params = useParams()
  const navigate = useNavigate()
  const lang = resolveLang(params.lang)
  const { t } = useTranslation()
  const memberId = params.memberId ?? ""
  const requestedTab = params.tab as TeamDetailTab | undefined
  const activeTab =
    requestedTab && validTabs.has(requestedTab) ? requestedTab : "permissions"
  const profile = useMemo(() => getStoredUserProfile(), [])

  const [member, setMember] = useState<TeamMember | null>(null)
  const [memberLoading, setMemberLoading] = useState(true)
  const [memberError, setMemberError] = useState(false)
  const [resourceNameCopied, setResourceNameCopied] = useState(false)
  const copyFeedbackTimeoutRef = useRef<number | null>(null)
  const [removeTarget, setRemoveTarget] = useState<RemoveDialogTarget>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (!requestedTab || !validTabs.has(requestedTab)) {
      navigate(localizedPath(lang, `/iam/team/${memberId}/permissions`), {
        replace: true,
      })
    }
  }, [lang, memberId, navigate, requestedTab])

  const loadMember = useCallback(() => {
    if (!memberId) return
    setMemberLoading(true)
    setMemberError(false)
    fetchMemberDetail(memberId)
      .then(setMember)
      .catch(() => setMemberError(true))
      .finally(() => setMemberLoading(false))
  }, [memberId])

  useEffect(() => {
    const timeout = window.setTimeout(loadMember, 0)
    return () => window.clearTimeout(timeout)
  }, [loadMember])

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

  async function removeMember() {
    if (!removeTarget || removeTarget.kind !== "member") return
    setRemoving(true)
    try {
      await removeMemberFromOrganization(memberId)
      toast.success(t("iam.team.details.operationSucceeded"))
      setRemoveTarget(null)
      navigate(localizedPath(lang, "/iam/team"))
    } catch {
      toast.error(t("iam.team.details.operationFailed"))
    } finally {
      setRemoving(false)
    }
  }

  function changeTab(tab: TeamDetailTab) {
    navigate(localizedPath(lang, `/iam/team/${memberId}/${tab}`))
  }

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

        <TeamRelationships
          memberId={memberId}
          memberName={memberName}
          lang={lang}
          activeTab={activeTab}
          onTabChange={changeTab}
        />

        <RemoveRelationshipDialog
          target={removeTarget}
          saving={removing}
          onOpenChange={(open) => {
            if (!open) setRemoveTarget(null)
          }}
          onConfirm={removeMember}
        />
      </div>
    </TooltipProvider>
  )
}
