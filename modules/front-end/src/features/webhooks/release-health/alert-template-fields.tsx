import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Check, Code2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { CodeMirrorTemplateEditor } from "../components/code-mirror-template-editor"
import {
  ALERT_PAYLOAD_TEMPLATE,
  ALERT_TEMPLATE_VARIABLES,
  validateAlertTemplate,
} from "./alert-payload"
import { AlertTemplateVariables } from "./alert-template-variables"
import {
  DEFAULT_ALERT_SAMPLE,
  type AlertSampleOptions,
} from "./alert-contract-samples"

export function AlertTemplateFields({
  type,
  value,
  onChange,
  expanded,
  onExpandedChange,
  onPreview,
}: {
  type: "default" | "custom"
  value: string
  onChange: (type: "default" | "custom", value: string) => void
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onPreview: (sample: AlertSampleOptions) => void
}) {
  const { t } = useTranslation()
  const [sample, setSample] = useState(DEFAULT_ALERT_SAMPLE)
  const [custom, setCustom] = useState(
    type === "custom" ? value : ALERT_PAYLOAD_TEMPLATE
  )
  const error = useMemo(() => validateAlertTemplate(value), [value])
  return (
    <section className="space-y-4 border-t pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-medium">{t("webhooks.sheet.payloadTemplate")}</h3>
        <RadioGroup
          value={type}
          className="flex items-center gap-4"
          onValueChange={(next) => {
            if (next === "default") onChange("default", ALERT_PAYLOAD_TEMPLATE)
            if (next === "custom") onChange("custom", custom)
          }}
        >
          <Label>
            <RadioGroupItem value="default" />
            {t("webhooks.template.default")}
          </Label>
          <Label>
            <RadioGroupItem value="custom" />
            {t("webhooks.template.custom")}
          </Label>
        </RadioGroup>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("webhooks.releaseHealth.templateHelp")}
      </p>
      <CodeMirrorTemplateEditor
        value={value}
        onChange={(next) => {
          if (type !== "custom") return
          setCustom(next)
          onChange("custom", next)
        }}
        readOnly={type === "default"}
        expanded={expanded}
        onExpandedChange={onExpandedChange}
        variables={ALERT_TEMPLATE_VARIABLES}
        validate={validateAlertTemplate}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {t("webhooks.releaseHealth.templateInvalid")}
            <span className="mt-1 block break-all">{error}</span>
          </p>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="size-3.5 text-emerald-600" />
            {t("webhooks.releaseHealth.templateValid")}
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPreview(sample)}
        >
          <Code2 />
          {t("webhooks.releaseHealth.preview")}
        </Button>
      </div>
      <AlertTemplateVariables sample={sample} onSampleChange={setSample} />
    </section>
  )
}
