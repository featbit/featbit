import type { ReactNode } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { getIdentityToken, getStoredUserProfile } from "@/features/auth/auth-api";
import { resolveLang } from "@/features/layout/context";

export function AuthGuard({ children }: { children: ReactNode }) {
  const params = useParams();
  const location = useLocation();
  const lang = resolveLang(params.lang);
  const hasToken = Boolean(getIdentityToken());
  const profile = getStoredUserProfile();
  const hasProfile = Boolean(profile.id || profile.email || profile.name);

  if (!hasToken || !hasProfile) {
    localStorage.setItem("login-redirect-url", `${location.pathname}${location.search}`);
    return <Navigate to={`/${lang}/login`} replace />;
  }

  return children;
}
