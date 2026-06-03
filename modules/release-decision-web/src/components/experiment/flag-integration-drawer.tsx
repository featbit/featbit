"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Flag,
  ArrowLeftRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  KeyRound,
  Save,
  RotateCcw,
  CheckCircle2,
  Plus,
  X,
  ChevronsDown,
} from "lucide-react";
import {
  FeatBitApiError,
  featureFlagService,
  segmentService,
  userPropertyService,
  USER_IS_IN_SEGMENT,
  USER_IS_NOT_IN_SEGMENT,
  isSegmentCondition,
  type ICondition,
  type IFallthrough,
  type IFeatureFlag,
  type IRule,
  type IRuleVariation,
  type ISegment,
  type IUserProp,
  type IVariation,
  type IVariationUser,
  type UpdateFlagTargetingPayload,
} from "@/lib/featbit-auth";
import type { Experiment, ExperimentRun } from "@/generated/prisma";
import { FlagPickerBody } from "./flag-picker-body";

// ── Bandit import helpers ───────────────────────────────────────────────────

type BanditImport = {
  runId: string;
  runSlug: string;
  computedAt: string | null;
  weights: Record<string, number>; // variation name → 0..1, sums to 1
};

/**
 * Pick the most recent run using method=bandit whose analysisResult contains
 * usable bandit_weights. Returns null if none found.
 */
function pickLatestBanditImport(runs: ExperimentRun[]): BanditImport | null {
  const candidates = runs
    .filter((r) => r.method === "bandit" && r.analysisResult)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

  for (const run of candidates) {
    try {
      const parsed = JSON.parse(run.analysisResult!);
      const weights = parsed?.bandit_weights;
      if (
        weights &&
        typeof weights === "object" &&
        Object.keys(weights).length > 0
      ) {
        return {
          runId: run.id,
          runSlug: run.slug,
          computedAt: parsed.computed_at ?? null,
          weights: weights as Record<string, number>,
        };
      }
    } catch {
      /* skip malformed analysis */
    }
  }
  return null;
}

type Mode = "picker" | "config";

// ── Draft model ─────────────────────────────────────────────────────────────

/** UI-side variation. `percentage` is outer rollout %. `exptPercentage` is kept
 *  only for round-trip preservation — this drawer does NOT edit experiment
 *  sampling (that's a separate experiment-level concern). */
type DraftVariation = {
  id: string;
  percentage: number;
  exptPercentage: number;
};

type DraftCondition = {
  id: string;
  property: string;
  op: string;
  value: string;
  multipleValue?: string[];
};

type DraftRule = {
  id: string;
  name: string;
  conditions: DraftCondition[];
  dispatchKey: string;
  variations: DraftVariation[];
};

type DraftFallthrough = {
  dispatchKey: string;
  includedInExpt: boolean;
  variations: DraftVariation[];
};

type Draft = {
  rules: DraftRule[];
  fallthrough: DraftFallthrough;
  targetUsers: IVariationUser[];
  exptIncludeAllTargets: boolean;
};

// ── Operator catalog (subset of FeatBit RULE_OPS) ───────────────────────────

type OpKind = "unary" | "string" | "number" | "regex" | "multi";
type OpDef = { value: string; label: string; kind: OpKind };

const OPS: OpDef[] = [
  { value: "IsTrue",         label: "is true",          kind: "unary" },
  { value: "IsFalse",        label: "is false",         kind: "unary" },
  { value: "Equal",          label: "equals",           kind: "string" },
  { value: "NotEqual",       label: "not equal",        kind: "string" },
  { value: "IsOneOf",        label: "is one of",        kind: "multi" },
  { value: "NotOneOf",       label: "not one of",       kind: "multi" },
  { value: "Contains",       label: "contains",         kind: "string" },
  { value: "NotContain",     label: "does not contain", kind: "string" },
  { value: "StartsWith",     label: "starts with",      kind: "string" },
  { value: "EndsWith",       label: "ends with",        kind: "string" },
  { value: "MatchRegex",     label: "matches regex",    kind: "regex" },
  { value: "NotMatchRegex",  label: "doesn't match regex", kind: "regex" },
  { value: "LessThan",       label: "<",                kind: "number" },
  { value: "LessEqualThan",  label: "≤",                kind: "number" },
  { value: "BiggerThan",     label: ">",                kind: "number" },
  { value: "BiggerEqualThan",label: "≥",                kind: "number" },
];

function opDef(op: string): OpDef | undefined {
  return OPS.find((o) => o.value === op);
}

// ── Conversion helpers ──────────────────────────────────────────────────────

function toDraftVariations(
  vs: IRuleVariation[],
  allVariations: IVariation[],
): DraftVariation[] {
  const existing = new Map(vs.map((v) => [v.id, v]));
  return allVariations.map((av) => {
    const e = existing.get(av.id);
    if (e) {
      return {
        id: av.id,
        percentage: Math.round((e.rollout[1] - e.rollout[0]) * 10000) / 100,
        exptPercentage: Math.round(e.exptRollout * 10000) / 100,
      };
    }
    return { id: av.id, percentage: 0, exptPercentage: 100 };
  });
}

function fromDraftVariations(vs: DraftVariation[]): IRuleVariation[] {
  let cursor = 0;
  return vs.map((v) => {
    const share = (v.percentage || 0) / 100;
    const out: IRuleVariation = {
      id: v.id,
      rollout: [round6(cursor), round6(cursor + share)],
      exptRollout: round6((v.exptPercentage || 0) / 100),
    };
    cursor += share;
    return out;
  });
}

function round6(n: number) {
  return Math.round(n * 1_000_000) / 1_000_000;
}

function toDraftCondition(c: ICondition): DraftCondition {
  return {
    id: c.id,
    property: c.property,
    op: c.op,
    value: c.value,
    multipleValue: c.multipleValue,
  };
}

function toDraft(flag: IFeatureFlag): Draft {
  return {
    rules: flag.rules.map((r) => ({
      id: r.id,
      name: r.name,
      conditions: r.conditions.map(toDraftCondition),
      dispatchKey: r.dispatchKey,
      variations: toDraftVariations(r.variations ?? [], flag.variations),
    })),
    fallthrough: {
      dispatchKey: flag.fallthrough.dispatchKey,
      includedInExpt: flag.fallthrough.includedInExpt,
      variations: toDraftVariations(flag.fallthrough.variations, flag.variations),
    },
    targetUsers: flag.targetUsers,
    exptIncludeAllTargets: flag.exptIncludeAllTargets,
  };
}

function draftToPayload(
  draft: Draft,
  revision: string,
  comment: string,
): UpdateFlagTargetingPayload {
  const rules: IRule[] = draft.rules.map((r) => ({
    id: r.id,
    name: r.name,
    conditions: r.conditions.map((c) => ({
      id: c.id,
      property: c.property,
      op: c.op,
      value: c.value,
      multipleValue: c.multipleValue,
    })),
    dispatchKey: r.dispatchKey,
    variations: fromDraftVariations(r.variations),
  }));
  const fallthrough: IFallthrough = {
    dispatchKey: draft.fallthrough.dispatchKey,
    includedInExpt: draft.fallthrough.includedInExpt,
    variations: fromDraftVariations(draft.fallthrough.variations),
  };
  return {
    targeting: {
      rules,
      fallthrough,
      targetUsers: draft.targetUsers,
      exptIncludeAllTargets: draft.exptIncludeAllTargets,
    },
    revision,
    comment,
  };
}

function sumPercentages(vs: DraftVariation[]) {
  return Math.round(vs.reduce((s, v) => s + (v.percentage || 0), 0) * 100) / 100;
}
function isTotalValid(vs: DraftVariation[]) {
  return Math.abs(sumPercentages(vs) - 100) < 0.01;
}

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tmp-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

// ── Main panel (inline, replaces the stage content while open) ──────────────

export function FlagIntegrationPanel({
  experiment,
  experimentRuns,
  onClose,
  onEditAdvanced,
}: {
  experiment: Experiment;
  experimentRuns: ExperimentRun[];
  onClose: () => void;
  onEditAdvanced?: () => void;
}) {
  const banditImport = useMemo(
    () => pickLatestBanditImport(experimentRuns),
    [experimentRuns],
  );
  const initialMode: Mode = experiment.flagKey ? "config" : "picker";
  const [mode, setMode] = useState<Mode>(initialMode);

  useEffect(() => {
    setMode(experiment.flagKey ? "config" : "picker");
  }, [experiment.flagKey, experiment.id]);

  const flagKey = experiment.flagKey;
  const envId = experiment.featbitEnvId;

  return (
    <section className="flex flex-col h-full min-h-0 rounded-md border bg-background">
      <PanelHeader
        mode={mode}
        flagKey={flagKey}
        onChangeFlag={() => setMode("picker")}
        onEditAdvanced={onEditAdvanced}
        onClose={onClose}
        canChangeFlag={Boolean(experiment.flagKey)}
      />

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {mode === "picker" ? (
          <div className="px-5 py-4 flex-1 min-h-0 flex flex-col">
            <FlagPickerBody
              active={mode === "picker"}
              experimentId={experiment.id}
              experimentProjectKey={experiment.featbitProjectKey}
              experimentEnvId={experiment.featbitEnvId}
              onPicked={() => setMode("config")}
              onCancel={
                experiment.flagKey ? () => setMode("config") : undefined
              }
            />
          </div>
        ) : flagKey && envId ? (
          <FlagConfigBody
            key={`${envId}:${flagKey}`}
            envId={envId}
            flagKey={flagKey}
            active={mode === "config"}
            banditImport={banditImport}
          />
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground italic">
            No flag bound. Pick one first.
          </div>
        )}
      </div>
    </section>
  );
}

function PanelHeader({
  mode,
  flagKey,
  onChangeFlag,
  onEditAdvanced,
  onClose,
  canChangeFlag,
}: {
  mode: Mode;
  flagKey: string | null;
  onChangeFlag: () => void;
  onEditAdvanced?: () => void;
  onClose: () => void;
  canChangeFlag: boolean;
}) {
  return (
    <div className="border-b px-5 py-4">
      <div className="flex items-start gap-4">
        <div className="size-9 rounded-md bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
          <Flag className="size-5 text-blue-700 dark:text-blue-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-medium flex items-center gap-2">
            {mode === "picker"
              ? "Connect a Feature Flag"
              : flagKey ?? "Feature Flag"}
            {mode === "config" && flagKey && (
              <Badge
                variant="outline"
                className="font-mono text-[10px] py-0 px-1.5 border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300"
              >
                bound
              </Badge>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {mode === "picker"
              ? "Pick an existing flag from FeatBit. Variations and toggle state stay managed in FeatBit."
              : "Edit targeting rules and default rollout. Toggle and variations are managed in FeatBit."}
          </p>
        </div>
        <div className="flex gap-2 shrink-0 items-center">
          {mode === "config" && canChangeFlag && (
            <Button variant="outline" size="sm" onClick={onChangeFlag} className="gap-1.5">
              <ArrowLeftRight className="size-3.5" /> Change flag
            </Button>
          )}
          {mode === "config" && onEditAdvanced && (
            <Button variant="outline" size="sm" onClick={onEditAdvanced} className="gap-1.5">
              <KeyRound className="size-3.5" /> SDK credentials
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="ml-1"
            title="Close"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Config body ─────────────────────────────────────────────────────────────

function FlagConfigBody({
  envId,
  flagKey,
  active,
  banditImport,
}: {
  envId: string;
  flagKey: string;
  active: boolean;
  banditImport: BanditImport | null;
}) {
  const [flag, setFlag] = useState<IFeatureFlag | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [userProps, setUserProps] = useState<IUserProp[]>([]);
  const [segments, setSegments] = useState<ISegment[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [flagData, props, segs] = await Promise.all([
        featureFlagService.getByKey(envId, flagKey),
        userPropertyService.list(envId).catch(() => [] as IUserProp[]),
        segmentService
          .list(envId, { pageSize: 200 })
          .then((r) => r.items)
          .catch(() => [] as ISegment[]),
      ]);
      setFlag(flagData);
      setDraft(toDraft(flagData));
      setUserProps(props);
      setSegments(segs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [envId, flagKey]);

  useEffect(() => {
    if (active) load();
  }, [active, load]);

  const baseline = useMemo(() => (flag ? toDraft(flag) : null), [flag]);
  const dirty = useMemo(() => {
    if (!draft || !baseline) return false;
    return JSON.stringify(draft) !== JSON.stringify(baseline);
  }, [draft, baseline]);

  const allValid = useMemo(() => {
    if (!draft) return false;
    if (!isTotalValid(draft.fallthrough.variations)) return false;
    for (const r of draft.rules) {
      if (!isTotalValid(r.variations)) return false;
    }
    return true;
  }, [draft]);

  // ── mutators ──
  const patch = useCallback(
    (updater: (d: Draft) => Draft) =>
      setDraft((d) => (d ? updater(d) : d)),
    [],
  );

  function addRule() {
    if (!flag) return;
    patch((d) => ({
      ...d,
      rules: [
        ...d.rules,
        {
          id: newId(),
          name: `Rule ${d.rules.length + 1}`,
          conditions: [newCondition(userProps)],
          dispatchKey: d.fallthrough.dispatchKey || "keyId",
          variations: flag.variations.map((v, idx) => ({
            id: v.id,
            // Default: all traffic → first variation. User adjusts.
            percentage: idx === 0 ? 100 : 0,
            exptPercentage: 100,
          })),
        },
      ],
    }));
  }

  function deleteRule(ruleId: string) {
    patch((d) => ({ ...d, rules: d.rules.filter((r) => r.id !== ruleId) }));
  }

  function patchRule(ruleId: string, update: Partial<DraftRule>) {
    patch((d) => ({
      ...d,
      rules: d.rules.map((r) => (r.id !== ruleId ? r : { ...r, ...update })),
    }));
  }

  function patchRuleVariation(
    ruleId: string,
    variationId: string,
    change: Partial<DraftVariation>,
  ) {
    patch((d) => ({
      ...d,
      rules: d.rules.map((r) =>
        r.id !== ruleId
          ? r
          : {
              ...r,
              variations: r.variations.map((v) =>
                v.id !== variationId ? v : { ...v, ...change },
              ),
            },
      ),
    }));
  }

  function addCondition(ruleId: string) {
    patch((d) => ({
      ...d,
      rules: d.rules.map((r) =>
        r.id !== ruleId
          ? r
          : { ...r, conditions: [...r.conditions, newCondition(userProps)] },
      ),
    }));
  }

  function deleteCondition(ruleId: string, conditionId: string) {
    patch((d) => ({
      ...d,
      rules: d.rules.map((r) =>
        r.id !== ruleId
          ? r
          : { ...r, conditions: r.conditions.filter((c) => c.id !== conditionId) },
      ),
    }));
  }

  function patchCondition(
    ruleId: string,
    conditionId: string,
    change: Partial<DraftCondition>,
  ) {
    patch((d) => ({
      ...d,
      rules: d.rules.map((r) =>
        r.id !== ruleId
          ? r
          : {
              ...r,
              conditions: r.conditions.map((c) =>
                c.id !== conditionId ? c : { ...c, ...change },
              ),
            },
      ),
    }));
  }

  function patchFallthroughVariation(
    variationId: string,
    change: Partial<DraftVariation>,
  ) {
    patch((d) => ({
      ...d,
      fallthrough: {
        ...d.fallthrough,
        variations: d.fallthrough.variations.map((v) =>
          v.id !== variationId ? v : { ...v, ...change },
        ),
      },
    }));
  }

  function patchFallthroughDispatchKey(dispatchKey: string) {
    patch((d) => ({ ...d, fallthrough: { ...d.fallthrough, dispatchKey } }));
  }

  /** Apply bandit weights (variation name → 0..1) to the fallthrough variations,
   *  matching by variation name. Unknown arms are ignored; variations not in the
   *  weights dict keep their current percentage. Weights are renormalized over
   *  matched variations so the editor's sum == 100%. */
  function applyBanditWeights(weights: Record<string, number>) {
    if (!flag) return;
    const nameToId = new Map(flag.variations.map((v) => [v.name, v.id]));
    const matched: { id: string; weight: number }[] = [];
    for (const [name, w] of Object.entries(weights)) {
      const id = nameToId.get(name);
      if (id && Number.isFinite(w) && w >= 0) {
        matched.push({ id, weight: w });
      }
    }
    if (matched.length === 0) return;
    const sum = matched.reduce((s, m) => s + m.weight, 0);
    if (sum <= 0) return;
    const pctById = new Map(
      matched.map((m) => [
        m.id,
        Math.round((m.weight / sum) * 10000) / 100,
      ]),
    );
    patch((d) => ({
      ...d,
      fallthrough: {
        ...d.fallthrough,
        variations: d.fallthrough.variations.map((v) =>
          pctById.has(v.id) ? { ...v, percentage: pctById.get(v.id)! } : v,
        ),
      },
    }));
  }

  function reset() {
    if (flag) setDraft(toDraft(flag));
    setSaveError(null);
  }

  async function save() {
    if (!flag || !draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = draftToPayload(
        draft,
        flag.revision,
        "Updated via release-decision experiment",
      );
      await featureFlagService.updateTargeting(envId, flag.key, payload);
      setSavedAt(Date.now());
      await load();
    } catch (e) {
      if (e instanceof FeatBitApiError && e.status === 409) {
        setSaveError(
          "Flag was modified elsewhere since you loaded it. Reset to pull fresh state, then re-apply your changes.",
        );
      } else {
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setSaving(false);
    }
  }

  // ── render ──
  if (loading && !flag) {
    return (
      <div className="flex items-center justify-center flex-1 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        Loading flag from FeatBit…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-sm">
        <AlertCircle className="size-6 text-destructive" />
        <p className="text-destructive text-center max-w-md">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="size-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (!flag || !draft) return null;

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
        <FlagStatusBlock flag={flag} onRefresh={load} refreshing={loading} />

        {/* Evaluation priority workflow: user enters → pinned → rules → default */}
        <div className="relative">
          {/* Vertical spine runs full height of the workflow. */}
          <div
            className="absolute left-6 top-4 bottom-4 w-px bg-border"
            aria-hidden
          />

          <div className="space-y-2">
            <WorkflowStart />

            <PriorityArrow label="evaluate individual targeting" />

            <IndividualTargetingSection flag={flag} />

            <PriorityArrow
              label={
                flag.targetUsers.some((u) => u.keyIds.length > 0)
                  ? "user isn't pinned"
                  : "no pinned users defined"
              }
            />

            <TargetingRulesSection
              flag={flag}
              draft={draft}
              userProps={userProps}
              segments={segments}
              onAddRule={addRule}
              onDeleteRule={deleteRule}
              onPatchRule={patchRule}
              onPatchVariation={patchRuleVariation}
              onAddCondition={addCondition}
              onDeleteCondition={deleteCondition}
              onPatchCondition={patchCondition}
            />

            <PriorityArrow
              label={
                draft.rules.length === 0
                  ? "no rules defined"
                  : "no rule matched"
              }
            />

            <DefaultRuleSection
              flag={flag}
              draft={draft}
              userProps={userProps}
              onPatchVariation={patchFallthroughVariation}
              onPatchDispatchKey={patchFallthroughDispatchKey}
              banditImport={banditImport}
              onApplyBanditWeights={applyBanditWeights}
            />
          </div>
        </div>
      </div>

      <SaveBar
        dirty={dirty}
        saving={saving}
        allValid={allValid}
        saveError={saveError}
        savedAt={savedAt}
        onReset={reset}
        onSave={save}
      />
    </>
  );
}

function newCondition(userProps: IUserProp[]): DraftCondition {
  const firstProp = userProps.find((p) => !isSegmentCondition(p.name));
  return {
    id: newId(),
    property: firstProp?.name ?? "keyId",
    op: "Equal",
    value: "",
  };
}

// ── Save bar ────────────────────────────────────────────────────────────────

function SaveBar({
  dirty,
  saving,
  allValid,
  saveError,
  savedAt,
  onReset,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  allValid: boolean;
  saveError: string | null;
  savedAt: number | null;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <div className="border-t px-5 py-3 bg-background/80 backdrop-blur">
      {saveError && (
        <div className="flex items-start gap-2 text-xs text-destructive mb-2">
          <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {dirty
            ? allValid
              ? "Unsaved changes"
              : "Some rules don't sum to 100% — can't save"
            : savedAt
              ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  Saved {new Date(savedAt).toLocaleTimeString()}
                </span>
              )
              : "No pending changes"}
        </span>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!dirty || saving}
            onClick={onReset}
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" /> Reset
          </Button>
          <Button
            size="sm"
            disabled={!dirty || saving || !allValid}
            onClick={onSave}
            className="gap-1.5"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save to FeatBit
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Flag status (simplified) ────────────────────────────────────────────────

function FlagStatusBlock({
  flag,
  onRefresh,
  refreshing,
}: {
  flag: IFeatureFlag;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const offVariation = flag.variations.find((v) => v.id === flag.disabledVariationId);
  return (
    <section className="rounded-lg border bg-muted/20 px-4 py-3 flex items-center gap-3">
      <Badge
        variant="outline"
        className={
          flag.isEnabled
            ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300 font-semibold"
            : "border-muted-foreground/30 text-muted-foreground font-semibold"
        }
      >
        {flag.isEnabled ? "ON" : "OFF"}
      </Badge>
      {flag.isEnabled ? (
        <span className="text-xs text-muted-foreground">
          Flag active — targeting rules below decide which variation a user sees.
        </span>
      ) : offVariation ? (
        <span className="text-xs text-muted-foreground">
          Flag off — returns{" "}
          <span className="font-mono text-foreground">{offVariation.name}</span>
          {offVariation.value && (
            <span className="text-muted-foreground/70">
              {" "}(<span className="font-mono">{offVariation.value}</span>)
            </span>
          )}{" "}
          for all users. Toggle on in FeatBit to activate these rules.
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Flag off.</span>
      )}
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="ml-auto text-muted-foreground/50 hover:text-foreground transition-colors"
        title="Refresh from FeatBit"
      >
        <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
      </button>
    </section>
  );
}

function IndividualTargetingSection({ flag }: { flag: IFeatureFlag }) {
  const nonEmpty = flag.targetUsers.filter((u) => u.keyIds.length > 0);
  const variationName = (id: string) =>
    flag.variations.find((v) => v.id === id)?.name ?? id.slice(0, 8);

  return (
    <section className="relative pl-12">
      <span
        className="absolute left-[18px] top-4 size-2.5 rounded-full bg-amber-500 ring-4 ring-background"
        aria-hidden
      />
      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Individual Targeting
          </h3>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
            {nonEmpty.reduce((n, u) => n + u.keyIds.length, 0)}
          </Badge>
          <span className="text-[10px] text-muted-foreground/60 italic">
            pinned users — read-only, edit in FeatBit
          </span>
        </div>
        {nonEmpty.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No pinned users. All users continue to the rules below.
          </p>
        ) : (
          <div className="space-y-1.5">
            {nonEmpty.map((u) => (
              <div key={u.variationId} className="flex items-start gap-2 text-xs">
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] shrink-0 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
                >
                  → {variationName(u.variationId)}
                </Badge>
                <div className="flex flex-wrap gap-1">
                  {u.keyIds.map((k) => (
                    <span
                      key={k}
                      className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Targeting rules section ─────────────────────────────────────────────────

function TargetingRulesSection({
  flag,
  draft,
  userProps,
  segments,
  onAddRule,
  onDeleteRule,
  onPatchRule,
  onPatchVariation,
  onAddCondition,
  onDeleteCondition,
  onPatchCondition,
}: {
  flag: IFeatureFlag;
  draft: Draft;
  userProps: IUserProp[];
  segments: ISegment[];
  onAddRule: () => void;
  onDeleteRule: (ruleId: string) => void;
  onPatchRule: (ruleId: string, update: Partial<DraftRule>) => void;
  onPatchVariation: (
    ruleId: string,
    variationId: string,
    change: Partial<DraftVariation>,
  ) => void;
  onAddCondition: (ruleId: string) => void;
  onDeleteCondition: (ruleId: string, conditionId: string) => void;
  onPatchCondition: (
    ruleId: string,
    conditionId: string,
    change: Partial<DraftCondition>,
  ) => void;
}) {
  return (
    <section className="relative pl-12">
      {/* spine bullet at head */}
      <span className="absolute left-[18px] top-4 size-2.5 rounded-full bg-blue-500 ring-4 ring-background" />

      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Targeting Rules
          </h3>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
            {draft.rules.length}
          </Badge>
          <span className="text-[10px] text-muted-foreground/60 italic">
            evaluated top-down — first match wins
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddRule}
            className="ml-auto gap-1 h-7 text-xs"
          >
            <Plus className="size-3.5" /> Add rule
          </Button>
        </div>

        {draft.rules.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">
            No rules yet. All users fall through to the default rule below.
          </p>
        ) : (
          <ol className="space-y-2.5">
            {draft.rules.map((r, i) => (
              <li key={r.id}>
                <RuleCard
                  index={i}
                  rule={r}
                  flag={flag}
                  userProps={userProps}
                  segments={segments}
                  onDelete={() => onDeleteRule(r.id)}
                  onPatch={(u) => onPatchRule(r.id, u)}
                  onPatchVariation={(vid, change) => onPatchVariation(r.id, vid, change)}
                  onAddCondition={() => onAddCondition(r.id)}
                  onDeleteCondition={(cid) => onDeleteCondition(r.id, cid)}
                  onPatchCondition={(cid, change) => onPatchCondition(r.id, cid, change)}
                />
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function WorkflowStart() {
  return (
    <div className="relative pl-12 flex items-center h-6">
      <span
        className="absolute left-[18px] size-2.5 rounded-full bg-slate-400 ring-4 ring-background"
        aria-hidden
      />
      <span className="text-[11px] text-muted-foreground">
        A user requests this flag →
      </span>
    </div>
  );
}

function PriorityArrow({ label }: { label: string }) {
  return (
    <div className="relative pl-12 h-6 flex items-center text-muted-foreground">
      <ChevronsDown
        className="absolute left-[14px] size-4 text-muted-foreground/60"
        aria-hidden
      />
      <span className="text-[10px] uppercase tracking-wider ml-1">{label}</span>
    </div>
  );
}

function DefaultRuleSection({
  flag,
  draft,
  userProps,
  onPatchVariation,
  onPatchDispatchKey,
  banditImport,
  onApplyBanditWeights,
}: {
  flag: IFeatureFlag;
  draft: Draft;
  userProps: IUserProp[];
  onPatchVariation: (variationId: string, change: Partial<DraftVariation>) => void;
  onPatchDispatchKey: (v: string) => void;
  banditImport: BanditImport | null;
  onApplyBanditWeights: (weights: Record<string, number>) => void;
}) {
  return (
    <section className="relative pl-12">
      <span className="absolute left-[18px] top-4 size-2.5 rounded-full bg-violet-500 ring-4 ring-background" />
      <div className="rounded-lg border-2 border-dashed p-4 space-y-3 bg-muted/10">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Default Rule
          </h3>
          <span className="text-[10px] text-muted-foreground/60 italic">
            your A/B split lives here
          </span>
          {banditImport && (
            <BanditImportButton
              banditImport={banditImport}
              flag={flag}
              onApply={() => onApplyBanditWeights(banditImport.weights)}
            />
          )}
        </div>
        <RolloutEditor
          flag={flag}
          variations={draft.fallthrough.variations}
          onPatch={onPatchVariation}
          dispatchKey={draft.fallthrough.dispatchKey}
          onDispatchKeyChange={onPatchDispatchKey}
          userProps={userProps}
        />
      </div>
    </section>
  );
}

function BanditImportButton({
  banditImport,
  flag,
  onApply,
}: {
  banditImport: BanditImport;
  flag: IFeatureFlag;
  onApply: () => void;
}) {
  const { weights, runSlug, computedAt } = banditImport;
  const matched = Object.keys(weights).filter((n) =>
    flag.variations.some((v) => v.name === n),
  );
  const tooltip =
    matched.length === 0
      ? "Bandit weights don't match any flag variations by name"
      : `Fills default rule: ${matched
          .map(
            (n) =>
              `${n}=${(weights[n] * 100).toFixed(1)}%`,
          )
          .join(", ")}${computedAt ? ` (computed ${new Date(computedAt).toLocaleString()})` : ""}`;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onApply}
      disabled={matched.length === 0}
      className="ml-auto gap-1 h-7 text-xs"
      title={tooltip}
    >
      <ChevronsDown className="size-3.5 rotate-[-90deg]" />
      Import weights from {runSlug}
    </Button>
  );
}

// ── Rule card + condition editor ────────────────────────────────────────────

function RuleCard({
  index,
  rule,
  flag,
  userProps,
  segments,
  onDelete,
  onPatch,
  onPatchVariation,
  onAddCondition,
  onDeleteCondition,
  onPatchCondition,
}: {
  index: number;
  rule: DraftRule;
  flag: IFeatureFlag;
  userProps: IUserProp[];
  segments: ISegment[];
  onDelete: () => void;
  onPatch: (u: Partial<DraftRule>) => void;
  onPatchVariation: (
    variationId: string,
    change: Partial<DraftVariation>,
  ) => void;
  onAddCondition: () => void;
  onDeleteCondition: (conditionId: string) => void;
  onPatchCondition: (
    conditionId: string,
    change: Partial<DraftCondition>,
  ) => void;
}) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
          #{index + 1}
        </Badge>
        <Input
          value={rule.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder={`Rule ${index + 1}`}
          className="h-7 text-xs max-w-[20rem]"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="ml-auto h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          title="Delete rule"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <ConditionsEditor
        conditions={rule.conditions}
        userProps={userProps}
        segments={segments}
        onAdd={onAddCondition}
        onDelete={onDeleteCondition}
        onPatch={onPatchCondition}
      />

      <div className="pt-2 border-t">
        <RolloutEditor
          flag={flag}
          variations={rule.variations}
          onPatch={onPatchVariation}
          dispatchKey={rule.dispatchKey}
          onDispatchKeyChange={(v) => onPatch({ dispatchKey: v })}
          userProps={userProps}
        />
      </div>
    </div>
  );
}

function ConditionsEditor({
  conditions,
  userProps,
  segments,
  onAdd,
  onDelete,
  onPatch,
}: {
  conditions: DraftCondition[];
  userProps: IUserProp[];
  segments: ISegment[];
  onAdd: () => void;
  onDelete: (id: string) => void;
  onPatch: (id: string, change: Partial<DraftCondition>) => void;
}) {
  return (
    <div className="space-y-1.5">
      {conditions.map((c, i) => (
        <div key={c.id} className="flex items-start gap-2">
          <span className="text-[10px] text-muted-foreground uppercase pt-1.5 w-7 text-right shrink-0">
            {i === 0 ? "If" : "and"}
          </span>
          <ConditionRow
            condition={c}
            userProps={userProps}
            segments={segments}
            onPatch={(change) => onPatch(c.id, change)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(c.id)}
            className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
            disabled={conditions.length === 1}
            title={conditions.length === 1 ? "Rule must have ≥1 condition" : "Remove"}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={onAdd}
        className="h-7 text-xs gap-1 ml-9 text-muted-foreground"
      >
        <Plus className="size-3.5" /> Add condition
      </Button>
    </div>
  );
}

function ConditionRow({
  condition,
  userProps,
  segments,
  onPatch,
}: {
  condition: DraftCondition;
  userProps: IUserProp[];
  segments: ISegment[];
  onPatch: (change: Partial<DraftCondition>) => void;
}) {
  const isSegment = isSegmentCondition(condition.property);
  const op = opDef(condition.op);
  const kind: OpKind = isSegment ? "multi" : op?.kind ?? "string";

  // Dropdown options: user-defined props + the two magic segment props.
  const allPropNames = useMemo(() => {
    const names = userProps.map((p) => p.name);
    if (!names.includes(USER_IS_IN_SEGMENT)) names.push(USER_IS_IN_SEGMENT);
    if (!names.includes(USER_IS_NOT_IN_SEGMENT)) names.push(USER_IS_NOT_IN_SEGMENT);
    // Ensure the currently-selected property is present so the select shows it.
    if (condition.property && !names.includes(condition.property)) {
      names.unshift(condition.property);
    }
    return names;
  }, [userProps, condition.property]);

  function handlePropertyChange(prop: string) {
    if (isSegmentCondition(prop)) {
      // Segment condition: value = JSON array of ids. Clear any prior value.
      onPatch({ property: prop, value: "[]", multipleValue: undefined });
    } else {
      onPatch({ property: prop, value: "", multipleValue: undefined });
    }
  }

  function handleOpChange(opValue: string) {
    const def = opDef(opValue);
    // Reset value when kind changes meaningfully.
    if (def?.kind === "unary") {
      onPatch({ op: opValue, value: "true", multipleValue: undefined });
    } else if (def?.kind === "multi") {
      onPatch({ op: opValue, value: "[]", multipleValue: [] });
    } else {
      onPatch({ op: opValue, value: "", multipleValue: undefined });
    }
  }

  return (
    <div className="flex-1 flex items-center gap-1.5 flex-wrap">
      {/* Property */}
      <select
        value={condition.property}
        onChange={(e) => handlePropertyChange(e.target.value)}
        className="h-7 rounded-md border bg-background px-2 text-xs font-mono min-w-[9rem]"
      >
        {allPropNames.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>

      {/* Operator — segment props have implicit "is" op, hide selector */}
      {isSegment ? (
        <span className="text-xs text-muted-foreground px-1">is in</span>
      ) : (
        <select
          value={condition.op}
          onChange={(e) => handleOpChange(e.target.value)}
          className="h-7 rounded-md border bg-background px-2 text-xs min-w-[9rem]"
        >
          {OPS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      {/* Value */}
      {isSegment ? (
        <SegmentValueInput
          value={condition.value}
          segments={segments}
          onChange={(v) => onPatch({ value: v })}
        />
      ) : kind === "unary" ? (
        <span className="text-xs text-muted-foreground italic">no value</span>
      ) : kind === "multi" ? (
        <MultiValueInput
          value={condition.value}
          onChange={(v) => onPatch({ value: v })}
        />
      ) : (
        <Input
          type={kind === "number" ? "number" : "text"}
          value={condition.value}
          onChange={(e) => onPatch({ value: e.target.value })}
          placeholder={kind === "regex" ? "^regex$" : "value"}
          className="h-7 text-xs flex-1 min-w-[10rem]"
        />
      )}
    </div>
  );
}

function MultiValueInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  // Stored on wire as JSON array string. Edit as comma-separated text.
  const display = useMemo(() => {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.join(", ");
    } catch {
      /* fall through */
    }
    return value;
  }, [value]);

  return (
    <Input
      type="text"
      value={display}
      onChange={(e) => {
        const items = e.target.value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        onChange(JSON.stringify(items));
      }}
      placeholder="value1, value2, value3"
      className="h-7 text-xs flex-1 min-w-[14rem]"
    />
  );
}

function SegmentValueInput({
  value,
  segments,
  onChange,
}: {
  value: string;
  segments: ISegment[];
  onChange: (v: string) => void;
}) {
  const selectedIds = useMemo(() => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed as string[] : [];
    } catch {
      return [];
    }
  }, [value]);

  function toggle(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    onChange(JSON.stringify(next));
  }

  if (segments.length === 0) {
    return (
      <span className="text-xs text-muted-foreground italic flex-1">
        No segments defined in this env.
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap flex-1">
      {selectedIds.length === 0 && (
        <span className="text-[11px] text-muted-foreground italic mr-1">
          pick segments:
        </span>
      )}
      {segments.map((s) => {
        const picked = selectedIds.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => toggle(s.id)}
            className={`text-[11px] px-1.5 py-0.5 rounded border font-mono transition-colors ${
              picked
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "border-muted-foreground/30 text-muted-foreground hover:border-foreground"
            }`}
            title={s.description || s.name}
          >
            {s.name}
          </button>
        );
      })}
    </div>
  );
}

// ── Rollout editor ──────────────────────────────────────────────────────────

// Palette tuned for stacked-bar contrast: adjacent colors span ~120° of hue
// so even the first two (blue + orange) read as clearly different slices.
const PALETTE = [
  { bar: "bg-blue-500",    text: "text-blue-700 dark:text-blue-300" },
  { bar: "bg-orange-500",  text: "text-orange-700 dark:text-orange-300" },
  { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
  { bar: "bg-pink-500",    text: "text-pink-700 dark:text-pink-300" },
  { bar: "bg-violet-500",  text: "text-violet-700 dark:text-violet-300" },
  { bar: "bg-yellow-400",  text: "text-yellow-700 dark:text-yellow-300" },
];

function RolloutEditor({
  variations,
  flag,
  onPatch,
  dispatchKey,
  onDispatchKeyChange,
  userProps,
}: {
  variations: DraftVariation[];
  flag: IFeatureFlag;
  onPatch: (variationId: string, patch: Partial<DraftVariation>) => void;
  dispatchKey: string;
  onDispatchKeyChange: (v: string) => void;
  userProps: IUserProp[];
}) {
  const outerSum = sumPercentages(variations);
  const sumValid = Math.abs(outerSum - 100) < 0.01;

  // Dispatch-key options: user props minus segment-magic properties.
  // Keep current value even if not in list, so the select doesn't blank out.
  const dispatchOptions = useMemo(() => {
    const names = userProps
      .map((p) => p.name)
      .filter((n) => !isSegmentCondition(n));
    if (!names.includes("keyId")) names.unshift("keyId");
    if (dispatchKey && !names.includes(dispatchKey)) names.push(dispatchKey);
    return names;
  }, [userProps, dispatchKey]);

  if (variations.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground italic">
        No variations served — add one in FeatBit.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider">
          <span>Rollout</span>
          <span className={sumValid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
            Sum: {outerSum}% {sumValid ? "✓" : "(should be 100%)"}
          </span>
        </div>
        <div className="h-5 rounded overflow-hidden flex bg-muted divide-x divide-background/30">
          {variations.map((v, idx) => {
            if (v.percentage <= 0) return null;
            return (
              <div
                key={v.id}
                className={`${PALETTE[idx % PALETTE.length].bar} flex items-center justify-center text-[10px] font-mono font-medium text-white tabular-nums`}
                style={{ width: `${Math.min(100, v.percentage)}%` }}
                title={`${variationName(flag, v.id)}: ${v.percentage}%`}
              >
                {v.percentage >= 10 ? `${v.percentage}%` : ""}
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-variation editor — just variation + percentage */}
      <div className="grid grid-cols-[1fr_10rem] gap-x-3 gap-y-1.5 items-center text-xs">
        <div className="text-[10px] font-medium text-muted-foreground uppercase">
          Variation
        </div>
        <div className="text-[10px] font-medium text-muted-foreground uppercase">
          Rollout %
        </div>

        {variations.map((v, idx) => {
          const colors = PALETTE[idx % PALETTE.length];
          return (
            <RolloutRow
              key={v.id}
              name={variationName(flag, v.id)}
              color={colors}
              variation={v}
              onPatch={(patch) => onPatch(v.id, patch)}
            />
          );
        })}
      </div>

      {/* Dispatch by (select) */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <label className="text-[10px] font-medium text-muted-foreground uppercase">
          Dispatch by
        </label>
        <select
          value={dispatchKey || "keyId"}
          onChange={(e) => onDispatchKeyChange(e.target.value)}
          className="h-7 rounded-md border bg-background px-2 text-xs font-mono max-w-[18rem]"
        >
          {dispatchOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="text-[10px] text-muted-foreground italic">
          user property hashed for consistent bucketing
        </span>
      </div>
    </div>
  );
}

function variationName(flag: IFeatureFlag, id: string) {
  return flag.variations.find((v) => v.id === id)?.name ?? id.slice(0, 8);
}

function RolloutRow({
  name,
  color,
  variation,
  onPatch,
}: {
  name: string;
  color: { bar: string; text: string };
  variation: DraftVariation;
  onPatch: (patch: Partial<DraftVariation>) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`size-2 rounded-full shrink-0 ${color.bar}`} />
        <span className={`font-mono text-xs truncate ${color.text}`}>{name}</span>
      </div>
      <PercentInput
        value={variation.percentage}
        onChange={(n) => onPatch({ percentage: n })}
      />
    </>
  );
}

function PercentInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="relative">
      <Input
        type="number"
        min={0}
        max={100}
        step={0.1}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        className="h-7 text-xs text-right pr-6 font-mono tabular-nums"
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
        %
      </span>
    </div>
  );
}
