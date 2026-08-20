import { useEffect } from "react";
import { PasswordLoginForm } from "@/components/auth/password-login-form";
import { authStorage } from "@/lib/featbit-auth/storage";
import { useAuth } from "@/lib/featbit-auth/auth-context";
import { appPath } from "@/lib/app-path";

function loginRedirect(): string {
  const fallback = appPath("/");
  const requested =
    new URLSearchParams(window.location.search).get("redirect") ||
    authStorage.getLoginRedirectUrl();

  if (!requested) return fallback;

  try {
    const target = new URL(requested, window.location.origin);
    if (target.origin !== window.location.origin) return fallback;
    if (target.pathname === appPath("/login")) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

export default function LoginPage() {
  const { completeLogin, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    const redirect = loginRedirect();
    authStorage.clearLoginRedirectUrl();
    window.location.replace(redirect);
  }, [isAuthenticated]);

  const handleAuthenticated = async (token: string) => {
    const redirect = loginRedirect();
    await completeLogin(token);
    authStorage.clearLoginRedirectUrl();
    window.location.replace(redirect);
  };

  return (
    <main className="w-full max-w-sm">
      <div className="surface-panel rounded-xl p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={appPath("/logo.svg")} alt="FeatBit" className="mb-4 size-12" />
          <h1 className="text-2xl font-black tracking-tight">Sign in to FeatBit</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use your FeatBit account to access Release Decision.
          </p>
        </div>

        <PasswordLoginForm onAuthenticated={handleAuthenticated} />
      </div>
    </main>
  );
}
