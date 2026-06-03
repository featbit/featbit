"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ssoService } from "@/lib/featbit-auth/sso-service";
import { authStorage } from "@/lib/featbit-auth/storage";
import { FeatBitApiError } from "@/lib/featbit-auth/http";
import { Loader2, Shield } from "lucide-react";

interface Props {
  defaultWorkspaceKey?: string;
}

export function SsoLoginForm({ defaultWorkspaceKey }: Props) {
  const [workspaceKey, setWorkspaceKey] = useState(defaultWorkspaceKey || "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!workspaceKey) {
      setError("Please enter your workspace key.");
      return;
    }
    startTransition(async () => {
      try {
        authStorage.setSsoWorkspaceKey(workspaceKey);
        const { origin, pathname } = window.location;
        const redirectUri = `${origin}${pathname}?sso-logged-in=true`;
        const authorizeUrl = await ssoService.getAuthorizeUrl(
          workspaceKey,
          redirectUri,
        );
        if (typeof authorizeUrl !== "string" || !authorizeUrl) {
          throw new Error("Invalid SSO authorize URL");
        }
        window.location.href = authorizeUrl;
      } catch (err) {
        setError(
          err instanceof FeatBitApiError
            ? err.message
            : "Unable to start SSO login. Please check the workspace key.",
        );
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="sso-workspace">Workspace key</Label>
        <Input
          id="sso-workspace"
          type="text"
          value={workspaceKey}
          onChange={(e) => setWorkspaceKey(e.target.value)}
          disabled={isPending}
          placeholder="your-workspace"
          required
        />
        <p className="text-xs text-muted-foreground">
          Your organization administrator can tell you the workspace key.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending} className="w-full">
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Shield className="size-4" />
        )}
        Continue with SSO
      </Button>
    </form>
  );
}
