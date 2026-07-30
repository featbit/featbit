import { ArrowLeft, Building2 } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { getSsoAuthorizeUrl, type SsoPreCheck } from "@/features/auth/auth-api"
import type { Lang } from "@/features/auth/auth-page-types"
import { Field } from "@/features/auth/components/form-controls"

export function SsoForm({
  lang,
  preCheck,
}: {
  lang: Lang
  preCheck: SsoPreCheck | null
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const workspaceKeyRef = useRef<HTMLInputElement>(null)
  const [workspaceKey, setWorkspaceKey] = useState(preCheck?.workspaceKey ?? "")
  const [hasError, setHasError] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

  function handleSsoSubmit() {
    setHasError(false)

    const trimmedWorkspaceKey = workspaceKey.trim()
    if (!trimmedWorkspaceKey) {
      setHasError(true)
      workspaceKeyRef.current?.focus()
      return
    }

    setIsRedirecting(true)
    window.location.assign(getSsoAuthorizeUrl(trimmedWorkspaceKey))
  }

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col justify-start px-6 pb-8 sm:px-10 2xl:min-h-[520px] 2xl:px-0">
      <Button
        type="button"
        variant="link"
        className="mb-14 h-auto justify-start gap-3 p-0 text-base"
        onClick={() => navigate(`/${lang}/login`, { replace: true })}
      >
        <ArrowLeft className="size-5" />
        {t("auth.backToSignIn")}
      </Button>

      <div>
        <h2 className="text-3xl font-semibold tracking-tight">
          {t("auth.sso.title")}
        </h2>
        <p className="mt-3 text-base text-muted-foreground">
          {t("auth.sso.subtitle")}
        </p>
      </div>

      <form
        className="mt-14 space-y-8"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          handleSsoSubmit()
        }}
      >
        <Field
          label={t("auth.workspaceKey")}
          placeholder="acme-prod"
          icon={<Building2 className="size-6" />}
          value={workspaceKey}
          readOnly={Boolean(preCheck?.workspaceKey)}
          autoComplete="off"
          name="workspaceKey"
          required
          description={
            preCheck?.workspaceKey
              ? t("auth.sso.configuredWorkspace")
              : undefined
          }
          error={hasError ? t("auth.errors.workspaceKeyRequired") : undefined}
          inputRef={workspaceKeyRef}
          onChange={(event) => {
            setWorkspaceKey(event.target.value)
            setHasError(false)
          }}
        />
        <Button
          className="h-14 w-full gap-3 text-lg"
          type="submit"
          disabled={isRedirecting}
        >
          <Building2 className="size-6" />
          {isRedirecting ? t("auth.redirectingSso") : t("auth.continueSso")}
        </Button>
      </form>
    </div>
  )
}
