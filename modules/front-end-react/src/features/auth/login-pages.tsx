import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AuthFooter } from "@/features/auth/auth-footer";
import { AuthHeader } from "@/features/auth/auth-header";
import { type AuthMode, resolveLang } from "@/features/auth/auth-page-types";
import { LeftPanel } from "@/features/auth/auth-visual";
import {
  completeLogin,
  getSocialProviders,
  getSsoPreCheck,
  loginBySocialCode,
  loginBySsoCode
} from "@/features/auth/auth-api";
import { LoginForm } from "@/features/auth/login-form";
import { SsoForm } from "@/features/auth/sso-form";

export function AuthPage({ mode }: { mode: AuthMode }) {
  const params = useParams();
  const lang = resolveLang(params.lang);
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handledExternalLoginKey = useRef("");
  const socialProvidersQuery = useQuery({
    queryKey: ["auth", "social-providers"],
    queryFn: getSocialProviders,
    staleTime: 5 * 60 * 1000
  });
  const ssoPreCheckQuery = useQuery({
    queryKey: ["auth", "sso-pre-check"],
    queryFn: getSsoPreCheck,
    staleTime: 5 * 60 * 1000
  });
  const externalLoginMutation = useMutation({
    mutationFn: async (callback: { code: string; state: string; type: "sso" | "social" }) => {
      const response =
        callback.type === "sso"
          ? await loginBySsoCode(callback.code, callback.state)
          : await loginBySocialCode(callback.code, callback.state);

      await completeLogin(response, navigate, `/${lang}/app`);
    }
  });

  useEffect(() => {
    void i18n.changeLanguage(lang);
  }, [i18n, lang]);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return;
    }

    const isSsoLogin = searchParams.has("sso-logged-in");
    const isSocialLogin = searchParams.has("social-logged-in");

    if (!isSsoLogin && !isSocialLogin) {
      return;
    }

    const callbackType = isSsoLogin ? "sso" : "social";
    const callbackKey = `${callbackType}:${code}:${state}`;
    if (handledExternalLoginKey.current === callbackKey) {
      return;
    }

    handledExternalLoginKey.current = callbackKey;
    externalLoginMutation.reset();
    externalLoginMutation.mutate({ code, state, type: callbackType });
  }, [externalLoginMutation, searchParams]);

  const socialProviders = useMemo(() => socialProvidersQuery.data ?? [], [socialProvidersQuery.data]);
  const ssoPreCheck = ssoPreCheckQuery.data ?? null;
  const externalLoginError = externalLoginMutation.error
    ? externalLoginMutation.error instanceof Error
      ? externalLoginMutation.error.message
      : "Failed to login."
    : "";

  const content = useMemo(() => {
    if (mode === "login") {
      return (
        <LoginForm
          lang={lang}
          socialProviders={socialProviders}
          onSocialLogin={(provider) => {
            window.location.href = provider.authorizeUrl;
          }}
        />
      );
    }

    return <SsoForm key={ssoPreCheck?.workspaceKey ?? "manual-sso"} lang={lang} preCheck={ssoPreCheck} />;
  }, [lang, mode, socialProviders, ssoPreCheck]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AuthHeader lang={lang} />
      <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[1.45fr_1fr]">
        <LeftPanel />
        <section className="grid min-h-[calc(100vh-4rem)] grid-rows-[minmax(0,1fr)_auto] border-border lg:border-l">
          <div className="flex min-h-0 w-full flex-col justify-center py-8">
            {externalLoginError ? (
              <div className="mx-auto mb-6 w-full max-w-[560px] px-8 text-sm font-medium text-red-600 sm:px-12 lg:px-0">
                {externalLoginError}
              </div>
            ) : null}
            {externalLoginMutation.isPending ? (
              <div className="mx-auto mb-6 w-full max-w-[560px] px-8 text-sm font-medium text-muted-foreground sm:px-12 lg:px-0">
                Signing in...
              </div>
            ) : null}
            {content}
          </div>
          <AuthFooter />
        </section>
      </div>
    </main>
  );
}
