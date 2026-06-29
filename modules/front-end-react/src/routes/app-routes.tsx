import type { ReactNode } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthGuard } from "@/features/auth/auth-guard";
import { AuthenticatedEntry } from "@/features/auth/authenticated-entry";
import { AuthPage } from "@/features/auth/login-pages";
import { getIdentityToken } from "@/features/auth/auth-api";
import { Layout, LayoutPlaceholder } from "@/features/layout/layout";
import { SelectWorkspacePage } from "@/features/workspace-selection/select-workspace-page";
import { WorkspacePage } from "@/features/workspace/workspace-page";

type SupportedLanguage = "en" | "zh";

function getPreferredLanguage(): SupportedLanguage {
  if (navigator.language.toLowerCase().startsWith("zh")) {
    return "zh";
  }

  return "en";
}

function LanguageRedirect() {
  const lang = getPreferredLanguage();
  const target = getIdentityToken() ? "" : "login";

  return <Navigate to={target ? `/${lang}/${target}` : `/${lang}`} replace />;
}

function AuthRoute({ mode }: { mode: "login" | "sso" }) {
  const { lang = getPreferredLanguage() } = useParams();

  if (getIdentityToken()) {
    return <Navigate to={`/${lang}`} replace />;
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
            <LayoutPlaceholder />
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


