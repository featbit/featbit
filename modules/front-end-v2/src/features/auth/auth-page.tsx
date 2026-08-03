import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom"
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
import {
  AuthProcessState,
  SsoCheckErrorState,
} from "@/features/auth/components/auth-state"
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
  const [externalLoginFailed, setExternalLoginFailed] = useState(false)
  const socialProvidersQuery = useQuery({
    queryKey: ["auth", "social-providers"],
    queryFn: getSocialProviders,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  const ssoPreCheckQuery = useQuery({
    queryKey: ["auth", "sso-pre-check"],
    queryFn: getSsoPreCheck,
    staleTime: 5 * 60 * 1000,
    retry: false,
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
    onError: () => {
      setExternalLoginFailed(true)
    },
  })
  const { mutate: completeExternalLogin, reset: resetExternalLogin } =
    externalLoginMutation
  const callbackCode = searchParams.get("code")
  const callbackState = searchParams.get("state")
  const callbackType = searchParams.has("sso-logged-in")
    ? "sso"
    : searchParams.has("social-logged-in")
      ? "social"
      : null
  const hasExternalLoginCallback = Boolean(
    callbackCode && callbackState && callbackType
  )

  useEffect(() => {
    void i18n.changeLanguage(lang)
  }, [i18n, lang])

  useEffect(() => {
    if (!callbackCode || !callbackState || !callbackType) {
      return
    }

    const callbackKey = `${callbackType}:${callbackCode}:${callbackState}`
    if (handledExternalLoginKey.current === callbackKey) {
      return
    }

    handledExternalLoginKey.current = callbackKey
    setExternalLoginFailed(false)
    resetExternalLogin()
    completeExternalLogin({
      code: callbackCode,
      state: callbackState,
      type: callbackType,
    })
  }, [
    callbackCode,
    callbackState,
    callbackType,
    completeExternalLogin,
    resetExternalLogin,
  ])

  const socialProviders = socialProvidersQuery.data ?? []
  const ssoPreCheck = ssoPreCheckQuery.data ?? null
  const permissionDenied = searchParams.get("reason") === "permission-denied"
  const ssoUnavailable = searchParams.get("reason") === "sso-unavailable"
  const isCompletingExternalLogin =
    hasExternalLoginCallback && !externalLoginFailed
  const isSsoDisabled =
    ssoPreCheckQuery.isSuccess && ssoPreCheck?.isEnabled !== true

  if (mode === "sso" && isSsoDisabled && !isCompletingExternalLogin) {
    return (
      <Navigate
        replace
        to={{
          pathname: `/${lang}/login`,
          search: "?reason=sso-unavailable",
        }}
      />
    )
  }

  let authContent: ReactNode

  if (isCompletingExternalLogin) {
    authContent = (
      <AuthProcessState
        title={t("auth.externalSignIn.title")}
        description={t("auth.externalSignIn.description")}
      />
    )
  } else if (mode === "login") {
    authContent = (
      <LoginForm
        lang={lang}
        socialProviders={socialProviders}
        isSsoEnabled={ssoPreCheck?.isEnabled === true}
        isExternalOptionsLoading={
          socialProvidersQuery.isPending || ssoPreCheckQuery.isPending
        }
        hasExternalOptionsError={
          socialProvidersQuery.isError || ssoPreCheckQuery.isError
        }
        isRetryingExternalOptions={
          (socialProvidersQuery.isFetching || ssoPreCheckQuery.isFetching) &&
          !(socialProvidersQuery.isPending || ssoPreCheckQuery.isPending)
        }
        onRetryExternalOptions={() => {
          void Promise.all([
            socialProvidersQuery.refetch(),
            ssoPreCheckQuery.refetch(),
          ])
        }}
        onSocialLogin={(provider) => {
          window.location.assign(provider.authorizeUrl)
        }}
      />
    )
  } else if (ssoPreCheckQuery.isPending) {
    authContent = (
      <AuthProcessState
        title={t("auth.sso.checkingTitle")}
        description={t("auth.sso.checkingDescription")}
      />
    )
  } else if (ssoPreCheckQuery.isError) {
    authContent = (
      <SsoCheckErrorState
        lang={lang}
        isRetrying={ssoPreCheckQuery.isFetching}
        onRetry={() => {
          void ssoPreCheckQuery.refetch()
        }}
      />
    )
  } else {
    authContent = <SsoForm lang={lang} preCheck={ssoPreCheck} />
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <AuthHeader lang={lang} />
      <div className="grid min-h-[calc(100dvh-4rem)] 2xl:grid-cols-[1.45fr_1fr]">
        <LeftPanel />
        <section className="grid min-h-[calc(100dvh-4rem)] grid-rows-[minmax(0,1fr)_auto] border-border 2xl:border-l">
          <div className="flex min-h-0 w-full flex-col justify-center py-8">
            {permissionDenied ? (
              <div className="mx-auto mb-6 w-full max-w-[480px] px-6 sm:px-10 2xl:px-0">
                <Alert variant="destructive">
                  <AlertTitle>{t("auth.permissionDenied.title")}</AlertTitle>
                  <AlertDescription>
                    {t("auth.permissionDenied.environmentAccess")}
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}
            {ssoUnavailable ? (
              <div className="mx-auto mb-6 w-full max-w-[480px] px-6 sm:px-10 2xl:px-0">
                <Alert>
                  <AlertTitle>{t("auth.ssoUnavailable.title")}</AlertTitle>
                  <AlertDescription>
                    {t("auth.ssoUnavailable.description")}
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}
            {externalLoginFailed ? (
              <div className="mx-auto mb-6 w-full max-w-[480px] px-6 sm:px-10 2xl:px-0">
                <Alert variant="destructive">
                  <AlertDescription>
                    {t("auth.errors.externalLoginError")}
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}
            {authContent}
          </div>
          <AuthFooter />
        </section>
      </div>
    </main>
  )
}
