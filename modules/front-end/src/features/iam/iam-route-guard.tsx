import { useQuery } from "@tanstack/react-query"
import { CircleAlert, ShieldAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Outlet } from "react-router-dom"
import { UnavailablePage } from "@/components/unavailable-page"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentOrganization } from "@/features/layout/layout-context"
import { currentUserPoliciesQueryOptions } from "./current-user-policy-query"
import { canUseAction } from "./current-user-permissions"

const IAM_RESOURCE_RN = "iam/*"
const MANAGE_IAM_ACTION = "CanManageIAM"

export function IamRouteGuard() {
  const organizationId = getCurrentOrganization()?.id ?? ""
  const policiesQuery = useQuery(
    currentUserPoliciesQueryOptions(organizationId)
  )
  const isAllowed = canUseAction(
    policiesQuery.data ?? [],
    IAM_RESOURCE_RN,
    MANAGE_IAM_ACTION
  )
  if (policiesQuery.isPending) {
    return (
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-6 py-6 lg:px-8">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="mt-3 h-4 w-96" />
        <Skeleton className="mt-10 min-h-[clamp(30rem,66vh,39rem)] w-full rounded-xl" />
      </div>
    )
  }

  if (policiesQuery.isError) {
    return (
      <IamUnavailablePage
        variant="error"
        retrying={policiesQuery.isFetching}
        onRetry={() => void policiesQuery.refetch()}
      />
    )
  }

  if (!isAllowed) return <IamUnavailablePage variant="denied" />

  return <Outlet />
}

function IamUnavailablePage({
  variant,
  retrying = false,
  onRetry,
}: {
  variant: "denied" | "error"
  retrying?: boolean
  onRetry?: () => void
}) {
  const { t } = useTranslation()
  const denied = variant === "denied"

  return (
    <UnavailablePage
      pageTitle={t("iam.pageTitle")}
      pageSubtitle={t("iam.pageSubtitle")}
      icon={denied ? ShieldAlert : CircleAlert}
      title={t(denied ? "iam.unavailableTitle" : "iam.loadFailedTitle")}
      description={t(
        denied ? "iam.unavailableDescription" : "iam.loadFailedDescription"
      )}
      note={denied ? t("iam.unavailableNote") : undefined}
      retry={
        denied || !onRetry
          ? undefined
          : {
              label: t("iam.retry"),
              pendingLabel: t("iam.retrying"),
              pending: retrying,
              onRetry,
            }
      }
    />
  )
}
