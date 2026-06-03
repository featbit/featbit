"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/featbit-auth/auth-context";
import { appPath } from "@/lib/app-path";

function ConnectingSplash({ message }: { message: string }) {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-muted/30">
      <div className="flex flex-col items-center gap-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={appPath("/logo.svg")} alt="FeatBit" className="size-12 shadow-sm" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isReady, isAuthenticated, sessionStatus } = useAuth();
  const router = useRouter();

  const shouldRedirect = isReady && sessionStatus === "invalid" && !isAuthenticated;

  useEffect(() => {
    if (shouldRedirect) router.replace("/login");
  }, [shouldRedirect, router]);

  if (!isReady || sessionStatus === "checking" || sessionStatus === "unknown") {
    return <ConnectingSplash message="Loading…" />;
  }
  if (shouldRedirect) {
    return <ConnectingSplash message="Redirecting to sign-in…" />;
  }
  return <>{children}</>;
}
