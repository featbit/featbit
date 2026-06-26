import { useState, useTransition } from "react";
import { useRouter } from "@/lib/router";
import { Beaker, Filter, GitBranch, Layers3, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateExperimentRunAudienceAction } from "@/lib/actions";
import type { ExperimentRun } from "@/lib/release-decision-types";
import {
  parseVariantIdentities,
  splitVariantTokens,
  VariantIdCopyButton,
  VariantIdentityInline,
  type VariantIdentity,
} from "./variant-identity";

type Op = "eq" | "neq" | "in" | "nin";

type FilterEntry = {
  property: string;
  op: Op;
  value: string;
  values: string;
};

type SamplingRole = "control" | "treatment" | "holdout" | "exclude";

type SamplingPlanEntry = {
  variation: string;
  role: SamplingRole;
  includeRate: number;
  label?: string;
};

type VariantRow = VariantIdentity;

function parseFilters(json: string | null): FilterEntry[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.map((f: Record<string, unknown>) => ({
      property: typeof f.property === "string" ? f.property : "",
      op: (["eq", "neq", "in", "nin"].includes(f.op as string) ? f.op : "eq") as Op,
      value: typeof f.value === "string" ? f.value : "",
      values: Array.isArray(f.values) ? (f.values as string[]).join(", ") : "",
    }));
  } catch {
    return [];
  }
}

function serializeFilters(rows: FilterEntry[]): string {
  const entries = rows
    .filter((r) => r.property.trim())
    .map((r) => {
      if (r.op === "in" || r.op === "nin") {
        return {
          property: r.property.trim(),
          op: r.op,
          values: r.values
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
        };
      }
      return { property: r.property.trim(), op: r.op, value: r.value.trim() };
    });
  return JSON.stringify(entries);
}

function clampPercent(value: number, min = 0, max = 100) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function formatPercent(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, "");
}

function selectedVariantKeys(control: string, treatments: string[]) {
  return [control, ...treatments].filter(Boolean).filter((key, index, arr) => arr.indexOf(key) === index);
}

function normalizeRole(value: unknown): SamplingRole {
  return value === "control" || value === "holdout" || value === "exclude" ? value : "treatment";
}

function parseSamplingPlan(
  json: string | null,
  control: string,
  treatments: string[],
  variantRows: VariantRow[],
) {
  const fallback = selectedVariantKeys(control, treatments).map((variation) => ({
    variation,
    role: variation === control ? "control" as SamplingRole : "treatment" as SamplingRole,
    includeRate: 100,
    label: variantRows.find((row) => row.key === variation)?.name ?? variation,
  }));

  if (!json) return fallback;
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return fallback;
    const parsed = arr
      .map((entry: Record<string, unknown>): SamplingPlanEntry => ({
        variation: typeof entry.variation === "string" ? entry.variation : "",
        role: normalizeRole(entry.role),
        includeRate: clampPercent(Number(entry.includeRate), 0, 100),
        label: typeof entry.label === "string" ? entry.label : undefined,
      }))
      .filter((entry) => entry.variation);

    return parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function buildSamplingPlan(
  control: string,
  treatments: string[],
  variantRows: VariantRow[],
  includeRates: Record<string, string>,
) {
  return selectedVariantKeys(control, treatments).map((variation): SamplingPlanEntry => ({
    variation,
    role: variation === control ? "control" : "treatment",
    includeRate: clampPercent(Number(includeRates[variation] ?? 100), 0, 100),
    label: variantRows.find((row) => row.key === variation)?.name ?? variation,
  }));
}

function normalizeVariantSelection(
  nextMethod: string,
  nextControl: string,
  nextTreatments: string[],
  variantRows: VariantRow[],
) {
  const validKeys = new Set(variantRows.map((variant) => variant.key));
  const fallbackControl = nextControl || variantRows[0]?.key || "";
  const control = validKeys.has(fallbackControl) ? fallbackControl : variantRows[0]?.key || "";
  const nonControl = variantRows.map((variant) => variant.key).filter((key) => key !== control);
  const selected = nextTreatments.filter(
    (key, index, arr) => key !== control && validKeys.has(key) && arr.indexOf(key) === index,
  );

  return {
    control,
    treatments: selected.length > 0 ? selected : nonControl,
  };
}

function VariantRowIdentity({ variant }: { variant: VariantRow }) {
  return (
    <VariantIdentityInline
      token={variant.key}
      variants={[variant]}
      className="min-w-0 flex-1"
      showCopy={false}
    />
  );
}

function includeRatesFromPlan(plan: SamplingPlanEntry[], variants: string[]) {
  const map = new Map(plan.map((entry) => [entry.variation, entry.includeRate]));
  return Object.fromEntries(variants.map((variant) => [variant, formatPercent(map.get(variant) ?? 100)]));
}

export function ExperimentRunTrafficConfig({
  experimentRun,
  experimentId,
  variants,
}: {
  experimentRun: ExperimentRun;
  experimentId: string;
  variants?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<FilterEntry[]>([]);
  const [method, setMethod] = useState(experimentRun.method ?? "bayesian_ab");
  const [controlVariant, setControlVariant] = useState("");
  const [treatmentVariants, setTreatmentVariants] = useState<string[]>([]);
  const [layerKeyValue, setLayerKeyValue] = useState("");
  const [assignmentUnitSelectorValue, setAssignmentUnitSelectorValue] = useState("user.keyId");
  const [layerTrafficPercentValue, setLayerTrafficPercentValue] = useState("100");
  const [includeRates, setIncludeRates] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const variantRows = parseVariantIdentities(variants);
  const currentMethod = experimentRun.method ?? "bayesian_ab";
  const isBandit = currentMethod === "bandit";
  const runTreatments = splitVariantTokens(experimentRun.treatmentVariant);
  const layerKey = experimentRun.layerKey ?? experimentRun.layerId;
  const assignmentUnitSelector =
    experimentRun.assignmentUnitSelector ?? experimentRun.allocationKeySelector ?? "user.keyId";
  const layerTrafficPercent = experimentRun.layerTrafficPercent ?? experimentRun.trafficPercent ?? 100;
  const parsedFilters = parseFilters(experimentRun.audienceFilters as string | null);
  const parsedSamplingPlan = parseSamplingPlan(
    experimentRun.analysisSamplingPlan,
    experimentRun.controlVariant ?? "",
    runTreatments,
    variantRows,
  );
  const hasCustomTraffic =
    Boolean(layerKey) ||
    layerTrafficPercent < 100 ||
    assignmentUnitSelector !== "user.keyId" ||
    parsedSamplingPlan.some((entry) => entry.includeRate < 100) ||
    parsedFilters.length > 0;
  const selectedKeys = selectedVariantKeys(controlVariant, treatmentVariants);

  function handleOpen() {
    const nextMethod = experimentRun.method ?? "bayesian_ab";
    const normalized = normalizeVariantSelection(
      nextMethod,
      experimentRun.controlVariant ?? variantRows[0]?.key ?? "",
      splitVariantTokens(experimentRun.treatmentVariant),
      variantRows,
    );
    const plan = parseSamplingPlan(
      experimentRun.analysisSamplingPlan,
      normalized.control,
      normalized.treatments,
      variantRows,
    );

    setFilters(parseFilters(experimentRun.audienceFilters as string | null));
    setMethod(nextMethod);
    setControlVariant(normalized.control);
    setTreatmentVariants(normalized.treatments);
    setLayerKeyValue(layerKey ?? "");
    setAssignmentUnitSelectorValue(assignmentUnitSelector);
    setLayerTrafficPercentValue(formatPercent(layerTrafficPercent));
    setIncludeRates(includeRatesFromPlan(plan, selectedVariantKeys(normalized.control, normalized.treatments)));
    setOpen(true);
  }

  function handleSubmit(formData: FormData) {
    const samplingPlan = buildSamplingPlan(controlVariant, treatmentVariants, variantRows, includeRates);

    formData.set("audienceFilters", serializeFilters(filters));
    formData.set("controlVariant", controlVariant);
    formData.set("treatmentVariant", treatmentVariants.join("|"));
    formData.set("layerKey", layerKeyValue.trim());
    formData.set("layerId", layerKeyValue.trim());
    formData.set("assignmentUnitSelector", assignmentUnitSelectorValue.trim() || "user.keyId");
    formData.set("allocationKeySelector", assignmentUnitSelectorValue.trim() || "user.keyId");
                  formData.set("layerTrafficPercent", String(clampPercent(Number(layerTrafficPercentValue), 0, 100)));
    formData.set("analysisSamplingPlan", JSON.stringify(samplingPlan));
    formData.set("allocationPlan", "");
    startTransition(async () => {
      await updateExperimentRunAudienceAction(formData);
      router.refresh();
      setOpen(false);
    });
  }

  function addRow() {
    setFilters((prev) => [...prev, { property: "", op: "eq", value: "", values: "" }]);
  }

  function removeRow(i: number) {
    setFilters((prev) => prev.filter((_, j) => j !== i));
  }

  function updateRow(i: number, patch: Partial<FilterEntry>) {
    setFilters((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function resetIncludeRates(nextControl: string, nextTreatments: string[]) {
    const keys = selectedVariantKeys(nextControl, nextTreatments);
    setIncludeRates((prev) => Object.fromEntries(keys.map((key) => [key, prev[key] ?? "100"])));
  }

  function changeMethod(nextMethod: string) {
    const normalized = normalizeVariantSelection(nextMethod, controlVariant, treatmentVariants, variantRows);
    setMethod(nextMethod);
    setControlVariant(normalized.control);
    setTreatmentVariants(normalized.treatments);
    resetIncludeRates(normalized.control, normalized.treatments);
  }

  function changeControl(nextControl: string) {
    const normalized = normalizeVariantSelection(method, nextControl, treatmentVariants, variantRows);
    setControlVariant(normalized.control);
    setTreatmentVariants(normalized.treatments);
    resetIncludeRates(normalized.control, normalized.treatments);
  }

  function toggleTreatmentVariant(key: string, checked: boolean) {
    const normalized = normalizeVariantSelection(
      method,
      controlVariant,
      checked ? [...treatmentVariants, key] : treatmentVariants.filter((item) => item !== key),
      variantRows,
    );
    setControlVariant(normalized.control);
    setTreatmentVariants(normalized.treatments);
    resetIncludeRates(normalized.control, normalized.treatments);
  }

  function applyAllExposurePreset() {
    setIncludeRates(Object.fromEntries(selectedKeys.map((key) => [key, "100"])));
  }

  function applyNinetyTenPreset() {
    if (!controlVariant || treatmentVariants.length !== 1) return;
    setIncludeRates({
      [controlVariant]: "11.111",
      [treatmentVariants[0]]: "100",
    });
  }

  return (
    <>
      <div className="flex items-start gap-2 min-h-5">
        <div className="flex-1 space-y-1.5 text-xs">
          {isBandit && (
            <Badge className="bg-amber-100 px-1.5 py-0 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              <Beaker className="mr-0.5 inline size-2.5" />
              Bandit
            </Badge>
          )}

          <div className="flex items-center gap-1.5 text-[11px]">
            <GitBranch className="size-3 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-medium">{isBandit ? "Bandit arms" : "Bayesian A/B/n"}</span>
              <span className="text-muted-foreground"> — actual flag variations are sampled for analysis</span>
            </span>
          </div>

          <div className="grid gap-1 text-[11px]">
            {experimentRun.controlVariant ? (
              <VariantIdentityInline
                token={experimentRun.controlVariant}
                variants={variantRows}
                role={isBandit ? "Baseline" : "Control"}
                className="min-w-0"
              />
            ) : (
              <span className="text-muted-foreground">Control not set</span>
            )}
            {runTreatments.map((variant, index) => (
              <VariantIdentityInline
                key={`${variant}-${index}`}
                token={variant}
                variants={variantRows}
                role={isBandit ? "Arm" : runTreatments.length > 1 ? `Treatment ${index + 1}` : "Treatment"}
                className="min-w-0"
              />
            ))}
          </div>

          {hasCustomTraffic ? (
            <div className="space-y-1 text-[11px]">
              <div className="flex flex-wrap items-center gap-2">
                {layerKey && (
                  <span className="text-muted-foreground">
                    Layer <span className="font-mono font-medium text-foreground">{layerKey}</span>
                  </span>
                )}
                {layerTrafficPercent < 100 && (
                  <span className="text-muted-foreground">
                    Eligible <span className="font-mono font-medium text-foreground">{formatPercent(layerTrafficPercent)}%</span>
                  </span>
                )}
                {assignmentUnitSelector !== "user.keyId" && (
                  <span className="text-muted-foreground">
                    Unit <span className="font-mono font-medium text-foreground">{assignmentUnitSelector}</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {parsedSamplingPlan
                  .filter((entry) => entry.includeRate < 100 || entry.role !== "treatment")
                  .map((entry) => (
                    <Badge key={`${entry.variation}-${entry.role}`} variant="outline" className="text-[10px] font-normal">
                      {entry.role}: {entry.variation} · {formatPercent(entry.includeRate)}%
                    </Badge>
                  ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Filter className="size-3" />
              All eligible exposure enters analysis
            </div>
          )}
        </div>

        <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" onClick={handleOpen}>
          <Pencil className="size-3.5" />
          <span className="sr-only">Configure run analysis traffic</span>
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="min-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Run Analysis Method & Traffic</DialogTitle>
            <DialogDescription>
              Configure how this run reads actual exposure, layer eligibility, and analysis sampling.
            </DialogDescription>
          </DialogHeader>

          <form action={handleSubmit} className="space-y-5">
            <input type="hidden" name="experimentId" value={experimentId} />
            <input type="hidden" name="experimentRunId" value={experimentRun.id} />
            <input type="hidden" name="method" value={method} />

            <section className="space-y-2">
              <div className="space-y-0.5">
                <Label className="text-xs">Analysis Method</Label>
                <div className="flex items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      name="_method"
                      value="bayesian_ab"
                      checked={method === "bayesian_ab"}
                      onChange={() => changeMethod("bayesian_ab")}
                      className="size-3.5"
                    />
                    <span className="text-xs">Bayesian A/B/n</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      name="_method"
                      value="bandit"
                      checked={method === "bandit"}
                      onChange={() => changeMethod("bandit")}
                      className="size-3.5"
                    />
                    <span className="text-xs">Bandit</span>
                  </label>
                </div>
              </div>
            </section>

            <section className="space-y-2 rounded-md border bg-muted/15 px-3 py-2.5">
              <div className="space-y-0.5">
                <Label className="text-xs">Feature Flag State</Label>
                <p className="text-[10px] text-muted-foreground">
                  Actual flag evaluation decides the served variation. This run only decides which exposure is eligible and sampled for analysis.
                </p>
              </div>
              <div className="grid min-w-0 gap-1.5">
                {variantRows.map((variant) => (
                  <div key={variant.key} className="flex min-w-0 items-center gap-2 rounded border bg-background/70 px-2 py-1.5 text-xs">
                    <VariantRowIdentity variant={variant} />
                    <VariantIdCopyButton id={variant.key} />
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2 rounded-md border bg-muted/15 px-3 py-2.5">
              <div className="space-y-0.5">
                <Label className="text-xs">{method === "bandit" ? "Baseline & Arms" : "Control & Treatments"}</Label>
                <p className="text-[10px] text-muted-foreground">
                  These roles label actual variations for analysis; they do not change FeatBit flag targeting.
                </p>
              </div>

              <div className="grid min-w-0 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {method === "bandit" ? "Baseline / control" : "Control"}
                  </Label>
                  {variantRows.map((variant) => (
                    <div
                      key={variant.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => changeControl(variant.key)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          changeControl(variant.key);
                        }
                      }}
                      className="flex min-w-0 cursor-pointer items-center gap-2 rounded border bg-background/70 px-2 py-1.5 text-xs"
                    >
                      <input
                        type="radio"
                        checked={controlVariant === variant.key}
                        onChange={() => changeControl(variant.key)}
                        onClick={(event) => event.stopPropagation()}
                        className="size-3.5"
                      />
                      <VariantRowIdentity variant={variant} />
                      <VariantIdCopyButton id={variant.key} />
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {method === "bandit" ? "Additional arms" : "Treatments"}
                  </Label>
                  {variantRows
                    .filter((variant) => variant.key !== controlVariant)
                    .map((variant) => (
                      <div
                        key={variant.key}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleTreatmentVariant(variant.key, !treatmentVariants.includes(variant.key))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleTreatmentVariant(variant.key, !treatmentVariants.includes(variant.key));
                          }
                        }}
                        className="flex min-w-0 cursor-pointer items-center gap-2 rounded border bg-background/70 px-2 py-1.5 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={treatmentVariants.includes(variant.key)}
                          onChange={(event) => toggleTreatmentVariant(variant.key, event.target.checked)}
                          onClick={(event) => event.stopPropagation()}
                          className="size-3.5"
                        />
                        <VariantRowIdentity variant={variant} />
                        <VariantIdCopyButton id={variant.key} />
                      </div>
                    ))}
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-md border px-3 py-2.5">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1.5 text-xs">
                  <Layers3 className="size-3.5" />
                  Layer Eligibility
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Layer limits which exposure is eligible for this run. It does not decide the served variation.
                </p>
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`lk-${experimentRun.id}`} className="text-xs">Layer key</Label>
                  <Input
                    id={`lk-${experimentRun.id}`}
                    value={layerKeyValue}
                    onChange={(event) => setLayerKeyValue(event.target.value)}
                    placeholder="e.g. homepage"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`au-${experimentRun.id}`} className="text-xs">Assignment unit</Label>
                  <Input
                    id={`au-${experimentRun.id}`}
                    value={assignmentUnitSelectorValue}
                    onChange={(event) => setAssignmentUnitSelectorValue(event.target.value)}
                    placeholder="user.keyId"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`lt-${experimentRun.id}`} className="text-xs">Layer traffic %</Label>
                  <Input
                    id={`lt-${experimentRun.id}`}
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={layerTrafficPercentValue}
                    onChange={(event) => setLayerTrafficPercentValue(event.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-md border px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-1.5 text-xs">
                    <SlidersHorizontal className="size-3.5" />
                    Analysis Sampling
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Include rate is inside the actual served variation. For a 90/10 flag split analyzed as 10/10, sample control at 11.111% and treatment at 100%.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={applyAllExposurePreset}>
                    Use all
                  </Button>
                  {selectedKeys.length === 2 && method !== "bandit" && (
                    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={applyNinetyTenPreset}>
                      90/10 → 10/10
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-1.5">
                {selectedKeys.map((key) => (
                  <div key={key} className="grid min-w-0 grid-cols-[minmax(0,1fr)_8rem] items-center gap-2 rounded border bg-background/70 px-2 py-1.5">
                    <VariantIdentityInline
                      token={key}
                      variants={variantRows}
                      role={key === controlVariant ? "Control" : "Treatment"}
                      className="min-w-0"
                    />
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={includeRates[key] ?? "100"}
                        onChange={(event) =>
                          setIncludeRates((prev) => ({
                            ...prev,
                            [key]: event.target.value,
                          }))
                        }
                        className="h-7 text-xs"
                        aria-label={`Include rate for ${key}`}
                      />
                      <span className="whitespace-nowrap text-[10px] text-muted-foreground">% of variation</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Audience Filters</Label>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={addRow}>
                  <Plus className="mr-1 size-3" />
                  Add
                </Button>
              </div>

              {filters.length === 0 && (
                <p className="text-xs italic text-muted-foreground/50">No filters — all users eligible</p>
              )}

              {filters.map((f, i) => (
                <div key={i} className="grid min-w-0 grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)_auto] items-center gap-1.5">
                  <Input
                    value={f.property}
                    onChange={(e) => updateRow(i, { property: e.target.value })}
                    placeholder="property"
                    className="h-7 min-w-0 font-mono text-xs"
                  />
                  <select
                    value={f.op}
                    onChange={(e) => updateRow(i, { op: e.target.value as Op })}
                    className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
                  >
                    <option value="eq">eq</option>
                    <option value="neq">neq</option>
                    <option value="in">in</option>
                    <option value="nin">nin</option>
                  </select>
                  {f.op === "in" || f.op === "nin" ? (
                    <Input
                      value={f.values}
                      onChange={(e) => updateRow(i, { values: e.target.value })}
                      placeholder="a, b, c"
                      className="h-7 min-w-0 text-xs"
                    />
                  ) : (
                    <Input
                      value={f.value}
                      onChange={(e) => updateRow(i, { value: e.target.value })}
                      placeholder="value"
                      className="h-7 min-w-0 text-xs"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Remove filter"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </section>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
