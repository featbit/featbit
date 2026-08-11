import { useQuery } from "@tanstack/react-query"
import { ShieldAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Outlet } from "react-router-dom"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentOrganization } from "@/features/layout/layout-context"
import { currentUserPoliciesQueryOptions } from "./current-user-policy-query"
import { canUseAction } from "./current-user-permissions"

const IAM_RESOURCE_RN = "iam/*"
const MANAGE_IAM_ACTION = "CanManageIAM"

export function IamRouteGuard() {
  const { t } = useTranslation()
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
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="mt-3 h-4 w-96" />
        <Skeleton className="mt-10 h-96 w-full" />
      </div>
    )
  }

  if (policiesQuery.isError || !isAllowed) {
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-8">
        <div className="max-w-md text-center">
          <ShieldAlert className="mx-auto mb-4 size-8 text-muted-foreground" />
          <h1 className="text-xl font-semibold">{t("iam.unavailableTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("iam.unavailableDescription")}
          </p>
        </div>
      </div>
    )
  }

  return <Outlet />
}
