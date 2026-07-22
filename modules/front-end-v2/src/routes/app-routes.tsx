import { lazy, Suspense } from "react"
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom"
import { AuthenticatedEntry } from "@/features/auth/authenticated-entry"
import { getIdentityToken } from "@/features/auth/auth-api"
import { LayoutPlaceholder } from "@/features/layout/layout-placeholder"

const AuthPage = lazy(() =>
  import("@/features/auth/auth-page").then((module) => ({
    default: module.AuthPage,
  }))
)
const AuthenticatedLayout = lazy(() =>
  import("@/features/layout/authenticated-layout").then((module) => ({
    default: module.AuthenticatedLayout,
  }))
)
const NotFoundPage = lazy(() =>
  import("@/features/layout/not-found-page").then((module) => ({
    default: module.NotFoundPage,
  }))
)
const OnboardingPage = lazy(() =>
  import("@/features/onboarding/onboarding-page").then((module) => ({
    default: module.OnboardingPage,
  }))
)
const ProfilePage = lazy(() =>
  import("@/features/profile/profile-page").then((module) => ({
    default: module.ProfilePage,
  }))
)
const BillingPage = lazy(() =>
  import("@/features/workspace/billing/billing-page").then((module) => ({
    default: module.BillingPage,
  }))
)
const GeneralPage = lazy(() =>
  import("@/features/workspace/general/general-page").then((module) => ({
    default: module.GeneralPage,
  }))
)
const GlobalUsersPage = lazy(() =>
  import("@/features/workspace/global-users/global-users-page").then(
    (module) => ({
      default: module.GlobalUsersPage,
    })
  )
)
const LicensePage = lazy(() =>
  import("@/features/workspace/license/license-page").then((module) => ({
    default: module.LicensePage,
  }))
)
const UsagePage = lazy(() =>
  import("@/features/workspace/usage/usage-page").then((module) => ({
    default: module.UsagePage,
  }))
)
const SelectWorkspacePage = lazy(() =>
  import("@/features/workspace-selection/select-workspace-page").then(
    (module) => ({
      default: module.SelectWorkspacePage,
    })
  )
)
const OrganizationGeneralPage = lazy(() =>
  import("@/features/organization/general/general-page").then((module) => ({
    default: module.OrganizationGeneralPage,
  }))
)
const OrganizationProjectsPage = lazy(() =>
  import("@/features/organization/projects/projects-page").then((module) => ({
    default: module.OrganizationProjectsPage,
  }))
)
const TeamPage = lazy(() =>
  import("@/features/iam/team/index/team-page").then((module) => ({
    default: module.TeamPage,
  }))
)
const TeamDetailsPage = lazy(() =>
  import("@/features/iam/team/details/details-page").then((module) => ({
    default: module.TeamDetailsPage,
  }))
)
const GroupPage = lazy(() =>
  import("@/features/iam/groups/index/index-page").then((module) => ({
    default: module.GroupPage,
  }))
)
const GroupDetailsPage = lazy(() =>
  import("@/features/iam/groups/details/details-page").then((module) => ({
    default: module.GroupDetailsPage,
  }))
)
const PolicyPage = lazy(() =>
  import("@/features/iam/policies/index/index-page").then((module) => ({
    default: module.PolicyPage,
  }))
)
const PolicyDetailsPage = lazy(() =>
  import("@/features/iam/policies/details/details-page").then((module) => ({
    default: module.PolicyDetailsPage,
  }))
)
const AccessTokensPage = lazy(() =>
  import("@/features/access-tokens/access-tokens-page").then((module) => ({
    default: module.AccessTokensPage,
  }))
)
const RelayProxiesPage = lazy(() =>
  import("@/features/relay-proxies/relay-proxies-page").then((module) => ({
    default: module.RelayProxiesPage,
  }))
)
const WebhooksPage = lazy(() =>
  import("@/features/webhooks/webhooks-page").then((module) => ({
    default: module.WebhooksPage,
  }))
)

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

function ProfileCompatibilityRedirect() {
  const { lang = getPreferredLanguage() } = useParams()

  return <Navigate to={`/${lang}/account/profile`} replace />
}

function RouteFallback() {
  return <div className="min-h-32" />
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LanguageRedirect />} />
        <Route path="/login" element={<LocalizedAuthRedirect mode="login" />} />
        <Route
          path="/login/sso"
          element={<LocalizedAuthRedirect mode="sso" />}
        />
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
          <Route path="organization" element={<OrganizationGeneralPage />} />
          <Route
            path="organization/profile"
            element={<ProfileCompatibilityRedirect />}
          />
          <Route
            path="organization/projects"
            element={<OrganizationProjectsPage />}
          />
          <Route path="iam" element={<Navigate to="team" replace />} />
          <Route path="iam/team" element={<TeamPage />} />
          <Route path="iam/team/:memberId/:tab" element={<TeamDetailsPage />} />
          <Route path="iam/groups" element={<GroupPage />} />
          <Route
            path="iam/groups/:groupId/:tab"
            element={<GroupDetailsPage />}
          />
          <Route path="iam/policies" element={<PolicyPage />} />
          <Route
            path="iam/policies/:policyId/:tab"
            element={<PolicyDetailsPage />}
          />
          <Route path="access-tokens" element={<AccessTokensPage />} />
          <Route path="relay-proxies" element={<RelayProxiesPage />} />
          <Route path="webhooks" element={<WebhooksPage />} />
          <Route path="account/profile" element={<ProfilePage />} />
          {/*Remove the following line when migration completed*/}
          <Route path="*" element={<LayoutPlaceholder />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="*" element={<LanguageRedirect />} />
      </Routes>
    </Suspense>
  )
}
