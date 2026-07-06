import { Navigate, Route, Routes, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { getRuntimeEnv } from "@/lib/env/runtime-env"

type SupportedLanguage = "en" | "zh"

function getPreferredLanguage(): SupportedLanguage {
  if (navigator.language.toLowerCase().startsWith("zh")) {
    return "zh"
  }

  return "en"
}

function getExternalLoginRedirect(search: string) {
  const params = new URLSearchParams(search)
  const hasCallbackPayload = params.has("code") && params.has("state")

  if (!hasCallbackPayload) {
    return ""
  }

  if (params.has("sso-logged-in")) {
    return `/login/sso${search}`
  }

  if (params.has("social-logged-in")) {
    return `/login${search}`
  }

  return ""
}

function LanguageRedirect() {
  const lang = getPreferredLanguage()
  const location = useLocation()
  const externalLoginRedirect = getExternalLoginRedirect(location.search)

  if (externalLoginRedirect) {
    return <Navigate to={`/${lang}${externalLoginRedirect}`} replace />
  }

  return <Navigate to={`/${lang}/login`} replace />
}

function LocalizedAuthRedirect({ mode }: { mode: "login" | "sso" }) {
  const lang = getPreferredLanguage()
  const location = useLocation()
  const path = mode === "sso" ? "login/sso" : "login"

  return <Navigate to={`/${lang}/${path}${location.search}`} replace />
}

function ShellPage({ kind }: { kind: "login" | "sso" | "app" }) {
  const { t } = useTranslation()
  const env = getRuntimeEnv()

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
      <section className="flex w-full max-w-md flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {t("shell.eyebrow")}
        </p>
        <h1 className="text-2xl font-semibold tracking-normal">
          {t(`shell.${kind}.title`)}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {t(`shell.${kind}.description`)}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("shell.version", { version: env.version })}
        </p>
      </section>
    </main>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LanguageRedirect />} />
      <Route path="/login" element={<LocalizedAuthRedirect mode="login" />} />
      <Route path="/login/sso" element={<LocalizedAuthRedirect mode="sso" />} />
      <Route path="/:lang/login" element={<ShellPage kind="login" />} />
      <Route path="/:lang/login/sso" element={<ShellPage kind="sso" />} />
      <Route path="/:lang/*" element={<ShellPage kind="app" />} />
      <Route path="*" element={<LanguageRedirect />} />
    </Routes>
  )
}
