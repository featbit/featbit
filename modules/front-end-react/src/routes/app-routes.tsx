import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { AuthGuard } from "@/features/auth/auth-guard";
import { AuthenticatedEntry } from "@/features/auth/authenticated-entry";
import { AuthPage } from "@/features/auth/login-pages";
import { getIdentityToken } from "@/features/auth/auth-api";
import { Layout, LayoutPlaceholder } from "@/features/layout/layout";
import { OnboardingPage } from "@/features/onboarding/onboarding-page";
import { SelectWorkspacePage } from "@/features/workspace-selection/select-workspace-page";
import { WorkspacePage } from "@/features/workspace/workspace-page";

type SupportedLanguage = "en" | "zh";

function getPreferredLanguage(): SupportedLanguage {
  if (navigator.language.toLowerCase().startsWith("zh")) {
    return "zh";
  }

  return "en";
}

function getExternalLoginRedirect(search: string) {
  const params = new URLSearchParams(search);
  const hasCallbackPayload = params.has("code") && params.has("state");

  if (!hasCallbackPayload) {
    return "";
  }

  if (params.has("sso-logged-in")) {
    return `/login/sso${search}`;
  }

  if (params.has("social-logged-in")) {
    return `/login${search}`;
  }

  return "";
}

function LanguageRedirect() {
  const lang = getPreferredLanguage();
  const location = useLocation();
  const externalLoginRedirect = getExternalLoginRedirect(location.search);

  if (externalLoginRedirect) {
    return <Navigate to={`/${lang}${externalLoginRedirect}`} replace />;
  }

  const target = getIdentityToken() ? "app" : "login";

  return <Navigate to={`/${lang}/${target}`} replace />;
}

function LocalizedAuthRedirect({ mode }: { mode: "login" | "sso" }) {
  const lang = getPreferredLanguage();
  const location = useLocation();
  const path = mode === "sso" ? "login/sso" : "login";

  return <Navigate to={`/${lang}/${path}${location.search}`} replace />;
}

function AuthRoute({ mode }: { mode: "login" | "sso" }) {
  const { lang = getPreferredLanguage() } = useParams();

  if (getIdentityToken()) {
    return <Navigate to={`/${lang}/app`} replace />;
  }

  return <AuthPage mode={mode} />;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { lang = getPreferredLanguage() } = useParams();

  if (!getIdentityToken()) {
    return <Navigate to={`/${lang}/login`} replace />;
  }

  return children;
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
        element={
          <AuthGuard>
            <SelectWorkspacePage />
          </AuthGuard>
        }
      />
      <Route
        path="/:lang/onboarding"
        element={
          <AuthGuard>
            <OnboardingPage />
          </AuthGuard>
        }
      />
      <Route
        path="/:lang/*"
        element={
          <ProtectedRoute>
            <AuthGuard>
              <AuthenticatedEntry>
                <Layout />
              </AuthenticatedEntry>
            </AuthGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<LayoutPlaceholder />} />
        <Route path="workspace" element={<WorkspacePage />} />
        <Route path="workspace/license" element={<WorkspacePage activeTab="license" />} />
        <Route path="workspace/usage" element={<WorkspacePage activeTab="usage" />} />
        <Route path="workspace/billing" element={<WorkspacePage activeTab="billing" />} />
        <Route path="workspace/global-users" element={<WorkspacePage activeTab="global-users" />} />
        <Route path="*" element={<LayoutPlaceholder />} />
      </Route>
      <Route path="*" element={<LanguageRedirect />} />
    </Routes>
  );
}


