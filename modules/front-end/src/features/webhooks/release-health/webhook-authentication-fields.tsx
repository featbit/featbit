import { useId, useState } from "react"
import type { FieldErrors } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Eye, EyeOff, LockKeyhole, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { WebhookAuthentication } from "./webhook-authentication"

export function WebhookAuthenticationFields({
  headers,
  secret,
  onHeadersChange,
  onSecretChange,
  errors,
  disabled,
  hasHeaders,
  hasSecret,
  removeSavedHeaders,
  removeSavedSecret,
  onRemoveSavedHeaders,
  onRemoveSavedSecret,
}: WebhookAuthentication & {
  onHeadersChange: (headers: WebhookAuthentication["headers"]) => void
  onSecretChange: (secret: string) => void
  errors: FieldErrors<WebhookAuthentication>
  disabled: boolean
  hasHeaders: boolean
  hasSecret: boolean
  removeSavedHeaders: boolean
  removeSavedSecret: boolean
  onRemoveSavedHeaders: (remove: boolean) => void
  onRemoveSavedSecret: (remove: boolean) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const setHeader = (index: number, field: "key" | "value", value: string) =>
    onHeadersChange(
      headers.map((header, i) =>
        i === index ? { ...header, [field]: value } : header
      )
    )
  return (
    <section className="space-y-4 border-t pt-6">
      <h3 className="flex items-center gap-2 font-medium">
        <LockKeyhole className="size-4" />
        {t("webhooks.releaseHealth.authentication")}
      </h3>
      <p className="text-sm text-muted-foreground">
        {t("webhooks.releaseHealth.authenticationHelp")}
      </p>
      <fieldset disabled={disabled} className="space-y-5">
        <div className="space-y-3">
          <Label>{t("webhooks.sheet.customHeaders")}</Label>
          {hasHeaders && (
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                {t(
                  `webhooks.releaseHealth.${removeSavedHeaders ? "headersWillRemove" : "headersConfigured"}`
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onRemoveSavedHeaders(!removeSavedHeaders)}
              >
                {t(
                  `webhooks.releaseHealth.${removeSavedHeaders ? "keepSavedHeaders" : "removeSavedHeaders"}`
                )}
              </Button>
            </div>
          )}
          <div className="space-y-3 rounded-lg border p-3">
            {headers.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("webhooks.releaseHealth.noCustomHeaders")}
              </p>
            )}
            {headers.map((header, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  {(["key", "value"] as const).map((field) => {
                    const inputId = `${id}-${index}-${field}`
                    const error = errors.headers?.[index]?.[field]?.message
                    return (
                      <div key={field} className="space-y-2">
                        <Label htmlFor={inputId}>
                          {t(
                            `webhooks.sheet.${field === "key" ? "headerName" : "headerValue"}`
                          )}
                        </Label>
                        <Input
                          id={inputId}
                          value={header[field]}
                          autoComplete="off"
                          spellCheck={false}
                          aria-label={t(
                            `webhooks.releaseHealth.${field === "key" ? "headerNameLabel" : "headerValueLabel"}`,
                            { number: index + 1 }
                          )}
                          aria-invalid={Boolean(error)}
                          aria-describedby={
                            error ? `${inputId}-error` : undefined
                          }
                          placeholder={
                            field === "key" ? "Authorization" : "Bearer …"
                          }
                          onChange={(event) =>
                            setHeader(index, field, event.target.value)
                          }
                        />
                        {error && (
                          <p
                            id={`${inputId}-error`}
                            role="alert"
                            className="text-xs text-destructive"
                          >
                            {t(error)}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="mt-6"
                  aria-label={t("webhooks.releaseHealth.removeHeaderLabel", {
                    number: index + 1,
                  })}
                  onClick={() =>
                    onHeadersChange(headers.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onHeadersChange([...headers, { key: "", value: "" }])
            }
          >
            <Plus />
            {t("webhooks.sheet.addHeader")}
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-secret`}>{t("webhooks.sheet.secret")}</Label>
          {hasSecret && (
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                {t(
                  `webhooks.releaseHealth.${removeSavedSecret ? "secretWillRemove" : "secretConfigured"}`
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onRemoveSavedSecret(!removeSavedSecret)}
              >
                {t(
                  `webhooks.releaseHealth.${removeSavedSecret ? "keepSavedSecret" : "removeSavedSecret"}`
                )}
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              id={`${id}-secret`}
              type={revealed ? "text" : "password"}
              value={secret}
              autoComplete="new-password"
              spellCheck={false}
              onChange={(event) => onSecretChange(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("webhooks.sheet.toggleSecret")}
              aria-pressed={revealed}
              onClick={() => setRevealed(!revealed)}
            >
              {revealed ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("webhooks.releaseHealth.secretHelp")}
          </p>
        </div>
      </fieldset>
      <p className="text-xs text-muted-foreground">
        {t("webhooks.releaseHealth.authenticationPreviewHelp")}
      </p>
    </section>
  )
}
