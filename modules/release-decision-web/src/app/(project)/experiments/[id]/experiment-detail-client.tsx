"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ExperimentDetailLayout } from "@/components/experiment/experiment-detail-layout";
import {
  EXPERIMENT_UPDATED_EVENT,
  getExperiment,
  type ExperimentDetail,
} from "@/lib/release-decision-client-data";
import { useAuth } from "@/lib/featbit-auth/auth-context";

export function ExperimentDetailClient({ id }: { id: string }) {
  const { isAuthenticated, projectEnv, sessionStatus } = useAuth();
  const [experiment, setExperiment] = useState<ExperimentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshExperiment = useCallback(async () => {
    const next = await getExperiment(id);
    setExperiment(next);
    return next;
  }, [id]);

  useEffect(() => {
    if (!isAuthenticated || !projectEnv) {
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
      const next = (event as CustomEvent<ExperimentDetail>).detail;
      if (next?.id === id) {
        setExperiment(next);
      }
    };

    window.addEventListener(EXPERIMENT_UPDATED_EVENT, handler);
    return () => window.removeEventListener(EXPERIMENT_UPDATED_EVENT, handler);
  }, [id]);

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
