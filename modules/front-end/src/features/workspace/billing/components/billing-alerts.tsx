import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { BillingSubscription } from "../billing-api"

export type CheckoutState =
  "verifying" | "confirmed" | "timeout" | "cancelled" | null

export function PaymentFailedAlert({
  retryPaymentUrl,
  retryPaymentState,
  isRefreshing,
  onRefresh,
}: {
  retryPaymentUrl?: string | null
  retryPaymentState?: BillingSubscription["retryPaymentState"]
  isRefreshing: boolean
  onRefresh: () => void
}) {
  const { t } = useTranslation()
  const isSyncing = retryPaymentState === "no_open_invoice"
  const canPay =
    Boolean(retryPaymentUrl) &&
    (retryPaymentState === "available" || retryPaymentState === undefined)

  return (
    <Alert
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-md px-5 py-4 text-foreground",
        isSyncing ? "bg-muted/30" : "border-destructive/30 bg-destructive/5"
      )}
    >
      <span className={cn("shrink-0", !isSyncing && "text-destructive")}>
        {isSyncing ? (
          <Info className="h-5 w-5" />
        ) : (
          <AlertCircle className="h-5 w-5" />
        )}
      </span>
      <div className="min-w-0 flex-1 basis-96">
        <AlertTitle className="mb-1 text-sm font-semibold">
          {t(
            isSyncing
              ? "workspace.billing.paymentFailed.syncingTitle"
              : "workspace.billing.paymentFailed.title"
          )}
        </AlertTitle>
        <AlertDescription className="text-sm text-muted-foreground">
          {t(
            isSyncing
              ? "workspace.billing.paymentFailed.syncingDescription"
              : "workspace.billing.paymentFailed.description"
          )}
        </AlertDescription>
        {!isSyncing && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              canPay
                ? "workspace.billing.paymentFailed.returnHint"
                : "workspace.billing.paymentFailed.linkUnavailable"
            )}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {canPay && retryPaymentUrl ? (
          <a
            className={buttonVariants()}
            href={retryPaymentUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("workspace.billing.paymentFailed.payNow")}
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
        <Button
          variant={canPay || isSyncing ? "outline" : "default"}
          disabled={isRefreshing}
          onClick={onRefresh}
        >
          <RefreshCw
            className={cn("h-4 w-4", isRefreshing && "animate-spin")}
          />
          {t(
            isRefreshing
              ? "workspace.billing.paymentFailed.refreshing"
              : canPay || isSyncing
                ? "workspace.billing.paymentFailed.refreshStatus"
                : "workspace.billing.paymentFailed.retryLink"
          )}
        </Button>
      </div>
    </Alert>
  )
}

export function CheckoutAlert({
  state,
  onCheckAgain,
}: {
  state: CheckoutState
  onCheckAgain: () => void
}) {
  const { t } = useTranslation()

  if (!state) {
    return null
  }

  if (state === "confirmed") {
    return (
      <Alert className="rounded-md border-emerald-500/60 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-200">
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>{t("workspace.billing.checkout.confirmed")}</AlertTitle>
      </Alert>
    )
  }

  if (state === "timeout") {
    return (
      <Alert className="rounded-md border-amber-500/60 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t("workspace.billing.checkout.timeoutTitle")}</AlertTitle>
        <AlertDescription className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" onClick={onCheckAgain}>
            {t("workspace.billing.actions.checkAgain")}
          </Button>
          <Button size="sm" variant="outline">
            {t("workspace.billing.actions.returnToBilling")}
          </Button>
          <a
            className={buttonVariants({ variant: "link", size: "sm" })}
            href="mailto:support@featbit.co"
          >
            {t("workspace.billing.actions.contactSupport")}
          </a>
        </AlertDescription>
      </Alert>
    )
  }

  if (state === "cancelled") {
    return (
      <Alert className="rounded-md">
        <Info className="h-4 w-4" />
        <AlertTitle>{t("workspace.billing.checkout.cancelled")}</AlertTitle>
      </Alert>
    )
  }

  return (
    <Alert className="rounded-md">
      <Loader2 className="h-4 w-4 animate-spin" />
      <AlertTitle>{t("workspace.billing.checkout.verifying")}</AlertTitle>
    </Alert>
  )
}

export function UsageAlert({
  percent,
  used,
  purchased,
  exceeded,
  onUpgrade,
}: {
  percent: number
  used: number
  purchased: number
  exceeded: boolean
  onUpgrade: () => void
}) {
  const { t } = useTranslation()
  const usedText = used.toLocaleString()
  const purchasedText = purchased.toLocaleString()

  return (
    <Alert
      className={cn(
        "flex items-center gap-4 rounded-md px-5 py-4",
        exceeded
          ? "border-destructive/60 bg-destructive/5 text-destructive"
          : "border-amber-500/60 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-200"
      )}
    >
      <AlertCircle className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <AlertTitle className="mb-0">
            {exceeded
              ? t("workspace.billing.usageAlert.exceeded")
              : t("workspace.billing.usageAlert.approaching")}
          </AlertTitle>
          <Badge variant="outline" className="bg-background">
            {t("workspace.billing.usageAlert.usedBadge", { percent })}
          </Badge>
        </div>
        <AlertDescription className="mt-1 text-muted-foreground">
          {t("workspace.billing.usageAlert.description", {
            used: usedText,
            purchased: purchasedText,
          })}
        </AlertDescription>
      </div>
      <div className="flex shrink-0 gap-3">
        <Button onClick={onUpgrade}>
          {t("workspace.billing.actions.upgradePlan")}
        </Button>
        <a
          className={buttonVariants({ variant: "outline" })}
          href="mailto:support@featbit.co"
        >
          {t("workspace.billing.actions.contactSupport")}
        </a>
      </div>
    </Alert>
  )
}
