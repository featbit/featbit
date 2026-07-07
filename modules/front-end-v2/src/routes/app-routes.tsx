import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom"
import { useTranslation } from "react-i18next"
import { AuthPage } from "@/features/auth/auth-page"
import { AuthenticatedEntry } from "@/features/auth/authenticated-entry"
import { getIdentityToken } from "@/features/auth/auth-api"
import { AuthenticatedLayout } from "@/features/layout/authenticated-layout"
import { LayoutPlaceholder } from "@/features/layout/layout-placeholder"
import { OnboardingPage } from "@/features/onboarding/onboarding-page"
import { BillingPage } from "@/features/workspace/billing/billing-page"
import { GeneralPage } from "@/features/workspace/general/general-page"
import { GlobalUsersPage } from "@/features/workspace/global-users/global-users-page"
import { LicensePage } from "@/features/workspace/license/license-page"
import { UsagePage } from "@/features/workspace/usage/usage-page"
import { SelectWorkspacePage } from "@/features/workspace-selection/select-workspace-page"
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

function AuthRoute({ mode }: { mode: "login" | "sso" }) {
  const { lang = getPreferredLanguage() } = useParams()

  if (getIdentityToken()) {
    return <Navigate to={`/${lang}`} replace />
  }

  return <AuthPage mode={mode} />
}

function SecureRoute() {
  const { lang = getPreferredLanguage() } = useParams()
  const location = useLocation()

  if (!getIdentityToken()) {
    localStorage.setItem(
      "login-redirect-url",
      `${location.pathname}${location.search}`
    )
    return <Navigate to={`/${lang}/login`} replace />
  }

  return (
    <AuthenticatedEntry>
      <AuthenticatedLayout />
    </AuthenticatedEntry>
  )
}

function SelectWorkspaceRoute() {
  const { lang = getPreferredLanguage() } = useParams()
  const location = useLocation()

  if (!getIdentityToken()) {
    localStorage.setItem(
      "login-redirect-url",
      `${location.pathname}${location.search}`
    )
    return <Navigate to={`/${lang}/login`} replace />
  }

  return <SelectWorkspacePage />
}

function OnboardingRoute() {
  const { lang = getPreferredLanguage() } = useParams()
  const location = useLocation()

  if (!getIdentityToken()) {
    localStorage.setItem(
      "login-redirect-url",
      `${location.pathname}${location.search}`
    )
    return <Navigate to={`/${lang}/login`} replace />
  }

  return <OnboardingPage />
}

function ShellPage() {
  const { t } = useTranslation()
  const env = getRuntimeEnv()

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
      <section className="flex w-full max-w-md flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {t("shell.eyebrow")}
        </p>
        <h1 className="text-2xl font-semibold tracking-normal">
          {t("shell.app.title")}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {t("shell.app.description")}
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
      <Route path="/:lang/login" element={<AuthRoute mode="login" />} />
      <Route path="/:lang/login/sso" element={<AuthRoute mode="sso" />} />
      <Route
        path="/:lang/select-workspace"
        element={<SelectWorkspaceRoute />}
      />
      <Route path="/:lang/onboarding" element={<OnboardingRoute />} />
      <Route path="/:lang" element={<SecureRoute />}>
        <Route index element={<LayoutPlaceholder />} />
        <Route path="workspace" element={<GeneralPage />} />
        <Route path="workspace/billing" element={<BillingPage />} />
        <Route path="workspace/license" element={<LicensePage />} />
        <Route path="workspace/usage" element={<UsagePage />} />
        <Route path="workspace/global-users" element={<GlobalUsersPage />} />
        <Route path="*" element={<LayoutPlaceholder />} />
      </Route>
      <Route path="/:lang/*" element={<ShellPage />} />
      <Route path="*" element={<LanguageRedirect />} />
    </Routes>
  )
}
