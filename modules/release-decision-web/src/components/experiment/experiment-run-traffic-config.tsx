"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Beaker, Filter, GitBranch, Pencil, Percent, Plus, Trash2 } from "lucide-react";
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
import type { ExperimentRun } from "@/generated/prisma";

/* ── Types ── */

type Op = "eq" | "neq" | "in" | "nin";

type FilterEntry = {
  property: string;
  op: Op;
  value: string;
  values: string; // comma-separated string for in/nin ops
};

type VariantRow = {
  key: string;
  description: string;
};

/* ── Helpers ── */

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

function parseVariantsToRows(variants: string | null | undefined): VariantRow[] {
  if (!variants) return [];
  const raw = variants.trim();
  if (!raw) return [];

  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as Array<{
        key?: string;
        name?: string;
        description?: string;
      }>;
      return parsed
        .map((variant) => ({
          key: variant.key ?? variant.name ?? "",
          description: variant.description ?? "",
        }))
        .filter((variant) => variant.key);
    } catch {
      return [];
    }
  }

  return raw
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(.+?)\s*\((.+)\)\s*$/);
      return match
        ? { key: match[1].trim(), description: match[2].trim() }
        : { key: item, description: "" };
    });
}

function splitVariants(value: string | null | undefined) {
  return (value ?? "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeVariantSelection(
  nextMethod: string,
  nextControl: string,
  nextTreatments: string[],
  variantRows: VariantRow[],
) {
  const validKeys = new Set(variantRows.map((variant) => variant.key));
  const fallbackControl = nextControl || variantRows[0]?.key || "";
  const control = validKeys.has(fallbackControl)
    ? fallbackControl
    : variantRows[0]?.key || "";
  const nonControl = variantRows
    .map((variant) => variant.key)
    .filter((key) => key !== control);
  const selected = nextTreatments.filter(
    (key, index, arr) =>
      key !== control && validKeys.has(key) && arr.indexOf(key) === index,
  );

  if (nextMethod === "bandit") {
    return {
      control,
      treatments: selected.length > 0 ? selected : nonControl,
    };
  }

  return {
    control,
    treatments: [selected[0] ?? nonControl[0]].filter(Boolean),
  };
}

/* ── Component ── */

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
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const variantRows = parseVariantsToRows(variants);
  const pct = experimentRun.trafficPercent ?? 100;
  const offset = experimentRun.trafficOffset ?? 0;
  const currentMethod = experimentRun.method ?? "bayesian_ab";
  const parsedFilters = parseFilters(experimentRun.audienceFilters as string | null);
  const isBandit = currentMethod !== "bayesian_ab";
  const hasCustomTraffic = pct < 100 || offset > 0 || experimentRun.layerId || parsedFilters.length > 0;
  const runTreatments = splitVariants(experimentRun.treatmentVariant);

  function handleOpen() {
    const nextMethod = experimentRun.method ?? "bayesian_ab";
    const normalized = normalizeVariantSelection(
      nextMethod,
      experimentRun.controlVariant ?? variantRows[0]?.key ?? "",
      splitVariants(experimentRun.treatmentVariant),
      variantRows,
    );

    setFilters(parseFilters(experimentRun.audienceFilters as string | null));
    setMethod(nextMethod);
    setControlVariant(normalized.control);
    setTreatmentVariants(normalized.treatments);
    setOpen(true);
  }

  function handleSubmit(formData: FormData) {
    const serialized = serializeFilters(filters);
    formData.set("audienceFilters", serialized);
    formData.set("controlVariant", controlVariant);
    formData.set("treatmentVariant", treatmentVariants.join("|"));
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

  function changeMethod(nextMethod: string) {
    const normalized = normalizeVariantSelection(
      nextMethod,
      controlVariant,
      treatmentVariants,
      variantRows,
    );

    setMethod(nextMethod);
    setControlVariant(normalized.control);
    setTreatmentVariants(normalized.treatments);
  }

  function changeControl(nextControl: string) {
    const normalized = normalizeVariantSelection(
      method,
      nextControl,
      treatmentVariants,
      variantRows,
    );

    setControlVariant(normalized.control);
    setTreatmentVariants(normalized.treatments);
  }

  function setSingleTreatment(nextTreatment: string) {
    const normalized = normalizeVariantSelection(
      method,
      controlVariant,
      [nextTreatment],
      variantRows,
    );

    setControlVariant(normalized.control);
    setTreatmentVariants(normalized.treatments);
  }

  function toggleBanditArm(key: string, checked: boolean) {
    const normalized = normalizeVariantSelection(
      method,
      controlVariant,
      checked
        ? [...treatmentVariants, key]
        : treatmentVariants.filter((item) => item !== key),
      variantRows,
    );

    setControlVariant(normalized.control);
    setTreatmentVariants(normalized.treatments);
  }

  return (
    <>
      {/* ── Read-only display ── */}
      <div className="flex items-start gap-2 min-h-5">
        <div className="flex-1 space-y-1.5 text-xs">
          {/* Method */}
          {isBandit && (
            <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              <Beaker className="inline size-2.5 mr-0.5" />
              Bandit
            </Badge>
          )}

          {/* Variant allocation */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <Percent className="size-3 text-muted-foreground shrink-0" />
            {isBandit ? (
              <span>
                <span className="font-medium">Dynamic allocation</span>
                <span className="text-muted-foreground"> — traffic reweighted automatically toward the winning variant</span>
              </span>
            ) : (
              <span>
                <span className="font-medium">Even split (50 / 50)</span>
                <span className="text-muted-foreground"> — equal traffic per variant</span>
              </span>
            )}
          </div>

          <div className="flex items-start gap-1.5 text-[11px]">
            <GitBranch className="size-3 text-muted-foreground shrink-0 mt-0.5" />
            {experimentRun.controlVariant || runTreatments.length > 0 ? (
              isBandit ? (
                <span>
                  <span className="font-medium">Baseline:</span>{" "}
                  <span className="font-mono">{experimentRun.controlVariant ?? "not set"}</span>
                  <span className="text-muted-foreground"> · Arms: </span>
                  <span className="font-mono">
                    {[experimentRun.controlVariant, ...runTreatments]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </span>
              ) : (
                <span>
                  <span className="font-medium">Control:</span>{" "}
                  <span className="font-mono">{experimentRun.controlVariant ?? "not set"}</span>
                  <span className="text-muted-foreground"> · Treatment: </span>
                  <span className="font-mono">{runTreatments[0] ?? "not set"}</span>
                </span>
              )
            ) : (
              <span>
                <span className="font-medium">Variants not assigned</span>
                <span className="text-muted-foreground"> — choose control and treatment/arms</span>
              </span>
            )}
          </div>

          {/* Traffic scope */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <Filter className="size-3 text-muted-foreground shrink-0" />
            {hasCustomTraffic ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {(pct < 100 || offset > 0) && (
                    <span>
                      Bucket <span className="font-mono font-medium">[{offset}, {offset + pct})</span>
                      <span className="text-muted-foreground"> of flag traffic</span>
                    </span>
                  )}
                  {experimentRun.layerId && (
                    <span className="text-muted-foreground">
                      Layer:&nbsp;
                      <span className="font-mono font-medium text-foreground">
                        {experimentRun.layerId as string}
                      </span>
                    </span>
                  )}
                </div>
                {parsedFilters.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {parsedFilters.map((f, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] font-normal gap-0.5">
                        <Filter className="size-2.5" />
                        {f.property}&nbsp;{f.op}&nbsp;
                        {f.op === "in" || f.op === "nin" ? `[${f.values}]` : f.value}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span>
                <span className="font-medium">100% of flag traffic</span>
                <span className="text-muted-foreground"> — no additional filters</span>
              </span>
            )}
          </div>

          <p className="text-[9px] text-muted-foreground/60 leading-snug">
            Experiment scope is determined by the feature flag&apos;s targeting rules. If the flag is nested under a parent flag or limited to a segment, only that audience enters the experiment.
          </p>
        </div>

        {!["decided", "archived"].includes(experimentRun.status) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpen}
            className="h-7 shrink-0 gap-1 px-2 text-[11px]"
            aria-label="Configure analysis method and traffic"
          >
            <Pencil className="size-3" />
            Configure
          </Button>
        )}
      </div>

      {/* ── Edit dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Analysis Method &amp; Traffic</DialogTitle>
            <DialogDescription>
              Configure how <span className="font-mono">{experimentRun.slug}</span> is analyzed,
              who sees it, and how much traffic is included.
            </DialogDescription>
          </DialogHeader>

          <form action={handleSubmit} className="space-y-4">
            <input type="hidden" name="experimentRunId" value={experimentRun.id} />
            <input type="hidden" name="experimentId" value={experimentId} />
            <input type="hidden" name="method" value={method} />

            {/* Method selector */}
            <div className="space-y-1.5">
              <Label className="text-xs">Analysis Method</Label>
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="_method"
                    value="bayesian_ab"
                    checked={method === "bayesian_ab"}
                    onChange={() => changeMethod("bayesian_ab")}
                    className="size-3.5"
                  />
                  <span className="text-xs">Bayesian A/B</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
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
              <p className="text-[10px] text-muted-foreground">
                {method === "bandit"
                  ? "Dynamic traffic reweighting — asymmetric allocation intentional"
                  : "Fixed split — balanced sampling ensures equal N per variant"}
              </p>
            </div>

            <div className="space-y-2 rounded-md border bg-muted/15 px-3 py-2.5">
              <div className="space-y-0.5">
                <Label className="text-xs">
                  {method === "bandit" ? "Baseline & Arms" : "Control & Treatment"}
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  {method === "bandit"
                    ? "Pick one baseline/control variation and one or more additional arms."
                    : "Pick exactly one control variation and one treatment variation."}
                </p>
              </div>

              {variantRows.length < 2 ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  Bind a FeatBit flag with at least two variations before assigning variants.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {method === "bandit" ? "Baseline / control" : "Control"}
                    </Label>
                    <select
                      value={controlVariant}
                      onChange={(event) => changeControl(event.target.value)}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-mono"
                    >
                      {variantRows.map((variant) => (
                        <option key={variant.key} value={variant.key}>
                          {variant.key}
                          {variant.description ? ` (${variant.description})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {method === "bandit" ? (
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Additional arms
                      </Label>
                      <div className="grid gap-1.5">
                        {variantRows
                          .filter((variant) => variant.key !== controlVariant)
                          .map((variant) => (
                            <label
                              key={variant.key}
                              className="flex cursor-pointer items-center gap-2 rounded border bg-background/70 px-2 py-1.5 text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={treatmentVariants.includes(variant.key)}
                                onChange={(event) =>
                                  toggleBanditArm(variant.key, event.target.checked)
                                }
                                className="size-3.5"
                              />
                              <span className="font-mono">{variant.key}</span>
                              {variant.description && (
                                <span className="text-muted-foreground">
                                  ({variant.description})
                                </span>
                              )}
                            </label>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Treatment
                      </Label>
                      <select
                        value={treatmentVariants[0] ?? ""}
                        onChange={(event) => setSingleTreatment(event.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-mono"
                      >
                        {variantRows
                          .filter((variant) => variant.key !== controlVariant)
                          .map((variant) => (
                            <option key={variant.key} value={variant.key}>
                              {variant.key}
                              {variant.description ? ` (${variant.description})` : ""}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`tp-${experimentRun.id}`} className="text-xs">
                  Traffic % <span className="text-muted-foreground">(1–100)</span>
                </Label>
                <Input
                  id={`tp-${experimentRun.id}`}
                  name="trafficPercent"
                  type="number"
                  min="1"
                  max="100"
                  defaultValue={experimentRun.trafficPercent ?? 100}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`to-${experimentRun.id}`} className="text-xs">
                  Offset <span className="text-muted-foreground">(0–99)</span>
                </Label>
                <Input
                  id={`to-${experimentRun.id}`}
                  name="trafficOffset"
                  type="number"
                  min="0"
                  max="99"
                  defaultValue={experimentRun.trafficOffset ?? 0}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`lid-${experimentRun.id}`} className="text-xs">
                  Layer ID <span className="text-muted-foreground">(opt.)</span>
                </Label>
                <Input
                  id={`lid-${experimentRun.id}`}
                  name="layerId"
                  defaultValue={(experimentRun.layerId as string) ?? ""}
                  placeholder="e.g. checkout"
                  className="text-sm font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Audience Filters</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={addRow}
                >
                  <Plus className="size-3 mr-1" />
                  Add
                </Button>
              </div>

              {filters.length === 0 && (
                <p className="text-xs text-muted-foreground/50 italic">
                  No filters — all users eligible
                </p>
              )}

              {filters.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input
                    value={f.property}
                    onChange={(e) => updateRow(i, { property: e.target.value })}
                    placeholder="property"
                    className="text-xs h-7 font-mono w-28 shrink-0"
                  />
                  <select
                    value={f.op}
                    onChange={(e) => updateRow(i, { op: e.target.value as Op })}
                    className="h-7 rounded-md border border-input bg-background px-1.5 text-xs w-14 shrink-0"
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
                      className="text-xs h-7 flex-1"
                    />
                  ) : (
                    <Input
                      value={f.value}
                      onChange={(e) => updateRow(i, { value: e.target.value })}
                      placeholder="value"
                      className="text-xs h-7 flex-1"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    aria-label="Remove filter"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
