"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/lib/featbit-auth/auth-context";
import { socialService } from "@/lib/featbit-auth/social-service";
import { ssoService } from "@/lib/featbit-auth/sso-service";
import { authStorage } from "@/lib/featbit-auth/storage";
import { FeatBitApiError } from "@/lib/featbit-auth/http";
import { appPath } from "@/lib/app-path";
import type { OAuthProvider, SsoPreCheck } from "@/lib/featbit-auth/types";
import { PasswordLoginForm } from "@/components/auth/password-login-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { SsoLoginForm } from "@/components/auth/sso-login-form";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "password" | "sso";

function getRedirectUri() {
  if (typeof window === "undefined") return "";
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?social-logged-in=true`;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading…</span>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady, isAuthenticated, completeLogin } = useAuth();

  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [ssoPreCheck, setSsoPreCheck] = useState<SsoPreCheck | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("password");
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const [isExchanging, setIsExchanging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const hasHandledCallbackRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (isAuthenticated) {
      const redirect = searchParams.get("redirect") || authStorage.getLoginRedirectUrl();
      authStorage.clearLoginRedirectUrl();
      router.replace(redirect || "/experiments");
    }
  }, [isReady, isAuthenticated, router, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const redirectUri = getRedirectUri();
    socialService
      .getProviders(redirectUri)
      .then((list) => setProviders(list || []))
      .catch(() => setProviders([]));
    ssoService
      .preCheck()
      .then((res) => setSsoPreCheck(res))
      .catch(() => setSsoPreCheck(null));
  }, []);

  const finishLogin = useCallback(
    async (token: string) => {
      await completeLogin(token);
      const redirect = searchParams.get("redirect") || authStorage.getLoginRedirectUrl();
      authStorage.clearLoginRedirectUrl();
      router.replace(redirect || "/experiments");
    },
    [completeLogin, router, searchParams],
  );

  useEffect(() => {
    if (hasHandledCallbackRef.current) return;
    if (typeof window === "undefined") return;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const social = searchParams.get("social-logged-in");
    const sso = searchParams.get("sso-logged-in");

    if (!code || (!social && !sso)) return;
    hasHandledCallbackRef.current = true;

    const run = async () => {
      setIsExchanging(true);
      try {
        if (social) {
          const providerName = state || "";
          if (!providerName) {
            throw new Error("Missing OAuth provider information.");
          }
          const redirectUri = `${window.location.origin}${window.location.pathname}?social-logged-in=true`;
          const result = await socialService.login(
            code,
            providerName,
            redirectUri,
          );
          authStorage.setSsoFirstLogin(result.isSsoFirstLogin);
          await finishLogin(result.token);
        } else if (sso) {
          const workspaceKey = authStorage.getSsoWorkspaceKey() || "";
          if (!workspaceKey) {
            throw new Error(
              "Missing workspace key for SSO login. Please try again.",
            );
          }
          const redirectUri = `${window.location.origin}${window.location.pathname}?sso-logged-in=true`;
          const result = await ssoService.oidcLogin(
            code,
            workspaceKey,
            redirectUri,
          );
          authStorage.setSsoFirstLogin(result.isSsoFirstLogin);
          await finishLogin(result.token);
        }
      } catch (err) {
        setCallbackError(
          err instanceof FeatBitApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Sign-in failed.",
        );
        const url = new URL(window.location.href);
        url.search = "";
        window.history.replaceState(null, "", url.toString());
      } finally {
        setIsExchanging(false);
      }
    };

    void run();
  }, [searchParams, finishLogin]);

  useEffect(() => {
    if (ssoPreCheck?.isEnabled && providers.length === 0 && activeTab !== "sso") {
      setActiveTab("sso");
    }
  }, [ssoPreCheck, providers, activeTab]);

  if (!mounted || !isReady || isExchanging) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/85 px-4 py-3 text-sm font-medium text-muted-foreground shadow-lg shadow-foreground/10 backdrop-blur-xl">
        <Loader2 className="size-4 animate-spin" />
        <span>{isExchanging ? "Finishing sign-in…" : "Loading…"}</span>
      </div>
    );
  }

  const ssoEnabled = Boolean(ssoPreCheck?.isEnabled);

  return (
    <Card className="glass-panel w-full max-w-sm py-6">
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={appPath("/logo.svg")}
              alt="FeatBit"
              className="size-11 rounded-lg bg-white p-1 shadow-sm ring-1 ring-border"
            />
            <div className="flex flex-col">
              <CardTitle className="text-lg font-black">
                FeatBit Experimentation
              </CardTitle>
              <CardDescription className="text-sm">
                Uses your FeatBit account.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {ssoEnabled && (
          <div
            role="tablist"
            className="surface-panel inline-flex self-start rounded-lg p-0.5 text-sm"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "password"}
              onClick={() => setActiveTab("password")}
              className={cn(
                "px-3 py-1 rounded-md transition-colors",
                activeTab === "password"
                  ? "bg-background shadow-sm text-foreground dark:bg-white/10"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Login
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "sso"}
              onClick={() => setActiveTab("sso")}
              className={cn(
                "px-3 py-1 rounded-md transition-colors",
                activeTab === "sso"
                  ? "bg-background shadow-sm text-foreground dark:bg-white/10"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              SSO
            </button>
          </div>
        )}

        {callbackError && (
          <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert">
            {callbackError}
          </p>
        )}

        {activeTab === "password" ? (
          <div className="flex flex-col gap-4">
            <PasswordLoginForm onAuthenticated={finishLogin} />

            {providers.length > 0 && (
              <>
                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-wide">
                    <span className="bg-card px-2 text-muted-foreground">
                      or
                    </span>
                  </div>
                </div>
                <OAuthButtons providers={providers} />
              </>
            )}
          </div>
        ) : (
          <SsoLoginForm defaultWorkspaceKey={ssoPreCheck?.workspaceKey} />
        )}

        <p className="text-center text-xs text-muted-foreground">
          Need help?{" "}
          <Link
            href="https://docs.featbit.co"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Read the FeatBit docs
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
