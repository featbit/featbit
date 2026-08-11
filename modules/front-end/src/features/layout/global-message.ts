import type { Lang, Workspace } from "@/features/layout/layout-types"
import type {
  BillingCycleUsage,
  BillingSubscription,
} from "@/features/workspace/billing/billing-api"
import { usageStats } from "@/features/workspace/billing/billing-utils"

export type GlobalMessageVariant =
  "info" | "success" | "warning" | "destructive"

export type GlobalMessage = {
  id: string
  variant: GlobalMessageVariant
  lang: Lang
  titleKey: string
  descriptionKey: string
  values?: Record<string, string | number>
}

export function buildBillingGlobalMessages(
  workspace: Workspace | null,
  lang: Lang,
  subscription: BillingSubscription | undefined,
  cycle: BillingCycleUsage | undefined
): GlobalMessage[] {
  if (!workspace) {
    return []
  }

  const stats = usageStats(subscription, cycle)

  if (stats.percent < 90) {
    return []
  }

  return [
    {
      id: `usage-alert-${workspace.id}-${stats.used}-${stats.purchased}`,
      variant: stats.used > stats.purchased ? "destructive" : "warning",
      lang,
      titleKey:
        stats.used > stats.purchased
          ? "layout.globalMessage.usageExceededTitle"
          : "layout.globalMessage.usageApproachingTitle",
      descriptionKey: "layout.globalMessage.usageDescription",
      values: {
        percent: stats.percent,
        used: stats.used.toLocaleString(),
        purchased: stats.purchased.toLocaleString(),
      },
    },
  ]
}
