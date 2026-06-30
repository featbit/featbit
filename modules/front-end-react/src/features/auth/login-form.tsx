import { useMutation } from "@tanstack/react-query";
import { Building2, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  completeLogin,
  getRememberedEmail,
  loginByEmail,
  type OAuthProvider
} from "@/features/auth/auth-api";
import type { Lang, LoginErrorKey } from "@/features/auth/auth-page-types";
import { DividerLabel, Field } from "@/features/auth/form-controls";
import { GitHubIcon, GoogleIcon } from "@/features/auth/social-icons";

export function LoginForm({
  lang,
  socialProviders,
  onSocialLogin
}: {
  lang: Lang;
  socialProviders: OAuthProvider[];
  onSocialLogin: (provider: OAuthProvider) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => getRememberedEmail());
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => Boolean(getRememberedEmail()));
  const [errorKey, setErrorKey] = useState<LoginErrorKey | null>(null);
  const [success, setSuccess] = useState("");
  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string; rememberMe: boolean }) => {
      const response = await loginByEmail(credentials.email, credentials.password);

      if (response.success) {
        await completeLogin(response, navigate, `/${lang}/app`, {
          email: credentials.email,
          rememberMe: credentials.rememberMe
        });
      }

      return response;
    },
    onSuccess: (response) => {
      if (!response.success) {
        setErrorKey("incorrectEmailOrPassword");
        return;
      }

      setSuccess("Login with success");
    },
    onError: () => {
      setErrorKey("loginError");
    }
  });

  async function handleLogin() {
    setErrorKey(null);
    setSuccess("");
    loginMutation.mutate({ email: email.trim(), password, rememberMe });
  }

  const visibleProviders = socialProviders.filter((provider) => ["Google", "GitHub"].includes(provider.name));

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col justify-start px-8 pb-8 sm:px-12 lg:px-0">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">{t("auth.login.title")}</h2>
        <p className="mt-3 text-base text-muted-foreground">{t("auth.login.subtitle")}</p>
      </div>

      <form
        className="mt-7 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void handleLogin();
        }}
      >
        <Field
          label={t("auth.email")}
          type="email"
          placeholder="name@company.com"
          icon={<Mail className="h-5 w-5" />}
          value={email}
          autoComplete="username"
          name="email"
          required
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          label={t("auth.password")}
          type={passwordVisible ? "text" : "password"}
          placeholder={t("auth.passwordPlaceholder")}
          icon={<Lock className="h-5 w-5" />}
          trailing={
            <button
              type="button"
              className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              onClick={() => setPasswordVisible((visible) => !visible)}
            >
              {passwordVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          }
          value={password}
          autoComplete="current-password"
          name="password"
          required
          onChange={(event) => setPassword(event.target.value)}
        />

        <div className="flex items-center text-base">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              className="h-5 w-5 cursor-pointer rounded border-input bg-background"
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            {t("auth.remember")}
          </label>
        </div>

        {errorKey ? <p className="text-sm font-medium text-red-600">{t(`auth.errors.${errorKey}`)}</p> : null}
        {success ? <p className="text-sm font-medium text-emerald-600">{success}</p> : null}

        <Button className="h-12 w-full bg-blue-600 text-base text-white shadow-sm hover:bg-blue-700" type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? "Signing in..." : t("auth.signIn")}
        </Button>
      </form>

      <div className="mt-8 space-y-6">
        {visibleProviders.length > 0 ? (
          <>
            <DividerLabel>{t("auth.continueWith")}</DividerLabel>
            <div className="grid grid-cols-2 gap-5">
              {visibleProviders.map((provider) => (
                <Button
                  key={provider.name}
                  type="button"
                  variant="outline"
                  className="h-12 gap-3 bg-transparent text-base shadow-none"
                  onClick={() => onSocialLogin(provider)}
                >
                  {provider.name === "Google" ? <GoogleIcon /> : <GitHubIcon />}
                  {provider.name}
                </Button>
              ))}
            </div>
          </>
        ) : null}

        <div className="space-y-6">
          <DividerLabel>{t("auth.enterprise")}</DividerLabel>
          <Button asChild type="button" variant="outline" className="h-12 w-full gap-3 bg-transparent text-base shadow-none">
            <Link to={`/${lang}/login/sso`}>
              <Building2 className="h-6 w-6" />
              {t("auth.ssoButton")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
