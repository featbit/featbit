import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthPage } from "@/features/auth/login-pages";

type SupportedLanguage = "en" | "zh";

function getPreferredLanguage(): SupportedLanguage {
  if (navigator.language.toLowerCase().startsWith("zh")) {
    return "zh";
  }

  return "en";
}

function LanguageRedirect() {
  return <Navigate to={`/${getPreferredLanguage()}/login`} replace />;
}

function AuthenticatedLayoutPlaceholder() {
  const { lang = "en" } = useParams();

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <section className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">FeatBit React scaffold</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Authenticated layout placeholder
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Route: /{lang}/app. The console shell frame is migration step 3.
        </p>
      </section>
    </main>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LanguageRedirect />} />
      <Route path="/:lang/login" element={<AuthPage mode="login" />} />
      <Route path="/:lang/login/sso" element={<AuthPage mode="sso" />} />
      <Route path="/:lang/app" element={<AuthenticatedLayoutPlaceholder />} />
      <Route path="/:lang/*" element={<Navigate to="../app" replace />} />
      <Route path="*" element={<LanguageRedirect />} />
    </Routes>
  );
}
