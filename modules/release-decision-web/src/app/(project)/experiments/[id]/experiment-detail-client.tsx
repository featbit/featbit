"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ExperimentDetailLayout } from "@/components/experiment/experiment-detail-layout";
import {
  EXPERIMENT_UPDATED_EVENT,
  getExperiment,
  type ExperimentDetail,
} from "@/lib/release-decision-client-data";
import { useAuth } from "@/lib/featbit-auth/auth-context";
import { FeatBitApiError } from "@/lib/featbit-auth/http";

function isResourceNotFound(err: unknown) {
  return (
    (err instanceof FeatBitApiError && err.status === 404) ||
    (err instanceof Error && err.message === "ResourceNotFound")
  );
}

export function ExperimentDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { isAuthenticated, projectEnv, sessionStatus } = useAuth();
  const [experiment, setExperiment] = useState<ExperimentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshExperiment = useCallback(async () => {
    try {
      const next = await getExperiment(id);
      setExperiment(next);
      return next;
    } catch (err) {
      if (isResourceNotFound(err)) {
        router.replace("/experiments");
        return null as never;
      }

      throw err;
    }
  }, [id, router]);

  useEffect(() => {
    if (!isAuthenticated || !projectEnv) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(sessionStatus === "checking" || sessionStatus === "unknown");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    refreshExperiment()
      .then((item) => {
        if (!cancelled) setExperiment(item);
      })
      .catch((err) => {
        if (!cancelled) {
          if (isResourceNotFound(err)) return;
          setError(err instanceof Error ? err.message : "Failed to load experiment.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated, projectEnv, refreshExperiment, sessionStatus]);

  useEffect(() => {
    const handler = (event: Event) => {
      const next = (event as CustomEvent<ExperimentDetail | null>).detail;
      if (next === null) {
        router.replace("/experiments");
        return;
      }

      if (next?.id === id) {
        setExperiment(next);
      }
    };

    window.addEventListener(EXPERIMENT_UPDATED_EVENT, handler);
    return () => window.removeEventListener(EXPERIMENT_UPDATED_EVENT, handler);
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading experiment...
      </div>
    );
  }

  if (error || !experiment) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-sm text-destructive">
        {error || "Experiment not found."}
      </div>
    );
  }

  return (
    <ExperimentDetailLayout
      experiment={experiment}
      onExperimentUpdated={refreshExperiment}
    />
  );
}
