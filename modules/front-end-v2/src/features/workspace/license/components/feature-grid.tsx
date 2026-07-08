import { CheckCircle2, MinusCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type {
  DecodedLicense,
  LicenseFeature,
  LicenseStatus,
} from "@/features/workspace/license/license-types"
import { isFeatureGranted } from "@/features/workspace/license/license-utils"

const featureCatalog: LicenseFeature[] = [
  {
    id: "sso",
    labelKey: "workspace.license.features.sso.title",
    descriptionKey: "workspace.license.features.sso.description",
  },
  {
    id: "schedule",
    labelKey: "workspace.license.features.schedule.title",
    descriptionKey: "workspace.license.features.schedule.description",
  },
  {
    id: "change-request",
    labelKey: "workspace.license.features.changeRequest.title",
    descriptionKey: "workspace.license.features.changeRequest.description",
  },
  {
    id: "multi-organization",
    labelKey: "workspace.license.features.multiOrganization.title",
    descriptionKey: "workspace.license.features.multiOrganization.description",
  },
  {
    id: "global-user",
    labelKey: "workspace.license.features.globalUsers.title",
    descriptionKey: "workspace.license.features.globalUsers.description",
  },
  {
    id: "shareable-segment",
    labelKey: "workspace.license.features.shareableSegment.title",
    descriptionKey: "workspace.license.features.shareableSegment.description",
  },
  {
    id: "auto-agents",
    labelKey: "workspace.license.features.autoAgents.title",
    descriptionKey: "workspace.license.features.autoAgents.description",
  },
  {
    id: "fine-grained-ac",
    labelKey: "workspace.license.features.fineGrainedAccessControl.title",
    descriptionKey:
      "workspace.license.features.fineGrainedAccessControl.description",
  },
  {
    id: "flag-comparison",
    labelKey: "workspace.license.features.flagComparison.title",
    descriptionKey: "workspace.license.features.flagComparison.description",
  },
]

export function FeatureGrid({
  license,
  status,
}: {
  license: DecodedLicense | null
  status: LicenseStatus
}) {
  const { t } = useTranslation()

  return (
    <section className="pt-6">
      <h2 className="text-lg font-semibold tracking-normal">
        {t("workspace.license.licensedFeatures")}
      </h2>
      <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] gap-2.5">
        {featureCatalog.map((feature) => {
          const granted = isFeatureGranted(feature, license, status)
          const FeatureIcon = granted ? CheckCircle2 : MinusCircle

          return (
            <Card
              key={feature.id}
              className={cn(
                "rounded-md",
                !granted &&
                  "border-dashed bg-muted/30 text-muted-foreground shadow-none dark:bg-muted/15"
              )}
            >
              <CardContent className="flex min-h-12 items-center gap-2.5 px-3 py-2">
                <FeatureIcon
                  className={cn(
                    "size-4 shrink-0",
                    granted ? "text-emerald-500" : "text-muted-foreground/70"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <h3
                    className={cn(
                      "text-sm leading-5 font-medium",
                      !granted && "text-muted-foreground"
                    )}
                  >
                    {t(feature.labelKey)}
                  </h3>
                  <p className="truncate text-xs leading-4 text-muted-foreground">
                    {t(feature.descriptionKey)}
                  </p>
                </div>
                <Badge
                  variant={granted ? "secondary" : "outline"}
                  className="shrink-0"
                >
                  {granted
                    ? t("workspace.license.granted")
                    : t("workspace.license.notIncluded")}
                </Badge>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
