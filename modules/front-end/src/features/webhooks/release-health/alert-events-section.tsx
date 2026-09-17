import { useTranslation } from "react-i18next"
import { BellRing, CheckCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ALERT_PROFILES, alertProfileLabel } from "./alert-contract-samples"
import {
  ALERT_EVENT_CATALOG,
  ALERT_NON_EVENT_REASONS,
} from "./alert-event-catalog"

export function AlertEventsSection() {
  const { t } = useTranslation()
  const h = (key: string) => t(`webhooks.releaseHealth.${key}`)
  return (
    <section className="space-y-3 border-t pt-6">
      <div className="flex items-center gap-2">
        <h3 className="font-medium">{h("supportedEvents")}</h3>
        <Badge variant="secondary">{h("bothIncluded")}</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {ALERT_EVENT_CATALOG.map((event) => (
          <div key={event.type} className="flex gap-3 rounded-lg border p-4">
            {event.type === "alert.triggered" ? (
              <BellRing className="mt-0.5 size-4 shrink-0 text-amber-600" />
            ) : (
              <CheckCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            )}
            <div className="space-y-1.5">
              <p className="font-medium">{h(event.label)}</p>
              <code className="text-xs">{event.type}</code>
              <p className="text-xs leading-5 text-muted-foreground">
                {h(event.help)}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {h("eventsHelp")}
      </p>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          {h("noEventTitle")}
        </summary>
        <dl className="mt-3 space-y-3 text-xs">
          {ALERT_NON_EVENT_REASONS.map((reason) => (
            <div key={reason} className="grid gap-1 sm:grid-cols-[10rem_1fr]">
              <dt className="font-medium">{h(`nonEvents.${reason}.title`)}</dt>
              <dd className="leading-5 text-muted-foreground">
                {h(`nonEvents.${reason}.help`)}
              </dd>
            </div>
          ))}
        </dl>
      </details>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          {h("supportedProfiles")}
        </summary>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {h("profilesHelp")}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {ALERT_PROFILES.map((profile) => (
            <div key={profile.id} className="rounded-md border p-3 text-xs">
              <p className="font-medium">{alertProfileLabel(t, profile)}</p>
              <p className="mt-1 leading-5 text-muted-foreground">
                {h(`profileNotes.${profile.id}`)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {h("rateCombinations")}
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {h("unsupportedResults")}
        </p>
      </details>
    </section>
  )
}
