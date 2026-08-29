import { lazy, Suspense, useEffect } from "react"
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom"
import { AuthenticatedEntry } from "@/features/auth/authenticated-entry"
import { getIdentityToken, onSessionExpired } from "@/features/auth/auth-api"
import { getAuthenticatedLandingPath } from "@/features/get-started/get-started-state"
import { IamRouteGuard } from "@/features/iam/iam-route-guard"
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
const EndUsersPage = lazy(() =>
  import("@/features/end-users/end-users-page").then((module) => ({
    default: module.EndUsersPage,
  }))
)
const ExperimentsPage = lazy(() =>
  import("@/features/expts/index/experiments-page").then((module) => ({
    default: module.ExperimentsPage,
  }))
)
const MetricsPage = lazy(() =>
  import("@/features/expt-metrics/metrics-page").then((module) => ({
    default: module.MetricsPage,
  }))
)
const LayersPage = lazy(() =>
  import("@/features/expt-layers/layers-page").then((module) => ({
    default: module.LayersPage,
  }))
)
const SegmentsPage = lazy(() =>
  import("@/features/segments/index/segments-page").then((module) => ({
    default: module.SegmentsPage,
  }))
)
const SegmentDetailsPage = lazy(() =>
  import("@/features/segments/details/segment-details-page").then((module) => ({
    default: module.SegmentDetailsPage,
  }))
)
const AuditLogsPage = lazy(() =>
  import("@/features/audit-logs/audit-logs-page").then((module) => ({
    default: module.AuditLogsPage,
  }))
)
const ChangeRequestsPage = lazy(() =>
  import("@/features/change-requests/change-requests-page").then((module) => ({
    default: module.ChangeRequestsPage,
  }))
)
const FlagsPage = lazy(() =>
  import("@/features/flags/index/flags-page").then((module) => ({
    default: module.FlagsPage,
  }))
)
const FlagsComparePage = lazy(() =>
  import("@/features/flags/compare/flags-compare-page").then((module) => ({
    default: module.FlagsComparePage,
  }))
)
const FlagDetailsPage = lazy(() =>
  import("@/features/flags/details/flag-details-page").then((module) => ({
    default: module.FlagDetailsPage,
  }))
)
const GetStartedPage = lazy(() =>
  import("@/features/get-started/get-started-page").then((module) => ({
    default: module.GetStartedPage,
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
    return `/login${search}`
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

function LocalizedAuthRedirect() {
  const lang = getPreferredLanguage()
  const location = useLocation()

  return (
    <Navigate to={`/${lang}/login${location.search}${location.hash}`} replace />
  )
}

function AuthRoute() {
  const { lang = getPreferredLanguage() } = useParams()
  const location = useLocation()
  const isPermissionDenied =
    new URLSearchParams(location.search).get("reason") === "permission-denied"

  if (getIdentityToken() && !isPermissionDenied) {
    return <Navigate to={`/${lang}`} replace />
  }

  return <AuthPage />
}

function AuthenticatedLandingRedirect() {
  const { lang = getPreferredLanguage() } = useParams()

  return <Navigate to={`/${lang}${getAuthenticatedLandingPath()}`} replace />
}

function SecureRoute() {
  const { lang = getPreferredLanguage() } = useParams()
  const location = useLocation()
  useSessionExpiredRedirect()

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
  useSessionExpiredRedirect()

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
  useSessionExpiredRedirect()

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

function useSessionExpiredRedirect() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(
    () =>
      onSessionExpired(() => {
        const lang = location.pathname.split("/")[1] === "zh" ? "zh" : "en"
        const redirectUrl = `${location.pathname}${location.search}`

        if (
          !localStorage.getItem("login-redirect-url") &&
          !location.pathname.endsWith("/select-workspace")
        ) {
          localStorage.setItem("login-redirect-url", redirectUrl)
        }

        navigate(`/${lang}/login`, { replace: true })
      }),
    [location.pathname, location.search, navigate]
  )
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LanguageRedirect />} />
        <Route path="/login" element={<LocalizedAuthRedirect />} />
        <Route path="/:lang/login" element={<AuthRoute />} />
        <Route
          path="/:lang/select-workspace"
          element={<SelectWorkspaceRoute />}
        />
        <Route path="/:lang/onboarding" element={<OnboardingRoute />} />
        <Route path="/:lang" element={<SecureRoute />}>
          <Route index element={<AuthenticatedLandingRedirect />} />
          <Route path="get-started" element={<GetStartedPage />} />
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
          <Route path="iam" element={<IamRouteGuard />}>
            <Route index element={<Navigate to="team" replace />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="team/:memberId/:tab" element={<TeamDetailsPage />} />
            <Route path="groups" element={<GroupPage />} />
            <Route path="groups/:groupId/:tab" element={<GroupDetailsPage />} />
            <Route path="policies" element={<PolicyPage />} />
            <Route
              path="policies/:policyId/:tab"
              element={<PolicyDetailsPage />}
            />
          </Route>
          <Route path="access-tokens" element={<AccessTokensPage />} />
          <Route path="relay-proxies" element={<RelayProxiesPage />} />
          <Route path="webhooks" element={<WebhooksPage />} />
          <Route path="end-users" element={<EndUsersPage />} />
          <Route path="experiments" element={<ExperimentsPage />} />
          <Route path="metrics" element={<MetricsPage />} />
          <Route path="layers" element={<LayersPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="change-requests" element={<ChangeRequestsPage />} />
          <Route path="feature-flags" element={<FlagsPage />} />
          <Route path="feature-flags/compare" element={<FlagsComparePage />} />
          <Route
            path="feature-flags/:flagKey/:tab"
            element={<FlagDetailsPage />}
          />
          <Route path="segments" element={<SegmentsPage />} />
          <Route path="segments/:segmentId" element={<SegmentDetailsPage />} />
          <Route
            path="segments/:segmentId/:tab"
            element={<SegmentDetailsPage />}
          />
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
