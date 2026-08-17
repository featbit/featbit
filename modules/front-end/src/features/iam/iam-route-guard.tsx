import { useQuery } from "@tanstack/react-query"
import { CircleAlert, Info, RefreshCw, ShieldAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Outlet } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-6 py-6 lg:px-8">
      <header className="mb-10 space-y-1">
        <h1 className="text-2xl font-semibold tracking-normal">
          {t("iam.pageTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("iam.pageSubtitle")}</p>
      </header>

      <Card className="min-h-[clamp(30rem,66vh,39rem)] gap-0 bg-background py-0 shadow-none">
        <CardContent className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          <div className="flex max-w-xl -translate-y-8 flex-col items-center text-center">
            <div className="flex size-16 items-center justify-center rounded-xl border bg-muted/40 text-foreground">
              {denied ? (
                <ShieldAlert aria-hidden className="size-9 stroke-[1.5]" />
              ) : (
                <CircleAlert aria-hidden className="size-9 stroke-[1.5]" />
              )}
            </div>

            <h2 className="mt-8 text-xl font-semibold tracking-normal">
              {t(denied ? "iam.unavailableTitle" : "iam.loadFailedTitle")}
            </h2>
            <p className="mt-3 max-w-[65ch] text-sm leading-6 text-muted-foreground">
              {t(
                denied
                  ? "iam.unavailableDescription"
                  : "iam.loadFailedDescription"
              )}
            </p>

            {denied ? (
              <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                <Info aria-hidden className="size-4 shrink-0" />
                <span>{t("iam.unavailableNote")}</span>
              </p>
            ) : (
              <Button
                className="mt-7 min-w-28"
                disabled={retrying}
                onClick={onRetry}
              >
                <RefreshCw
                  aria-hidden
                  className={retrying ? "animate-spin" : undefined}
                />
                {t(retrying ? "iam.retrying" : "iam.retry")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
