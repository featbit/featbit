import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { getExperiment, listExperiments } from "@/lib/release-decision-client-data";
import { useAuth } from "@/lib/featbit-auth/auth-context";
import { Loader2, Layers3, TriangleAlert } from "lucide-react";
import type { ExperimentDetail } from "@/lib/release-decision-client-data";
import type { ExperimentRun } from "@/lib/release-decision-types";

type LayerRun = {
  experimentId: string;
  experimentName: string;
  flagKey: string | null;
  run: ExperimentRun;
};

type LayerGroup = {
  key: string;
  assignmentUnits: string[];
  runs: LayerRun[];
  activeRuns: LayerRun[];
  reservedTraffic: number;
  warnings: string[];
};

const ACTIVE_RUN_STATUSES = new Set(["draft", "collecting", "analyzing"]);

function runLayerKey(run: ExperimentRun) {
  return run.layerKey?.trim() || run.layerId?.trim() || "";
}

function assignmentUnit(run: ExperimentRun) {
  return run.assignmentUnitSelector?.trim() || run.allocationKeySelector?.trim() || "user.keyId";
}

function runTraffic(run: ExperimentRun) {
  return Math.max(0, Math.min(100, run.layerTrafficPercent ?? run.trafficPercent ?? 100));
}

function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 1000}%`;
}

function buildLayerGroups(experiments: ExperimentDetail[]): LayerGroup[] {
  const map = new Map<string, LayerRun[]>();

  for (const experiment of experiments) {
    for (const run of experiment.experimentRuns ?? []) {
      const key = runLayerKey(run);
      if (!key) continue;

      const entry: LayerRun = {
        experimentId: experiment.id,
        experimentName: experiment.name,
        flagKey: experiment.flagKey,
        run,
      };
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
  }

  return [...map.entries()]
    .map(([key, runs]) => {
      const activeRuns = runs.filter((item) =>
        ACTIVE_RUN_STATUSES.has(item.run.status),
      );
      const assignmentUnits = [
        ...new Set(runs.map((item) => assignmentUnit(item.run))),
      ].sort();
      const reservedTraffic = activeRuns.reduce(
        (sum, item) => sum + runTraffic(item.run),
        0,
      );
      const warnings: string[] = [];

      if (assignmentUnits.length > 1) {
        warnings.push("Mixed assignment units in the same layer.");
      }
      if (activeRuns.length > 1) {
        warnings.push(
          "Multiple active runs share this layer. Current run-level layer traffic is an eligibility gate and does not prove non-overlapping ranges.",
        );
      }
      if (reservedTraffic > 100) {
        warnings.push("Active runs reserve more than 100% of the layer.");
      }

      return { key, assignmentUnits, runs, activeRuns, reservedTraffic, warnings };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function LayersClient() {
  const { isAuthenticated, sessionStatus, projectEnv } = useAuth();
  const [experiments, setExperiments] = useState<ExperimentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !projectEnv) {
      setLoading(sessionStatus === "checking" || sessionStatus === "unknown");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    listExperiments()
      .then((items) => Promise.all(items.map((item) => getExperiment(item.id))))
      .then((details) => {
        if (!cancelled) setExperiments(details);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load layers.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, projectEnv, sessionStatus]);

  const layers = useMemo(() => buildLayerGroups(experiments), [experiments]);
  const warningCount = layers.filter((layer) => layer.warnings.length > 0).length;

  return (
    <section className="fb-list-page">
      <div className="fb-table-content">
        <div className="fb-table-search">
          <div className="fb-search-toolbar">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Layers3 className="size-4 text-primary" />
                Layers
              </div>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                Derived from experiment runs that set a layer key. This view helps
                find mutual-exclusion intent and overlap risk; it does not create
                or mutate FeatBit flag targeting.
              </p>
            </div>
            <div className="fb-right-actions">
              <span className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                {layers.length} layers
              </span>
              <span className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                {warningCount} warnings
              </span>
            </div>
          </div>
        </div>

        <div className="fb-table-wrapper">
          {loading ? (
            <div className="fb-table-state">
              <Loader2 className="size-4 animate-spin" />
              Loading layers...
            </div>
          ) : error ? (
            <div className="fb-table-state error">{error}</div>
          ) : layers.length === 0 ? (
            <div className="fb-table-state">
              No run layers yet. Configure a run with a layer key from its traffic
              settings to make it appear here.
            </div>
          ) : (
            <table className="fb-table">
              <thead>
                <tr>
                  <th>Layer</th>
                  <th>Assignment unit</th>
                  <th>Active traffic</th>
                  <th>Runs</th>
                  <th>Warnings</th>
                </tr>
              </thead>
              <tbody>
                {layers.map((layer) => (
                  <tr key={layer.key}>
                    <td className="fb-name-cell">
                      <span className="fb-code-pill">{layer.key}</span>
                      <div className="fb-item-meta">
                        {layer.activeRuns.length} active / {layer.runs.length} total runs
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {layer.assignmentUnits.map((unit) => (
                          <span key={unit} className="fb-code-pill">
                            {unit}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="font-semibold text-foreground">
                        {formatPercent(layer.reservedTraffic)}
                      </div>
                      <div className="fb-item-meta">
                        Sum of active run layer traffic
                      </div>
                    </td>
                    <td>
                      <div className="flex max-w-xl flex-col gap-1.5">
                        {layer.runs.map((item) => (
                          <div
                            key={item.run.id}
                            className="flex flex-wrap items-center gap-2 text-xs"
                          >
                            <Link
                              href={`/${item.experimentId}`}
                              className="font-semibold text-foreground hover:text-primary"
                            >
                              {item.experimentName}
                            </Link>
                            <span className="fb-code-pill">{item.run.slug}</span>
                            <span className="text-muted-foreground">
                              {item.run.status}, {formatPercent(runTraffic(item.run))}
                            </span>
                            {item.flagKey && (
                              <span className="fb-item-meta">{item.flagKey}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      {layer.warnings.length === 0 ? (
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          Clear
                        </span>
                      ) : (
                        <div className="flex max-w-md flex-col gap-1">
                          {layer.warnings.map((warning) => (
                            <span
                              key={warning}
                              className="inline-flex items-start gap-1 text-xs leading-relaxed text-amber-700 dark:text-amber-300"
                            >
                              <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                              {warning}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
