"use client";

import { AuthGuard } from "./auth-guard";

/**
 * AuthProvider is hoisted to the root layout so that cross-route-group
 * navigation does not unmount/remount it (which used to re-fire /me +
 * /workspaces + /organizations + /projects on every nav). This shell now
 * only adds the redirect-on-invalid guard for protected page groups.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
