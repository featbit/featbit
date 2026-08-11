import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import type {
  BillingCycle,
  BillingSubscription,
  SubscriptionChangePayload,
} from "../billing-api"
import {
  FINE_GRAINED_ACCESS,
  formatMoneyPerCycle,
  normalizePlan,
  planMeta,
  planRank,
  planTotal,
  type DrawerIntent,
  type PlanKey,
  type UsageStats,
} from "../billing-utils"
import { FeeLine } from "./billing-display"

const FINE_GRAINED_ACCESS_PRICE = 60

const planFeatureKeys: Record<PlanKey, string[]> = {
  free: [
    "mau1k",
    "coreFeatureFlags",
    "advancedTargeting",
    "unlimitedProjects",
    "webhooksIntegrations",
    "auditLogs",
    "basicRbac",
    "communitySupport",
  ],
  pro: ["mau10k", "prioritySupport"],
  growth: [
    "mau40k",
    "flagChangeApproval",
    "flagChangeScheduling",
    "flagComparison",
  ],
  enterprise: [
    "mau80k",
    "privateDiscord",
    "replySla12h",
    "replySla4h",
    "dedicatedSlaSupport",
    "dedicatedOnboardingTraining",
    "singleSignOn",
    "multiOrganization",
    "globalUsersShareableSegments",
    "autoAgents",
  ],
}

export function PricingDrawer({
  open,
  intent,
  subscription,
  stats,
  onOpenChange,
  onStartChange,
}: {
  open: boolean
  intent: DrawerIntent
  subscription?: BillingSubscription
  stats: UsageStats
  onOpenChange: (open: boolean) => void
  onStartChange: (payload: SubscriptionChangePayload) => void
}) {
  const { t } = useTranslation()
  const currentPlan = normalizePlan(subscription?.plan)
  const currentMau = subscription?.mau ?? planMeta[currentPlan].includedMau
  const currentFineGrained =
    subscription?.addOnFeatures?.includes(FINE_GRAINED_ACCESS) ?? false
  const currentIsLocal = subscription?.isLocal ?? false
  const [planMau, setPlanMau] = useState<Record<PlanKey, number>>({
    free: planMeta.free.includedMau,
    pro: currentPlan === "pro" ? currentMau : planMeta.pro.includedMau,
    growth: currentPlan === "growth" ? currentMau : planMeta.growth.includedMau,
    enterprise:
      currentPlan === "enterprise"
        ? currentMau
        : planMeta.enterprise.includedMau,
  })
  const [fineGrainedByPlan, setFineGrainedByPlan] = useState<
    Record<PlanKey, boolean>
  >({
    free: false,
    pro: false,
    growth: currentPlan === "growth" ? currentFineGrained : false,
    enterprise: currentPlan === "enterprise" ? currentFineGrained : false,
  })
  const billingCycle = normalizeBillingCycle(subscription?.billingCycle)
  const [enterpriseBillingCycle, setEnterpriseBillingCycle] =
    useState<BillingCycle>(
      currentPlan === "enterprise" ? billingCycle : "monthly"
    )
  const selectedMau = planMau[currentPlan]
  const fineGrained = fineGrainedByPlan[currentPlan]
  const handleMauChange = (plan: PlanKey, mau: number) =>
    setPlanMau((value) => ({ ...value, [plan]: mau }))
  const handleFineGrainedChange = (plan: PlanKey, checked: boolean) =>
    setFineGrainedByPlan((value) => ({ ...value, [plan]: checked }))

  const title =
    intent === "upgrade"
      ? t("workspace.billing.drawer.upgradeTitle")
      : t("workspace.billing.drawer.manageTitle")
  const description =
    intent === "upgrade"
      ? t("workspace.billing.drawer.upgradeDescription")
      : t("workspace.billing.drawer.manageDescription")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="!w-full overflow-y-auto p-0 sm:!max-w-[64rem]">
        <div className="border-b px-6 py-5">
          <SheetHeader>
            <div className="flex items-start justify-between gap-4 pr-12">
              <div>
                <SheetTitle className="text-2xl">{title}</SheetTitle>
                <SheetDescription>{description}</SheetDescription>
              </div>
              {intent === "upgrade" ? (
                <a
                  className={buttonVariants({ variant: "outline" })}
                  href="mailto:support@featbit.co"
                >
                  {t("workspace.billing.actions.contactSupport")}
                </a>
              ) : null}
            </div>
          </SheetHeader>
        </div>
        <div className="space-y-4 p-6">
          {intent === "upgrade" ? (
            <div className="flex items-center justify-between rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
              <div>
                <div className="font-semibold">
                  {t("workspace.billing.drawer.approachingLimit")}
                </div>
                <div className="text-sm">
                  {t("workspace.billing.drawer.currentCapacity", {
                    used: stats.used.toLocaleString(),
                    purchased: stats.purchased.toLocaleString(),
                    percent: stats.percent,
                  })}
                </div>
              </div>
              <Badge variant="outline" className="bg-background">
                {t("workspace.billing.overview.remaining", {
                  remaining: stats.remaining.toLocaleString(),
                })}
              </Badge>
            </div>
          ) : null}

          {intent === "upgrade" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <RecommendationCard
                label={t("workspace.billing.drawer.fastestFix")}
                title={t("workspace.billing.drawer.addCapacity", {
                  plan: t(planMeta[currentPlan].nameKey),
                })}
                description={t(
                  "workspace.billing.drawer.addCapacityDescription"
                )}
                selectedMau={selectedMau}
                setSelectedMau={(mau) => handleMauChange(currentPlan, mau)}
                fineGrained={fineGrained}
                setFineGrained={(checked) =>
                  handleFineGrainedChange(currentPlan, checked)
                }
                actionLabel={t("workspace.billing.actions.updatePlan")}
                highlighted
                onAction={() =>
                  onStartChange({
                    plan: currentPlan,
                    billingCycle,
                    mau: selectedMau,
                    addOnFeatures: fineGrained ? [FINE_GRAINED_ACCESS] : [],
                  })
                }
              />
              <EnterpriseRecommendation
                onAction={() =>
                  onStartChange({
                    plan: "enterprise",
                    billingCycle,
                    mau: 80000,
                    addOnFeatures: [FINE_GRAINED_ACCESS],
                  })
                }
              />
            </div>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                {(["free", "pro", "growth"] as const).map((key) => (
                  <PlanCard
                    key={key}
                    planKey={key}
                    currentPlan={currentPlan}
                    billingCycle="monthly"
                    currentSubscriptionMau={currentMau}
                    currentSubscriptionFineGrained={currentFineGrained}
                    currentSubscriptionIsLocal={currentIsLocal}
                    selectedMau={planMau[key]}
                    fineGrained={fineGrainedByPlan[key]}
                    onMauChange={(mau) => handleMauChange(key, mau)}
                    onFineGrainedChange={(checked) =>
                      handleFineGrainedChange(key, checked)
                    }
                    onAction={(payload) => onStartChange(payload)}
                  />
                ))}
              </div>
              <EnterpriseRow
                currentPlan={currentPlan}
                currentSubscriptionMau={currentMau}
                currentSubscriptionFineGrained={currentFineGrained}
                currentSubscriptionIsLocal={currentIsLocal}
                currentSubscriptionBillingCycle={billingCycle}
                selectedBillingCycle={enterpriseBillingCycle}
                selectedMau={planMau.enterprise}
                fineGrained={fineGrainedByPlan.enterprise}
                onMauChange={(mau) => handleMauChange("enterprise", mau)}
                onFineGrainedChange={(checked) =>
                  handleFineGrainedChange("enterprise", checked)
                }
                onBillingCycleChange={setEnterpriseBillingCycle}
                onAction={(payload) => onStartChange(payload)}
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function PlanCard({
  planKey,
  currentPlan,
  billingCycle,
  currentSubscriptionMau,
  currentSubscriptionFineGrained,
  currentSubscriptionIsLocal,
  selectedMau,
  fineGrained,
  onMauChange,
  onFineGrainedChange,
  onAction,
}: {
  planKey: PlanKey
  currentPlan: PlanKey
  billingCycle: BillingCycle
  currentSubscriptionMau: number
  currentSubscriptionFineGrained: boolean
  currentSubscriptionIsLocal: boolean
  selectedMau: number
  fineGrained: boolean
  onMauChange: (mau: number) => void
  onFineGrainedChange: (checked: boolean) => void
  onAction: (payload: SubscriptionChangePayload) => void
}) {
  const meta = planMeta[planKey]
  const { t } = useTranslation()
  const isCurrent = planKey === currentPlan
  const supportsFineGrained = planKey === "growth" || planKey === "enterprise"
  const canUpdateCurrent =
    isCurrent &&
    (selectedMau !== currentSubscriptionMau ||
      (supportsFineGrained && fineGrained !== currentSubscriptionFineGrained) ||
      (planKey !== "free" && currentSubscriptionIsLocal))
  const actionLabel = isCurrent
    ? canUpdateCurrent
      ? t("workspace.billing.actions.updatePlan")
      : t("workspace.billing.actions.currentPlan")
    : planRank(planKey) > planRank(currentPlan)
      ? t("workspace.billing.actions.upgradeTo", { plan: t(meta.nameKey) })
      : t("workspace.billing.actions.downgradeTo", { plan: t(meta.nameKey) })
  const showMauSlider = planKey !== "free"
  const addOnFeatures =
    supportsFineGrained && fineGrained ? [FINE_GRAINED_ACCESS] : []
  const total = planTotal({
    plan: planKey,
    billingCycle,
    mau: selectedMau,
    addOnFeatures,
  })

  return (
    <Card
      className={cn(
        "relative flex min-h-[31rem] flex-col overflow-hidden rounded-md p-4 shadow-none transition-shadow",
        isCurrent && "border-primary shadow-sm"
      )}
    >
      {isCurrent ? (
        <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
      ) : null}
      <div className="flex items-start justify-between">
        <h3 className="text-xl font-semibold">{t(meta.nameKey)}</h3>
        {isCurrent ? (
          <Badge className="bg-primary px-2.5 py-0.5 text-primary-foreground shadow-sm">
            {t("workspace.billing.actions.currentPlan")}
          </Badge>
        ) : null}
      </div>
      <p className="mt-2 min-h-10 text-sm text-muted-foreground">
        {t(meta.descriptionKey)}
      </p>
      <div className="mt-1 text-2xl font-semibold">
        {formatMoneyPerCycle(total, billingCycle)}
      </div>
      {showMauSlider ? (
        <MauSliderSection
          className="mt-5"
          min={meta.includedMau}
          max={300000}
          value={selectedMau}
          onChange={onMauChange}
        />
      ) : null}
      <div className="mt-4 space-y-3 text-sm text-muted-foreground">
        <PlanFeatureList planKey={planKey} />
        {supportsFineGrained ? (
          <label className="flex items-center gap-2 border-t pt-3 text-foreground">
            <Checkbox
              checked={fineGrained}
              onCheckedChange={(checked) =>
                onFineGrainedChange(checked === true)
              }
            />
            <span className="flex flex-1 items-center justify-between gap-2">
              <span className="whitespace-nowrap">
                {t("workspace.billing.drawer.fineGrainedAccess")}
              </span>
              <span className="whitespace-nowrap text-muted-foreground">
                {t("workspace.billing.drawer.addOnPrice", {
                  amount: `$${FINE_GRAINED_ACCESS_PRICE}`,
                })}
              </span>
            </span>
          </label>
        ) : null}
      </div>
      <Button
        className="mt-auto"
        disabled={isCurrent && !canUpdateCurrent}
        onClick={() =>
          onAction({
            plan: planKey,
            billingCycle,
            mau: selectedMau,
            addOnFeatures,
          })
        }
      >
        {actionLabel}
      </Button>
    </Card>
  )
}

function normalizeBillingCycle(cycle?: BillingCycle): BillingCycle {
  return cycle === "year" || cycle === "yearly" ? "yearly" : "monthly"
}

function EnterpriseRow({
  currentPlan,
  currentSubscriptionMau,
  currentSubscriptionFineGrained,
  currentSubscriptionIsLocal,
  currentSubscriptionBillingCycle,
  selectedBillingCycle,
  selectedMau,
  fineGrained,
  onMauChange,
  onFineGrainedChange,
  onBillingCycleChange,
  onAction,
}: {
  currentPlan: PlanKey
  currentSubscriptionMau: number
  currentSubscriptionFineGrained: boolean
  currentSubscriptionIsLocal: boolean
  currentSubscriptionBillingCycle: BillingCycle
  selectedBillingCycle: BillingCycle
  selectedMau: number
  fineGrained: boolean
  onMauChange: (mau: number) => void
  onFineGrainedChange: (checked: boolean) => void
  onBillingCycleChange: (cycle: BillingCycle) => void
  onAction: (payload: SubscriptionChangePayload) => void
}) {
  const { t } = useTranslation()
  const isCurrent = currentPlan === "enterprise"
  const canUpdateCurrent =
    isCurrent &&
    (selectedMau !== currentSubscriptionMau ||
      fineGrained !== currentSubscriptionFineGrained ||
      selectedBillingCycle !== currentSubscriptionBillingCycle ||
      currentSubscriptionIsLocal)
  const addOnFeatures = fineGrained ? [FINE_GRAINED_ACCESS] : []
  const total = planTotal({
    plan: "enterprise",
    billingCycle: selectedBillingCycle,
    mau: selectedMau,
    addOnFeatures,
  })
  const actionLabel = isCurrent
    ? canUpdateCurrent
      ? t("workspace.billing.actions.updatePlan")
      : t("workspace.billing.actions.currentPlan")
    : t("workspace.billing.drawer.upgradeEnterprise")

  return (
    <Card
      className={cn(
        "relative grid overflow-hidden rounded-md p-4 shadow-none transition-shadow lg:grid-cols-[20rem_1fr] lg:items-start",
        isCurrent ? "gap-5 border-primary shadow-sm" : "gap-5"
      )}
    >
      {isCurrent ? (
        <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
      ) : null}
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center gap-2">
          {isCurrent ? (
            <Badge className="bg-primary px-2.5 py-0.5 text-primary-foreground shadow-sm">
              {t("workspace.billing.actions.currentPlan")}
            </Badge>
          ) : null}
        </div>
        <h3 className={cn("text-xl font-semibold", isCurrent && "mt-3")}>
          {t(planMeta.enterprise.nameKey)}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(planMeta.enterprise.descriptionKey)}
        </p>
        <div className="mt-1 text-2xl font-semibold">
          {formatMoneyPerCycle(total, selectedBillingCycle)}
        </div>
        <div className="mt-3 inline-flex w-fit overflow-hidden rounded-md border">
          <Button
            type="button"
            variant={selectedBillingCycle === "monthly" ? "default" : "ghost"}
            size="xs"
            className={cn(
              "rounded-none",
              selectedBillingCycle === "monthly" && "pointer-events-none"
            )}
            onClick={() => onBillingCycleChange("monthly")}
          >
            {t("workspace.billing.drawer.monthly")}
          </Button>
          <Button
            type="button"
            variant={selectedBillingCycle === "yearly" ? "default" : "ghost"}
            size="xs"
            className={cn(
              "rounded-none border-l",
              selectedBillingCycle === "yearly" && "pointer-events-none"
            )}
            onClick={() => onBillingCycleChange("yearly")}
          >
            {t("workspace.billing.drawer.yearly")}
          </Button>
        </div>
        <label className="mt-5 flex items-center gap-2 border-t pt-4 text-sm text-foreground">
          <Checkbox
            checked={fineGrained}
            onCheckedChange={(checked) => onFineGrainedChange(checked === true)}
          />
          <span className="flex flex-1 items-center justify-between gap-2">
            <span className="whitespace-nowrap">
              {t("workspace.billing.drawer.fineGrainedAccess")}
            </span>
            <span className="whitespace-nowrap text-muted-foreground">
              {t("workspace.billing.drawer.addOnPrice", {
                amount: `$${FINE_GRAINED_ACCESS_PRICE}`,
              })}
            </span>
          </span>
        </label>
        <Button
          className="mt-5 w-full"
          disabled={isCurrent && !canUpdateCurrent}
          onClick={() =>
            onAction({
              plan: "enterprise",
              billingCycle: selectedBillingCycle,
              mau: selectedMau,
              addOnFeatures,
            })
          }
        >
          {actionLabel}
        </Button>
      </div>
      <div className="space-y-4 text-sm text-muted-foreground">
        <MauSliderSection
          min={planMeta.enterprise.includedMau}
          max={300000}
          value={selectedMau}
          onChange={onMauChange}
        />
        <PlanFeatureList planKey="enterprise" columns />
      </div>
    </Card>
  )
}

function MauSliderSection({
  className,
  min,
  max,
  value,
  onChange,
}: {
  className?: string
  min: number
  max: number
  value: number
  onChange: (value: number) => void
}) {
  const { t } = useTranslation()

  return (
    <div className={cn("border-y py-3", className)}>
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{t("workspace.billing.drawer.monthlyActiveUsers")}</span>
        <strong className="font-semibold text-foreground">
          {formatMau(value)} MAU
        </strong>
      </div>
      <Slider
        min={min}
        max={max}
        step={10000}
        value={[value]}
        onValueChange={(nextValue) =>
          onChange(Array.isArray(nextValue) ? nextValue[0] : nextValue)
        }
      />
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{formatMau(min)}</span>
        <span>{formatMau(max)}</span>
      </div>
    </div>
  )
}

function formatMau(value: number) {
  return value >= 1000 ? `${value / 1000}K` : `${value}`
}

function PlanFeatureList({
  planKey,
  columns = false,
}: {
  planKey: PlanKey
  columns?: boolean
}) {
  const { t } = useTranslation()

  return (
    <ul
      className={cn(
        "space-y-2",
        columns && "grid space-y-0 gap-x-4 gap-y-2 sm:grid-cols-2"
      )}
    >
      {planFeatureKeys[planKey].map((featureKey) => (
        <li
          key={featureKey}
          className="flex items-start gap-2 text-sm text-muted-foreground"
        >
          <Check
            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <span>{t(`workspace.billing.drawer.features.${featureKey}`)}</span>
        </li>
      ))}
    </ul>
  )
}

function RecommendationCard({
  label,
  title,
  description,
  selectedMau,
  setSelectedMau,
  fineGrained,
  setFineGrained,
  actionLabel,
  highlighted,
  onAction,
}: {
  label: string
  title: string
  description: string
  selectedMau: number
  setSelectedMau: (mau: number) => void
  fineGrained: boolean
  setFineGrained: (checked: boolean) => void
  actionLabel: string
  highlighted?: boolean
  onAction: () => void
}) {
  const { t } = useTranslation()
  const total = planTotal({
    plan: "growth",
    billingCycle: "monthly",
    mau: selectedMau,
    addOnFeatures: fineGrained ? [FINE_GRAINED_ACCESS] : [],
  })
  return (
    <Card
      className={cn(
        "rounded-md p-4 shadow-none",
        highlighted && "border-blue-500 bg-blue-50/40 dark:bg-blue-950/20"
      )}
    >
      <Badge
        variant="outline"
        className="border-blue-200 bg-blue-50 text-blue-700"
      >
        {label}
      </Badge>
      <h3 className="mt-4 text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-muted-foreground">{description}</p>
      <p className="mt-6 text-sm text-muted-foreground">
        {t("workspace.billing.drawer.selectedMau")}
      </p>
      <div className="text-3xl font-semibold">
        {selectedMau.toLocaleString()}
      </div>
      <Slider
        className="mt-3"
        min={40000}
        max={300000}
        step={10000}
        value={[selectedMau]}
        onValueChange={(value) =>
          setSelectedMau(Array.isArray(value) ? value[0] : value)
        }
      />
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{t("workspace.billing.drawer.includedMau", { mau: "40K" })}</span>
        <span>
          +{Math.max(selectedMau - 40000, 0) / 1000}K{" "}
          {t("workspace.billing.drawer.extendedMau")}
        </span>
      </div>
      <div className="mt-4 rounded-md border text-sm">
        <FeeLine
          label={t("workspace.billing.drawer.growthBase")}
          value={t("workspace.billing.overview.perMonth", { amount: "$149" })}
        />
        <FeeLine
          label={t("workspace.billing.drawer.extendedMau")}
          value={t("workspace.billing.overview.plusPerMonth", {
            amount: `$${Math.max((selectedMau - 40000) / 10000, 0) * 20}`,
          })}
        />
        <FeeLine
          label={t("workspace.billing.overview.fineGrained")}
          value={
            fineGrained
              ? t("workspace.billing.overview.plusPerMonth", { amount: "$60" })
              : t("workspace.billing.overview.perMonth", { amount: "$0" })
          }
        />
        <FeeLine
          label={t("workspace.billing.drawer.projectedTotal")}
          value={t("workspace.billing.overview.perMonth", {
            amount: `$${total}`,
          })}
          strong
        />
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <Checkbox
          checked={fineGrained}
          onCheckedChange={(checked) => setFineGrained(checked === true)}
        />
        <span className="whitespace-nowrap">
          {t("workspace.billing.drawer.fineGrainedAccess")}
        </span>
      </label>
      <Button className="mt-4 w-full" onClick={onAction}>
        {actionLabel}
      </Button>
    </Card>
  )
}

function EnterpriseRecommendation({ onAction }: { onAction: () => void }) {
  const { t } = useTranslation()

  return (
    <Card className="rounded-md p-4 shadow-none">
      <Badge
        variant="outline"
        className="border-blue-200 bg-blue-50 text-blue-700"
      >
        {t("workspace.billing.drawer.moreFeatures")}
      </Badge>
      <h3 className="mt-4 text-xl font-semibold">
        {t("workspace.billing.drawer.upgradeEnterprise")}
      </h3>
      <p className="mt-2 text-muted-foreground">
        {t("workspace.billing.drawer.enterpriseDescription")}
      </p>
      <p className="mt-6 text-sm text-muted-foreground">
        {t("workspace.billing.drawer.startingCapacity")}
      </p>
      <div className="text-3xl font-semibold">80,000</div>
      <div className="mt-3 h-2 rounded-full bg-muted">
        <div className="h-full w-3/4 rounded-full bg-blue-600" />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{t("workspace.billing.drawer.includedMau", { mau: "80K" })}</span>
        <span>{t("workspace.billing.drawer.upTo", { mau: "300K" })}</span>
      </div>
      <div className="mt-4 rounded-md border text-sm">
        <FeeLine
          label={t("workspace.billing.drawer.enterpriseMonthly")}
          value={t("workspace.billing.overview.perMonth", { amount: "$449" })}
        />
        <FeeLine
          label={t("workspace.billing.drawer.yearlyOption")}
          value={t("workspace.billing.drawer.enterpriseYearly")}
        />
        <FeeLine
          label={t("workspace.billing.drawer.includedFeatures")}
          value={t("workspace.billing.drawer.enterpriseFeatures")}
        />
        <FeeLine
          label={t("workspace.billing.drawer.support")}
          value={t("workspace.billing.drawer.dedicatedSla")}
        />
      </div>
      <Button className="mt-4 w-full" onClick={onAction}>
        {t("workspace.billing.drawer.upgradeEnterprise")}
      </Button>
    </Card>
  )
}
