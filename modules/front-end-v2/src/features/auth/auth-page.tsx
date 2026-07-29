import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  completeLogin,
  getSocialProviders,
  getSsoPreCheck,
  loginBySocialCode,
  loginBySsoCode,
} from "@/features/auth/auth-api"
import { AuthFooter } from "@/features/auth/components/auth-footer"
import { AuthHeader } from "@/features/auth/components/auth-header"
import { type AuthMode, resolveLang } from "@/features/auth/auth-page-types"
import { LoginForm } from "@/features/auth/components/login-form"
import { LeftPanel } from "@/features/auth/components/rollout-visual"
import { SsoForm } from "@/features/auth/components/sso-form"

export function AuthPage({ mode }: { mode: AuthMode }) {
  const params = useParams()
  const lang = resolveLang(params.lang)
  const { i18n, t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const handledExternalLoginKey = useRef("")
  const socialProvidersQuery = useQuery({
    queryKey: ["auth", "social-providers"],
    queryFn: getSocialProviders,
    staleTime: 5 * 60 * 1000,
  })
  const ssoPreCheckQuery = useQuery({
    queryKey: ["auth", "sso-pre-check"],
    queryFn: getSsoPreCheck,
    staleTime: 5 * 60 * 1000,
  })
  const externalLoginMutation = useMutation({
    mutationFn: async (callback: {
      code: string
      state: string
      type: "sso" | "social"
    }) => {
      const response =
        callback.type === "sso"
          ? await loginBySsoCode(callback.code, callback.state)
          : await loginBySocialCode(callback.code, callback.state)

      await completeLogin(response, navigate, `/${lang}`)
    },
  })

  useEffect(() => {
    void i18n.changeLanguage(lang)
  }, [i18n, lang])

  useEffect(() => {
    const code = searchParams.get("code")
    const state = searchParams.get("state")

    if (!code || !state) {
      return
    }

    const isSsoLogin = searchParams.has("sso-logged-in")
    const isSocialLogin = searchParams.has("social-logged-in")

    if (!isSsoLogin && !isSocialLogin) {
      return
    }

    const callbackType = isSsoLogin ? "sso" : "social"
    const callbackKey = `${callbackType}:${code}:${state}`
    if (handledExternalLoginKey.current === callbackKey) {
      return
    }

    handledExternalLoginKey.current = callbackKey
    externalLoginMutation.reset()
    externalLoginMutation.mutate({ code, state, type: callbackType })
  }, [externalLoginMutation, searchParams])

  const socialProviders = useMemo(
    () => socialProvidersQuery.data ?? [],
    [socialProvidersQuery.data]
  )
  const ssoPreCheck = ssoPreCheckQuery.data ?? null
  const externalLoginError = externalLoginMutation.error
    ? externalLoginMutation.error instanceof Error
      ? externalLoginMutation.error.message
      : t("auth.errors.loginError")
    : ""
  const permissionDenied = searchParams.get("reason") === "permission-denied"

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AuthHeader lang={lang} />
      <div className="grid min-h-[calc(100vh-4rem)] 2xl:grid-cols-[1.45fr_1fr]">
        <LeftPanel />
        <section className="grid min-h-[calc(100vh-4rem)] grid-rows-[minmax(0,1fr)_auto] border-border 2xl:border-l">
          <div className="flex min-h-0 w-full flex-col justify-center py-8">
            {permissionDenied ? (
              <div className="mx-auto mb-6 w-full max-w-[560px] px-8 sm:px-12 2xl:px-0">
                <Alert variant="destructive">
                  <AlertTitle>{t("auth.permissionDenied.title")}</AlertTitle>
                  <AlertDescription>
                    {t("auth.permissionDenied.environmentAccess")}
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}
            {externalLoginError ? (
              <div className="mx-auto mb-6 w-full max-w-[560px] px-8 sm:px-12 2xl:px-0">
                <Alert variant="destructive">
                  <AlertDescription>{externalLoginError}</AlertDescription>
                </Alert>
              </div>
            ) : null}
            {externalLoginMutation.isPending ? (
              <div className="mx-auto mb-6 w-full max-w-[560px] px-8 sm:px-12 2xl:px-0">
                <Alert>
                  <AlertDescription>{t("auth.signingIn")}</AlertDescription>
                </Alert>
              </div>
            ) : null}
            {mode === "login" ? (
              <LoginForm
                lang={lang}
                socialProviders={socialProviders}
                onSocialLogin={(provider) => {
                  window.location.href = provider.authorizeUrl
                }}
              />
            ) : (
              <SsoForm
                key={ssoPreCheck?.workspaceKey ?? "manual-sso"}
                lang={lang}
                preCheck={ssoPreCheck}
              />
            )}
          </div>
          <AuthFooter />
        </section>
      </div>
    </main>
  )
}
