"use client";

import { useEffect, useState } from "react";
import { Copy, Check, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/featbit-auth/auth-context";
import { mintEnvSecret } from "@/lib/track/env-secret-action";
import { cn } from "@/lib/utils";

interface EnvSecretCardProps {
  /** Extra classes applied to the wrapper (padding/width). */
  className?: string;
  /** Hide the outer border + card chrome when embedded in a denser layout. */
  bare?: boolean;
}

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; envSecret: string | null; hasSigningKey: boolean }
  | { status: "error"; message: string };

export function EnvSecretCard({ className, bare }: EnvSecretCardProps) {
  const { currentEnvironment, currentProject, organization } = useAuth();
  const envId = currentEnvironment?.id ?? null;

  const [state, setState] = useState<State>({ status: "idle" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!envId) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    mintEnvSecret(envId)
      .then((result) => {
        if (cancelled) return;
        setState({
          status: "ready",
          envSecret: result.envSecret,
          hasSigningKey: result.hasSigningKey,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to mint env secret",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [envId]);

  async function copy() {
    if (state.status !== "ready" || !state.envSecret) return;
    try {
      await navigator.clipboard.writeText(state.envSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied — noop */
    }
  }

  const chrome = bare
    ? "space-y-3"
    : "rounded-lg border bg-card px-4 py-3 space-y-3";

  return (
    <div className={cn(chrome, className)}>
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight">Env secret</div>
          <div className="text-[11px] text-muted-foreground leading-tight truncate">
            {organization?.name ? `${organization.name} · ` : ""}
            {currentProject?.name ?? "—"} :{" "}
            {currentEnvironment?.name ?? "no environment selected"}
          </div>
        </div>
      </div>

      {state.status === "idle" && (
        <p className="text-xs italic text-muted-foreground/70">
          Pick a project / environment from the top-right switcher to mint a
          secret.
        </p>
      )}

      {state.status === "loading" && (
        <p className="text-xs italic text-muted-foreground/70">Signing…</p>
      )}

      {state.status === "error" && (
        <p className="text-xs text-destructive">{state.message}</p>
      )}

      {state.status === "ready" && (
        <>
          {state.hasSigningKey ? (
            <div className="flex items-center gap-2">
              <code
                className="flex-1 font-mono text-[11px] bg-muted rounded border px-2 py-1.5 overflow-x-auto whitespace-nowrap"
                title={state.envSecret ?? ""}
              >
                {state.envSecret}
              </code>
              <button
                type="button"
                onClick={copy}
                className="shrink-0 flex items-center justify-center size-8 rounded-md border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title={copied ? "Copied!" : "Copy to clipboard"}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </button>
            </div>
          ) : (
            <p className="text-xs italic text-muted-foreground/70 leading-relaxed">
              Server has no <code>TRACK_SERVICE_SIGNING_KEY</code> configured —
              track-service is running in legacy mode. Pass the raw env ID{" "}
              <code className="font-mono">{state.envSecret}</code> as the{" "}
              <code>Authorization</code> header until signing is enabled.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground/70 leading-snug">
            Rotating <code>TRACK_SERVICE_SIGNING_KEY</code> invalidates every
            previously-minted secret. Plan rotations alongside SDK rollouts.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Returns the minted env secret for the currently-selected environment, or
 * `null` while loading / when no env is selected. Also exposes the fallback
 * `envId` so callers can render legacy-mode text.
 */
export function useCurrentEnvSecret() {
  const { currentEnvironment } = useAuth();
  const envId = currentEnvironment?.id ?? null;
  const [result, setResult] = useState<{
    envSecret: string | null;
    hasSigningKey: boolean;
    envId: string | null;
  }>({ envSecret: null, hasSigningKey: false, envId });

  useEffect(() => {
    if (!envId) {
      setResult({ envSecret: null, hasSigningKey: false, envId: null });
      return;
    }
    let cancelled = false;
    mintEnvSecret(envId).then((r) => {
      if (cancelled) return;
      setResult({ envSecret: r.envSecret, hasSigningKey: r.hasSigningKey, envId });
    });
    return () => {
      cancelled = true;
    };
  }, [envId]);

  return result;
}
