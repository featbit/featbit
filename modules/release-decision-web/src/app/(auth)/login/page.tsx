"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { authStorage } from "@/lib/featbit-auth/storage";
import { appPath } from "@/lib/app-path";
import { featbitAppPath } from "@/lib/featbit-auth/config";

export default function LoginPage() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const fallbackRedirect = appPath("/");
    const redirect =
      new URLSearchParams(window.location.search).get("redirect") ||
      authStorage.getLoginRedirectUrl() ||
      fallbackRedirect;

    authStorage.setLoginRedirectUrl(redirect);
    window.location.replace(featbitAppPath("/login"));
  }, []);

  return (
    <div className="flex h-dvh w-full items-center justify-center bg-muted/30">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span>Redirecting to sign-in…</span>
      </div>
    </div>
  );
}
