import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router";
import {
  archiveLayer,
  createLayer,
  getExperiment,
  listExperiments,
  listLayers,
  updateLayer,
} from "@/lib/release-decision-client-data";
import { useAuth } from "@/lib/featbit-auth/auth-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Archive, Loader2, Layers3, Pencil, Plus, TriangleAlert } from "lucide-react";
import type { ExperimentDetail } from "@/lib/release-decision-client-data";
import type { ExperimentRun, Layer } from "@/lib/release-decision-types";

type LayerRun = {
  experimentId: string;
  experimentName: string;
  flagKey: string | null;
  run: ExperimentRun;
  start: number;
  end: number;
};

type LayerGroup = {
  key: string;
  layer: Layer | null;
  assignmentUnits: string[];
  runs: LayerRun[];
  activeRuns: LayerRun[];
  reservedTraffic: number;
  warnings: string[];
};

type LayerFormState = {
  id?: string;
  name: string;
  key: string;
  description: string;
  assignmentUnitSelector: string;
  status: string;
};

const ACTIVE_RUN_STATUSES = new Set(["draft", "collecting", "analyzing"]);

const emptyForm: LayerFormState = {
  name: "",
  key: "",
  description: "",
  assignmentUnitSelector: "user.keyId",
  status: "active",
};

function runLayerKey(run: ExperimentRun) {
  return run.layerKey?.trim() || run.layerId?.trim() || "";
}

function assignmentUnit(run: ExperimentRun) {
  return run.assignmentUnitSelector?.trim() || run.allocationKeySelector?.trim() || "user.keyId";
}

function sliceStart(run: ExperimentRun) {
  return clampPercent(run.sliceStart ?? run.trafficOffset ?? 0);
}

function sliceEnd(run: ExperimentRun) {
  const start = sliceStart(run);
  const fallbackEnd = start + clampPercent(run.layerTrafficPercent ?? run.trafficPercent ?? 100);
  return clampPercent(run.sliceEnd ?? fallbackEnd);
}

function runTraffic(run: ExperimentRun) {
  return Math.max(0, sliceEnd(run) - sliceStart(run));
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 1000}%`;
}

function normalizeLayerKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildLayerGroups(layers: Layer[], experiments: ExperimentDetail[]): LayerGroup[] {
  const map = new Map<string, { layer: Layer | null; runs: LayerRun[] }>();

  for (const layer of layers) {
    map.set(layer.key, { layer, runs: [] });
  }

  for (const experiment of experiments) {
    for (const run of experiment.experimentRuns ?? []) {
      const key = runLayerKey(run);
      if (!key) continue;

      const entry: LayerRun = {
        experimentId: experiment.id,
        experimentName: experiment.name,
        flagKey: experiment.flagKey,
        run,
        start: sliceStart(run),
        end: sliceEnd(run),
      };
      const existing = map.get(key) ?? { layer: null, runs: [] };
      existing.runs.push(entry);
      map.set(key, existing);
    }
  }

  return [...map.entries()]
    .map(([key, entry]) => {
      const runs = entry.runs;
      const activeRuns = runs.filter((item) =>
        ACTIVE_RUN_STATUSES.has(item.run.status),
      );
      const assignmentUnits = [
        ...new Set([
          entry.layer?.assignmentUnitSelector?.trim() || "",
          ...runs.map((item) => assignmentUnit(item.run)),
        ].filter(Boolean)),
      ].sort();
      const reservedTraffic = activeRuns.reduce(
        (sum, item) => sum + runTraffic(item.run),
        0,
      );
      const warnings: string[] = [];
      const activeByStart = [...activeRuns].sort((a, b) => a.start - b.start);

      if (assignmentUnits.length > 1) {
        warnings.push("Mixed assignment units in the same layer.");
      }
      for (let i = 1; i < activeByStart.length; i++) {
        if (activeByStart[i].start < activeByStart[i - 1].end) {
          warnings.push("Active run bucket ranges overlap.");
          break;
        }
      }
      if (reservedTraffic > 100) {
        warnings.push("Active runs reserve more than 100% of the layer.");
      }
      if (!entry.layer) {
        warnings.push("Layer key is used by runs but is not in the registry.");
      }

      return { key, layer: entry.layer, assignmentUnits, runs, activeRuns, reservedTraffic, warnings };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

function LayerBucketBar({ runs }: { runs: LayerRun[] }) {
  const activeRuns = runs.filter((item) => ACTIVE_RUN_STATUSES.has(item.run.status));

  return (
    <div className="relative h-8 overflow-hidden rounded-md border bg-muted/40">
      <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
      {activeRuns.map((item, index) => (
        <div
          key={item.run.id}
          className="absolute top-1 bottom-1 rounded-sm border border-primary/40 bg-primary/35"
          style={{
            left: `${item.start}%`,
            width: `${Math.max(0.75, item.end - item.start)}%`,
            opacity: 0.88 - Math.min(index, 4) * 0.08,
          }}
          title={`${item.experimentName}: ${formatPercent(item.start)}-${formatPercent(item.end)}`}
        />
      ))}
      <div className="absolute inset-x-2 bottom-0 flex justify-between text-[10px] text-muted-foreground">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}

function layerToForm(layer: Layer): LayerFormState {
  return {
    id: layer.id,
    name: layer.name,
    key: layer.key,
    description: layer.description ?? "",
    assignmentUnitSelector: layer.assignmentUnitSelector ?? "user.keyId",
    status: layer.status ?? "active",
  };
}

export function LayersClient() {
  const { isAuthenticated, sessionStatus, projectEnv } = useAuth();
  const [experiments, setExperiments] = useState<ExperimentDetail[]>([]);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<LayerFormState>(emptyForm);

  const load = async (cancelled?: { value: boolean }) => {
    if (!isAuthenticated || !projectEnv) {
      setLoading(sessionStatus === "checking" || sessionStatus === "unknown");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [registeredLayers, experimentItems] = await Promise.all([
        listLayers({ status: "" }),
        listExperiments(),
      ]);
      const details = await Promise.all(experimentItems.map((item) => getExperiment(item.id)));
      if (!cancelled?.value) {
        setLayers(registeredLayers);
        setExperiments(details);
      }
    } catch (err) {
      if (!cancelled?.value) {
        setError(err instanceof Error ? err.message : "Failed to load layers.");
      }
    } finally {
      if (!cancelled?.value) setLoading(false);
    }
  };

  useEffect(() => {
    const cancelled = { value: false };
    void load(cancelled);
    return () => {
      cancelled.value = true;
    };
  }, [isAuthenticated, projectEnv, sessionStatus]);

  const groups = useMemo(() => buildLayerGroups(layers, experiments), [layers, experiments]);
  const warningCount = groups.filter((layer) => layer.warnings.length > 0).length;

  const openCreate = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (layer: Layer) => {
    setForm(layerToForm(layer));
    setDialogOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        key: normalizeLayerKey(form.key),
        description: form.description.trim() || null,
        assignmentUnitSelector: "user.keyId",
        status: form.status,
      };
      if (form.id) {
        await updateLayer(form.id, payload);
      } else {
        await createLayer(payload);
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save layer.");
    } finally {
      setSaving(false);
    }
  };

  const archive = async (layer: Layer) => {
    setSaving(true);
    setError(null);
    try {
      await archiveLayer(layer.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive layer.");
    } finally {
      setSaving(false);
    }
  };

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
                Registry and bucket allocation view for mutually exclusive experiment layers.
              </p>
            </div>
            <div className="fb-right-actions">
              <span className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                {groups.length} layers
              </span>
              <span className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                {warningCount} warnings
              </span>
              <Button type="button" size="sm" onClick={openCreate}>
                <Plus className="size-3.5" />
                New layer
              </Button>
            </div>
          </div>
        </div>

        {error && <div className="fb-table-state error">{error}</div>}

        <div className="fb-table-wrapper">
          {loading ? (
            <div className="fb-table-state">
              <Loader2 className="size-4 animate-spin" />
              Loading layers...
            </div>
          ) : groups.length === 0 ? (
            <div className="fb-table-state">
              No layers yet. Create a layer before assigning experiment runs to bucket ranges.
            </div>
          ) : (
            <table className="fb-table">
              <thead>
                <tr>
                  <th>Layer</th>
                  <th>Assignment unit</th>
                  <th>Bucket allocation</th>
                  <th>Runs</th>
                  <th>Warnings</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.key}>
                    <td className="fb-name-cell">
                      <span className="font-semibold text-foreground">
                        {group.layer?.name ?? group.key}
                      </span>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="fb-code-pill">{group.key}</span>
                        <span className="fb-item-meta">{group.layer?.status ?? "unregistered"}</span>
                      </div>
                      {group.layer?.description && (
                        <div className="fb-item-meta mt-1 max-w-sm">
                          {group.layer.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {group.assignmentUnits.map((unit) => (
                          <span key={unit} className="fb-code-pill">
                            {unit}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="min-w-56">
                      <LayerBucketBar runs={group.runs} />
                      <div className="fb-item-meta mt-1">
                        active reserved {formatPercent(group.reservedTraffic)}
                      </div>
                    </td>
                    <td>
                      <div className="flex max-w-xl flex-col gap-1.5">
                        {group.runs.length === 0 ? (
                          <span className="fb-item-meta">No runs assigned</span>
                        ) : (
                          group.runs.map((item) => (
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
                                {item.run.status}, {formatPercent(item.start)}-{formatPercent(item.end)}
                              </span>
                              {item.flagKey && (
                                <span className="fb-item-meta">{item.flagKey}</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </td>
                    <td>
                      {group.warnings.length === 0 ? (
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          Clear
                        </span>
                      ) : (
                        <div className="flex max-w-md flex-col gap-1">
                          {group.warnings.map((warning) => (
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
                    <td>
                      {group.layer && (
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => openEdit(group.layer!)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          {group.layer.status !== "archived" && (
                            <Button type="button" variant="ghost" size="icon-sm" onClick={() => archive(group.layer!)}>
                              <Archive className="size-3.5" />
                            </Button>
                          )}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit Layer" : "New Layer"}</DialogTitle>
              <DialogDescription>
                Layer keys group experiments into a shared 0-100 bucket space.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="layer-name">Name</Label>
                <Input
                  id="layer-name"
                  value={form.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setForm((current) => ({
                      ...current,
                      name,
                      key: current.id || current.key ? current.key : normalizeLayerKey(name),
                    }));
                  }}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="layer-key">Key</Label>
                <Input
                  id="layer-key"
                  value={form.key}
                  onChange={(event) => setForm((current) => ({ ...current, key: normalizeLayerKey(event.target.value) }))}
                  className="font-mono"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="layer-assignment-unit">Assignment unit</Label>
                <Input
                  id="layer-assignment-unit"
                  value="user.keyId"
                  readOnly
                  className="bg-muted/40 font-mono"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="layer-description">Description</Label>
                <Textarea
                  id="layer-description"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
