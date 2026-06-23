"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getStage } from "@/lib/stages";
import { listExperiments } from "@/lib/release-decision-client-data";
import { useAuth } from "@/lib/featbit-auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, Search, X } from "lucide-react";
import type { Experiment } from "@/lib/release-decision-types";

type ExperimentListItem = Experiment & {
  runCount?: number | null;
  runMethodSummary?: string | null;
};

const STAGE_OPTIONS = [
  { value: "", label: "All stages" },
  { value: "hypothesis", label: "Intent & Hypothesis" },
  { value: "implementing", label: "Exposure" },
  { value: "measuring", label: "Measuring" },
  { value: "learning", label: "Learning" },
];

function readInitialFilters() {
  if (typeof window === "undefined") {
    return { name: "", stage: "", flagKey: "" };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    name: params.get("name") ?? "",
    stage: params.get("stage") ?? "",
    flagKey: params.get("flagKey") ?? "",
  };
}

function updateFilterUrl(filters: {
  name: string;
  stage: string;
  flagKey: string;
}) {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams();
  if (filters.name.trim()) params.set("name", filters.name.trim());
  if (filters.stage.trim()) params.set("stage", filters.stage.trim());
  if (filters.flagKey.trim()) params.set("flagKey", filters.flagKey.trim());

  const next = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;
  window.history.replaceState(null, "", next);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function ExperimentsClient() {
  const { isAuthenticated, sessionStatus, projectEnv } = useAuth();
  const [experiments, setExperiments] = useState<ExperimentListItem[]>([]);
  const [filters, setFilters] = useState(readInitialFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !projectEnv) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(sessionStatus === "checking" || sessionStatus === "unknown");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    listExperiments(filters)
      .then((items) => {
        if (!cancelled) setExperiments(items);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load experiments.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters, isAuthenticated, projectEnv, sessionStatus]);

  useEffect(() => {
    updateFilterUrl(filters);
  }, [filters]);

  const activeFilterCount = useMemo(
    () =>
      [filters.name, filters.stage, filters.flagKey].filter((value) =>
        value.trim(),
      ).length,
    [filters],
  );

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters({ name: "", stage: "", flagKey: "" });
  }

  return (
    <section className="fb-list-page">
      <div className="fb-table-content">
        <div className="fb-table-search">
          <div className="fb-search-toolbar">
            <div className="fb-left-filters">
              <label className="fb-main-search">
                <Search className="size-4" aria-hidden="true" />
                <Input
                  type="search"
                  placeholder="Filter experiments by name"
                  value={filters.name}
                  onChange={(event) => updateFilter("name", event.target.value)}
                  className="fb-filter-input"
                />
              </label>
              <label className="fb-main-search single">
                <span className="fb-filter-prefix">Flag</span>
                <Input
                  type="search"
                  placeholder="Feature flag key"
                  value={filters.flagKey}
                  onChange={(event) => updateFilter("flagKey", event.target.value)}
                  className="fb-filter-input"
                />
              </label>
              <select
                aria-label="Experiment stage"
                value={filters.stage}
                onChange={(event) => updateFilter("stage", event.target.value)}
                className="fb-filter-select"
              >
                {STAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="fb-dashed-button active"
                  onClick={clearFilters}
                >
                  <X className="size-3.5" />
                  Clear filters
                </button>
              )}
            </div>
            <div className="fb-right-actions">
              <Button
                nativeButton={false}
                render={<Link href="/new" />}
                className="fb-primary-action"
              >
                <Plus className="size-4" data-icon="inline-start" />
                Add
              </Button>
            </div>
          </div>
        </div>

        <div className="fb-table-wrapper">
          {loading ? (
            <div className="fb-table-state">
              <Loader2 className="size-4 animate-spin" />
              Loading experiments...
            </div>
          ) : error ? (
            <div className="fb-table-state error">{error}</div>
          ) : experiments.length === 0 ? (
            <div className="fb-table-state">
              {activeFilterCount > 0
                ? "No experiments match the current filters."
                : "No experiments yet."}
            </div>
          ) : (
            <table className="fb-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Feature flag</th>
                  <th>Runs</th>
                  <th>Stage</th>
                  <th>Last change</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((experiment) => {
                  const stage = getStage(experiment.stage);
                  return (
                    <tr key={experiment.id}>
                      <td className="fb-name-cell">
                        <Link className="fb-item-name" href={`/${experiment.id}`}>
                          {experiment.name}
                        </Link>
                        {experiment.description && (
                          <div className="fb-item-meta">
                            {experiment.description}
                          </div>
                        )}
                      </td>
                      <td>
                        {experiment.flagKey ? (
                          <button
                            type="button"
                            className="fb-code-pill"
                            onClick={() =>
                              updateFilter("flagKey", experiment.flagKey ?? "")
                            }
                            title="Filter by this flag key"
                          >
                            {experiment.flagKey}
                          </button>
                        ) : (
                          <span className="fb-muted-text">Not bound</span>
                        )}
                      </td>
                      <td className="fb-runs-cell">
                        {(experiment.runCount ?? 0) > 0 ? (
                          <>
                            <div className="fb-run-count">
                              {experiment.runCount}{" "}
                              {experiment.runCount === 1 ? "run" : "runs"}
                            </div>
                            <div className="fb-item-meta">
                              {experiment.runMethodSummary ?? "Bayesian"}
                            </div>
                          </>
                        ) : (
                          <span className="fb-muted-text">No runs</span>
                        )}
                      </td>
                      <td>
                        <span className={`fb-stage-badge ${stage.color}`}>
                          {stage.label}
                        </span>
                      </td>
                      <td className="fb-last-change">
                        <div>{formatDate(experiment.updatedAt)}</div>
                        <span>Updated</span>
                      </td>
                      <td className="fb-actions-cell">
                        <Link className="fb-action-link primary" href={`/${experiment.id}`}>
                          Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
