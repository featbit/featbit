import {
  BarChart3,
  FlaskConical,
  GalleryVerticalEnd,
  type LucideIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

type ReleaseDecisionPageKind = "experiments" | "metrics" | "layers"

const pageIcons: Record<ReleaseDecisionPageKind, LucideIcon> = {
  experiments: FlaskConical,
  metrics: BarChart3,
  layers: GalleryVerticalEnd,
}

function ReleaseDecisionComingSoonPage({
  kind,
}: {
  kind: ReleaseDecisionPageKind
}) {
  const { t } = useTranslation()
  const Icon = pageIcons[kind]
  const headingId = `${kind}-coming-soon-title`

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-6 py-6 lg:px-8">
      <header className="mb-10 space-y-1">
        <h1 className="text-2xl font-semibold tracking-normal">
          {t(`releaseDecision.${kind}.title`)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(`releaseDecision.${kind}.subtitle`)}
        </p>
      </header>

      <Card className="min-h-[clamp(30rem,66vh,39rem)] gap-0 bg-background py-0 shadow-none">
        <CardContent className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          <section
            className="flex -translate-y-8 flex-col items-center text-center"
            aria-labelledby={headingId}
          >
            <div className="flex size-24 items-center justify-center rounded-2xl bg-muted text-foreground">
              <Icon className="size-12" strokeWidth={1.75} aria-hidden="true" />
            </div>

            <Badge
              variant="secondary"
              className="mt-8 h-9 rounded-lg px-5 text-base font-normal"
            >
              {t("releaseDecision.status")}
            </Badge>

            <h2
              id={headingId}
              className="mt-8 text-2xl font-semibold tracking-normal"
            >
              {t(`releaseDecision.${kind}.comingSoon`)}
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              {t(`releaseDecision.${kind}.description`)}
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}

export function ExperimentsPage() {
  return <ReleaseDecisionComingSoonPage kind="experiments" />
}

export function MetricsPage() {
  return <ReleaseDecisionComingSoonPage kind="metrics" />
}

export function LayersPage() {
  return <ReleaseDecisionComingSoonPage kind="layers" />
}
