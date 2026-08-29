import { Activity, Settings2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { localizedPath } from "@/features/layout/layout-context"

export function MonitorThisChangeSection({
  flagKey,
  startsWhen = "saved",
}: {
  flagKey: string
  startsWhen?: "saved" | "applied"
}) {
  const { t } = useTranslation()
  const lang = window.location.pathname.split("/")[1] === "zh" ? "zh" : "en"
  const [mode, setMode] = useState<"none" | "existing" | "quick">("existing")

  return (
    <section className="rounded-md border bg-muted/20 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Activity className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-medium">
              {t("releaseHealth.change.title")}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t(
                startsWhen === "applied"
                  ? "releaseHealth.change.appliedHelp"
                  : "releaseHealth.change.savedHelp"
              )}
            </p>
          </div>
        </div>
        <Badge variant="outline">{t("releaseHealth.designPreview")}</Badge>
      </div>

      <RadioGroup
        value={mode}
        onValueChange={(value) =>
          setMode(value as "none" | "existing" | "quick")
        }
        className="grid gap-2 sm:grid-cols-3"
      >
        {(["none", "existing", "quick"] as const).map((value) => (
          <Label
            key={value}
            className="flex cursor-pointer items-start gap-2 rounded-md border bg-background p-3 font-normal has-[[data-checked]]:border-foreground/30"
          >
            <RadioGroupItem value={value} />
            <span>
              <span className="block text-xs font-medium">
                {t(`releaseHealth.change.options.${value}`)}
              </span>
              <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                {t(`releaseHealth.change.optionHelp.${value}`)}
              </span>
            </span>
          </Label>
        ))}
      </RadioGroup>

      {mode !== "none" ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            {mode === "existing"
              ? t("releaseHealth.change.existingSummary")
              : t("releaseHealth.change.quickSummary")}
          </p>
          <Button
            nativeButton={false}
            type="button"
            variant="ghost"
            size="sm"
            render={
              <a
                href={localizedPath(
                  lang,
                  `/feature-flags/${encodeURIComponent(flagKey)}/release-health`
                )}
              />
            }
          >
            <Settings2 />
            {t("releaseHealth.change.configure")}
          </Button>
        </div>
      ) : null}

      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
        {t("releaseHealth.change.prototypeNotice")}
      </p>
    </section>
  )
}
