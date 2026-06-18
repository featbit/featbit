"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { identityService } from "@/lib/featbit-auth/identity-service";
import { userService } from "@/lib/featbit-auth/user-service";
import { FeatBitApiError } from "@/lib/featbit-auth/http";
import { Loader2 } from "lucide-react";

interface Props {
  onAuthenticated: (token: string) => Promise<void> | void;
}

export function PasswordLoginForm({ onAuthenticated }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceKey, setWorkspaceKey] = useState("");
  const [needsWorkspaceKey, setNeedsWorkspaceKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!identity) {
      setError("Please enter your email.");
      return;
    }
    startTransition(async () => {
      try {
        const hasMultiple = await userService.hasMultipleWorkspaces(identity);
        setNeedsWorkspaceKey(Boolean(hasMultiple));
        setStep(2);
      } catch (err) {
        setError(
          err instanceof FeatBitApiError
            ? err.message
            : "Unable to verify email. Please try again.",
        );
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    if (needsWorkspaceKey && !workspaceKey) {
      setError("Please enter your workspace key.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await identityService.loginByEmail(
          identity,
          password,
          workspaceKey || undefined,
        );
        await onAuthenticated(result.token);
      } catch (err) {
        setError(
          err instanceof FeatBitApiError
            ? err.message
            : "Login failed. Please check your credentials.",
        );
      }
    });
  };

  return (
    <form
      onSubmit={step === 1 ? handleContinue : handleSubmit}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="identity">Email</Label>
        <Input
          id="identity"
          type="email"
          autoComplete="email"
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          disabled={step === 2 || isPending}
          placeholder="you@company.com"
          required
        />
        {step === 2 && (
          <button
            type="button"
            className="self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => {
              setStep(1);
              setPassword("");
              setWorkspaceKey("");
              setError(null);
            }}
            disabled={isPending}
          >
            Use a different email
          </button>
        )}
      </div>

      {step === 2 && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
              autoFocus
              required
            />
          </div>

          {needsWorkspaceKey && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="workspaceKey">Workspace key</Label>
              <Input
                id="workspaceKey"
                type="text"
                value={workspaceKey}
                onChange={(e) => setWorkspaceKey(e.target.value)}
                disabled={isPending}
                placeholder="default"
                required
              />
              <p className="text-xs text-muted-foreground">
                Your account belongs to multiple workspaces. Enter the one you
                want to sign in to.
              </p>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending} className="w-full">
        {isPending && <Loader2 className="size-4 animate-spin" />}
        {step === 1 ? "Continue" : "Sign in"}
      </Button>
    </form>
  );
}
