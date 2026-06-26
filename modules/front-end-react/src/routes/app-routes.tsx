import type { ReactNode } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthPage } from "@/features/auth/login-pages";
import { getIdentityToken } from "@/features/auth/auth-api";
import { Layout, LayoutPlaceholder } from "@/features/layout/layout";

type SupportedLanguage = "en" | "zh";

function getPreferredLanguage(): SupportedLanguage {
  if (navigator.language.toLowerCase().startsWith("zh")) {
    return "zh";
  }

  return "en";
}

function LanguageRedirect() {
  const lang = getPreferredLanguage();
  const target = getIdentityToken() ? "app" : "login";

  return <Navigate to={`/${lang}/${target}`} replace />;
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
      <Route path="/:lang/login" element={<AuthRoute mode="login" />} />
      <Route path="/:lang/login/sso" element={<AuthRoute mode="sso" />} />
      <Route
        path="/:lang/app/*"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<LayoutPlaceholder />} />
        <Route path="*" element={<LayoutPlaceholder />} />
      </Route>
      <Route path="/:lang/*" element={<Navigate to="../app" replace />} />
      <Route path="*" element={<LanguageRedirect />} />
    </Routes>
  );
}


