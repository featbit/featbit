"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Beaker,
  Bot,
  Calendar,
  Check,
  ClipboardList,
  Copy,
  Filter,
  Flag,
  Info,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Target,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { appPath } from "@/lib/app-path";
import { authStorage } from "@/lib/featbit-auth/storage";
import { AnalysisView } from "./analysis-markdown";
import { ExperimentRunTrafficConfig } from "./experiment-run-traffic-config";
import {
  parseVariantIdentities,
  splitVariantTokens,
  VariantIdCopyButton,
  VariantIdentityInline,
  type VariantIdentity,
} from "./variant-identity";
import {
  createNewExperimentRunAction,
  deleteExperimentRunAction,
  updateExperimentRunObservationWindowAction,
} from "@/lib/actions";
import type { ExperimentRun } from "@/generated/prisma";

/* ── Colour maps ── */

const DECISION_BG: Record<string, string> = {
  CONTINUE:
    "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
  PAUSE:
    "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800",
  ROLLBACK:
    "bg-red-100 border-red-300 dark:bg-red-900/40 dark:border-red-700",
  INCONCLUSIVE:
    "bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700",
};

const DECISION_COLORS: Record<string, string> = {
  CONTINUE:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  PAUSE:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  ROLLBACK:
    "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  INCONCLUSIVE:
    "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300",
};

type ExperimentMethod = "bayesian_ab" | "bandit";
type VariantChoice = VariantIdentity;

const METHOD_OPTIONS: Array<{
  value: ExperimentMethod;
  title: string;
  eyebrow: string;
  description: string;
}> = [
  {
    value: "bayesian_ab",
    title: "Bayesian A/B/n",
    eyebrow: "Fixed allocation",
    description:
      "Use fixed traffic allocation to compare one control against multiple treatment variants.",
  },
  {
    value: "bandit",
    title: "Bandit",
    eyebrow: "Dynamic allocation",
    description:
      "Use multiple arms and reweight traffic toward stronger variants as reward evidence changes.",
  },
];

function normalizeRunVariantSelection(
  method: ExperimentMethod,
  control: string,
  treatments: string[],
  choices: VariantChoice[],
) {
  const keys = new Set(choices.map((choice) => choice.key));
  const nextControl = keys.has(control) ? control : choices[0]?.key ?? "";
  const availableTreatments = choices
    .map((choice) => choice.key)
    .filter((key) => key !== nextControl);
  const selectedTreatments = treatments.filter(
    (key, index, arr) =>
      key !== nextControl && keys.has(key) && arr.indexOf(key) === index,
  );

  return {
    control: nextControl,
    treatments:
      method === "bandit"
        ? selectedTreatments.length > 0
          ? selectedTreatments
          : availableTreatments
        : selectedTreatments.length > 0
          ? selectedTreatments
          : availableTreatments,
  };
}

function VariantChoiceIdentity({ choice }: { choice: VariantChoice }) {
  return (
    <VariantIdentityInline
      token={choice.key}
      variants={[choice]}
      className="min-w-0 flex-1"
      showCopy={false}
    />
  );
}

const DECISION_DETAILS: Record<
  string,
  {
    title: string;
    action: string;
    note: string;
    icon: React.ReactNode;
  }
> = {
  CONTINUE: {
    title: "Continue: ship the treatment",
    action:
      "Move the feature flag toward the treatment variant. If no rollout constraints remain, set treatment to 100%; otherwise expand in monitored steps such as 50% -> 80% -> 100%.",
    note: "Use when the primary metric is clearly positive and guardrails are acceptable.",
    icon: <Flag className="size-4" />,
  },
  PAUSE: {
    title: "Pause: hold the rollout",
    action:
      "Do not increase traffic yet. Keep the current split, or reduce exposure if needed, while investigating the metric, guardrail, SRM, or instrumentation issue.",
    note: "Use when there is a signal, but it is not clean enough to expand.",
    icon: <Info className="size-4" />,
  },
  ROLLBACK: {
    title: "Rollback: stop the candidate",
    action:
      "Route users back to the control/default variant, or disable the candidate flag path, then investigate before exposing it again.",
    note: "Use when the candidate appears harmful or a protected metric regressed.",
    icon: <X className="size-4" />,
  },
  INCONCLUSIVE: {
    title: "Inconclusive: keep observing",
    action:
      "Do not change rollout because of this run. Extend the observation window, collect the required sample, or fix instrumentation before deciding.",
    note: "Use when the evidence is not strong or clean enough for a rollout decision.",
    icon: <RefreshCw className="size-4" />,
  },
};

/* ── Shared primitive components ── */

function SectionLabel({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const label = method === "bandit" ? "Bandit" : "Bayesian A/B/n";
  const color =
    method === "bandit"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  return (
    <Badge className={`text-[10px] px-1.5 py-0 ${color}`}>
      <Beaker className="inline size-2.5 mr-0.5" />
      {label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "decided"
      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
      : status === "collecting"
        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
        : status === "analyzing"
          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
          : "";
  return (
    <Badge variant="outline" className={`text-[10px] ${color}`}>
      {status}
    </Badge>
  );
}

function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision) {
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground/60">
        Pending
      </Badge>
    );
  }
  const color = DECISION_COLORS[decision] ?? "";
  return (
    <Badge className={`text-[10px] px-1.5 py-0 ${color}`}>{decision}</Badge>
  );
}

function MethodChoiceCards({
  value,
  onChange,
}: {
  value: ExperimentMethod;
  onChange: (value: ExperimentMethod) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {METHOD_OPTIONS.map((option) => {
        const selected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md border px-3 py-3 text-left transition-colors",
              selected
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border bg-background hover:border-primary/40 hover:bg-muted/30",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Beaker className="size-4 text-primary" />
                {option.title}
              </span>
              <span
                className={cn(
                  "size-3.5 rounded-full border",
                  selected
                    ? "border-primary bg-primary ring-2 ring-background ring-inset"
                    : "border-muted-foreground/40",
                )}
              />
            </span>
            <span className="mt-2 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {option.eyebrow}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DecisionCallout({ run }: { run: ExperimentRun }) {
  if (!run.decisionSummary) {
    return null;
  }

  const decision = run.decision ?? "";
  const detail = DECISION_DETAILS[decision];
  const bg = DECISION_BG[decision] ?? "bg-muted/30 border-border";

  return (
    <div className={cn("rounded-md border px-3 py-3", bg)}>
      {detail && (
        <div className="mb-2.5 flex items-start gap-2">
          <div className="mt-0.5 text-foreground/80">{detail.icon}</div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold leading-snug text-foreground">
                {detail.title}
              </p>
              <DecisionBadge decision={decision} />
            </div>
            <p className="text-sm leading-relaxed text-foreground">
              {detail.action}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {detail.note}
            </p>
          </div>
        </div>
      )}
      <div className={detail ? "border-t border-current/10 pt-2" : undefined}>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Evidence Summary
        </p>
        <p className="text-sm font-medium leading-relaxed text-foreground">
          {run.decisionSummary}
        </p>
      </div>
    </div>
  );
}

function CollapsibleRationale({ children }: { children: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-1">
      <p
        className="text-sm leading-relaxed text-muted-foreground"
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
        }
      >
        {children}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Show less" : "Show more"}
      </Button>
    </div>
  );
}

/* ── Simple inline tab bar ── */

/* ── Helpers ── */

function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** <input type="datetime-local"> expects "YYYY-MM-DDTHH:mm" in local time. */
function toLocalInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60_000).toISOString().slice(0, 16);
}

/* ── Observation window (inline-editable on each run card) ── */
function ObservationWindowInline({
  run,
  experimentId,
}: {
  run: ExperimentRun;
  experimentId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(toLocalInput(run.observationStart));
  const [end, setEnd] = useState(toLocalInput(run.observationEnd));
  const [pending, startTransition] = useTransition();

  const baselineStart = toLocalInput(run.observationStart);
  const baselineEnd = toLocalInput(run.observationEnd);
  const dirty = start !== baselineStart || end !== baselineEnd;

  function startEdit() {
    setStart(baselineStart);
    setEnd(baselineEnd);
    setEditing(true);
  }

  function cancel() {
    setStart(baselineStart);
    setEnd(baselineEnd);
    setEditing(false);
  }

  function save() {
    const fd = new FormData();
    fd.append("experimentRunId", run.id);
    fd.append("experimentId", experimentId);
    fd.append("observationStart", start);
    fd.append("observationEnd", end);
    startTransition(async () => {
      await updateExperimentRunObservationWindowAction(fd);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap">
        <Calendar className="size-3" />
        <Input
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="h-7 text-xs w-44"
        />
        <span className="text-muted-foreground">→</span>
        <Input
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="h-7 text-xs w-44"
        />
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={save}
          disabled={!dirty || pending}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs px-2"
          onClick={cancel}
          disabled={pending}
        >
          <X className="size-3" />
        </Button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className="inline-flex items-center gap-1 group hover:text-foreground transition-colors"
      title="Edit observation window"
    >
      <Calendar className="size-3" />
      {run.observationStart ? (
        <span>
          {fmtDate(run.observationStart)} →{" "}
          {run.observationEnd ? (
            fmtDate(run.observationEnd)
          ) : (
            <span className="italic text-muted-foreground">ongoing</span>
          )}
        </span>
      ) : run.observationEnd ? (
        <span>
          <span className="italic text-muted-foreground">— </span>
          → {fmtDate(run.observationEnd)}
        </span>
      ) : (
        <span className="italic">Set observation window</span>
      )}
      <Pencil className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

/* ── Tab content panels ── */

function SummaryTab({
  exp,
  variantChoices,
  onOpenAgentPrompt,
  analysisPanel,
}: {
  exp: ExperimentRun;
  variantChoices: VariantChoice[];
  onOpenAgentPrompt?: () => void;
  analysisPanel?: React.ReactNode;
}) {
  const hasDecision = Boolean(exp.decision);
  const decisionReason = sanitizeDecisionReason(exp.decisionReason);
  const treatmentVariants = splitVariantTokens(exp.treatmentVariant);
  const arms = [exp.controlVariant, ...treatmentVariants].filter(
    (variant): variant is string => Boolean(variant),
  );

  return (
    <div className="px-4 pb-6 space-y-4">
      {/* Coding-agent decision helper */}
      {onOpenAgentPrompt && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2.5 bg-muted/20">
          <div className="flex items-start gap-2 min-w-0">
            <MessageCircle className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              {hasDecision
                ? "A decision is already on file. Ask a coding agent to revisit it against the latest analysis, update this run, and suggest follow-ups."
                : "Ask a coding agent to refresh the latest data, evaluate the evidence, and write an actionable decision back to this run."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] px-2.5 shrink-0 gap-1"
            onClick={onOpenAgentPrompt}
          >
            <Bot className="size-3" />
            Agent Decision Prompt
          </Button>
        </div>
      )}

      {/* Decision callout */}
      <DecisionCallout run={exp} />

      {/* Technical rationale */}
      {decisionReason && (
        <div>
          <SectionLabel
            icon={<Target className="size-3" />}
            label="Evidence Rationale"
          />
          <CollapsibleRationale>{decisionReason}</CollapsibleRationale>
        </div>
      )}

      {/* Method reason */}
      {exp.methodReason && (
        <div>
          <SectionLabel
            icon={<Info className="size-3" />}
            label="Why This Method"
          />
          <p className="text-sm leading-relaxed text-muted-foreground">
            {exp.methodReason}
          </p>
        </div>
      )}

      {/* Variants */}
      {exp.method === "bandit" ? (
        <div>
          <SectionLabel icon={<Users className="size-3" />} label="Arms" />
          <div className="mt-1 grid gap-1 text-sm">
            {arms.map((arm, index) => (
              <div
                key={`${arm}-${index}`}
                className="flex min-w-0 items-center rounded border bg-muted/30 px-2 py-1"
              >
                <VariantIdentityInline
                  token={arm}
                  variants={variantChoices}
                  role={arm === exp.controlVariant ? "Baseline" : "Arm"}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-1 text-sm">
          {exp.controlVariant && (
            <div className="flex min-w-0 items-center">
              <Users className="inline size-3 mr-0.5" />
              <VariantIdentityInline
                token={exp.controlVariant}
                variants={variantChoices}
                role="Control"
                className="min-w-0"
              />
            </div>
          )}
          {treatmentVariants.map((variant, index) => (
            <VariantIdentityInline
              key={`${variant}-${index}`}
              token={variant}
              variants={variantChoices}
              role={treatmentVariants.length > 1 ? `Treatment ${index + 1}` : "Treatment"}
              className="min-w-0"
            />
          ))}
        </div>
      )}

      {/* Observation window — prominent block, drives analysis query range */}
      <div className="rounded-md border bg-muted/20 px-3 py-2 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Calendar className="size-3" />
          <span>Observation Window</span>
          <span className="text-[9px] font-normal italic text-muted-foreground/70 normal-case tracking-normal">
            analysis pulls data inside this range
          </span>
        </div>
        <ObservationWindowInline
          run={exp}
          experimentId={exp.experimentId}
        />
      </div>

      {/* Min sample */}
      {exp.minimumSample && (
        <div className="text-sm text-muted-foreground">
          Min sample:{" "}
          <span className="tabular-nums font-medium text-foreground">
            {exp.minimumSample}
          </span>
          /variant
        </div>
      )}

      {analysisPanel && (
        <div className="pt-1">
          <SectionLabel icon={<Beaker className="size-3" />} label="Full Analysis" />
          {analysisPanel}
        </div>
      )}
    </div>
  );
}

const AUTO_REFRESH_INTERVAL = 15; // seconds, must match experiment-detail-layout.tsx

function RefreshAnalysisButton({
  loading,
  onConfirm,
}: {
  loading: boolean;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="rounded-md border border-dashed px-3 py-2.5 space-y-2 bg-muted/20">
        <p className="text-sm font-medium">Analyze Latest Data?</p>
        <p className="text-sm text-muted-foreground">
          This will pull fresh metrics and recompute the latest analysis.
        </p>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="h-7 text-[11px] px-2.5"
            onClick={() => { setConfirming(false); onConfirm(); }}
          >
            Start Analyze
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] px-2.5"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 text-[11px] px-2.5 gap-1"
      onClick={() => setConfirming(true)}
      disabled={loading}
    >
      <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
      Analyze Latest Data
    </Button>
  );
}

function AnalysisTab({
  exp,
  experimentId,
  flagKey,
  featbitEnvId,
  variants,
  embedded = false,
}: {
  exp: ExperimentRun;
  experimentId: string;
  flagKey: string | null;
  featbitEnvId: string | null;
  variants: string | null;
  embedded?: boolean;
}) {
  // Pre-check what the backend requires. Rendering a config gap here beats
  // auto-firing a POST that always 400s before the experiment is set up.
  const missingFields: string[] = [];
  if (!exp.primaryMetricEvent) missingFields.push("primary metric event");
  if (!flagKey) missingFields.push("flag key");
  if (!featbitEnvId) missingFields.push("FeatBit env ID");

  const [analysisResult, setAnalysisResult] = useState<string | null>(
    exp.analysisResult ?? null
  );
  const [loading, setLoading] = useState(false);
  const [isFreshRefresh, setIsFreshRefresh] = useState(false);
  const [noData, setNoData] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_INTERVAL);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const hasAutoTriggered = useRef(false);

  useEffect(() => {
    setAnalysisResult(exp.analysisResult ?? null);
    setError(null);
    setWarning(null);
  }, [exp.id, exp.analysisResult]);

  // Countdown ticker shown while loading a fresh refresh
  useEffect(() => {
    if (!loading || !isFreshRefresh) return;
    setCountdown(AUTO_REFRESH_INTERVAL);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) return AUTO_REFRESH_INTERVAL;
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [loading, isFreshRefresh]);

  const refreshAnalysis = useCallback(async (forceFresh = false) => {
    setLoading(true);
    setIsFreshRefresh(forceFresh);
    setError(null);
    setWarning(null);
    setNoData(false);
    try {
      const token = window.localStorage.getItem("token");
      const org = authStorage.getOrganization();
      const profile = authStorage.getProfile();
      const projectEnv = authStorage.getProjectEnv();
      const resp = await fetch(appPath(`/api/experiments/${experimentId}/analyze`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(org?.id ? { Organization: org.id } : {}),
          ...(profile?.workspaceId ? { Workspace: profile.workspaceId } : {}),
        },
        body: JSON.stringify({
          envId: projectEnv?.envId,
          runId: exp.id,
          forceFresh,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error ?? "Analysis failed");
        return;
      }
      // "no_data" is an expected empty state, not an error.
      if (data.status === "no_data") {
        setNoData(true);
        return;
      }
      if (data.analysisResult) {
        setAnalysisResult(data.analysisResult);
        if (typeof data.warning === "string" && data.warning.length > 0) {
          setWarning(data.warning);
        }
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError(`Request failed: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [experimentId, exp.id]);

  // Auto-trigger analysis on mount only when no result exists yet AND the
  // experiment has the fields the analyze endpoint requires. Otherwise the
  // POST will just 400 — render a setup card instead.
  useEffect(() => {
    if (hasAutoTriggered.current) return;
    if (exp.analysisResult) return;
    if (missingFields.length > 0) return;
    hasAutoTriggered.current = true;
    refreshAnalysis(true);
  }, [refreshAnalysis, exp.analysisResult, missingFields.length]);

  if (missingFields.length > 0 && !analysisResult) {
    return (
      <div className={cn("pb-6 pt-4 space-y-2", embedded ? "" : "px-4")}>
        <p className="text-sm font-medium">Analysis not ready</p>
        <p className="text-sm text-muted-foreground">
          Set up {missingFields.join(", ")} before running analysis.
        </p>
        <p className="text-xs text-muted-foreground/70">
          Ask Codex to configure these through FeatBit MCP, or edit the
          experiment in the <code>Exposure</code> stage. Manual per-variant data
          paste is no longer supported.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn("pb-6 pt-8 flex flex-col items-center gap-3", embedded ? "" : "px-4")}>
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Running Bayesian analysis…</p>
        {isFreshRefresh && (
          <>
            <p className="text-sm text-muted-foreground/70 text-center max-w-xs">
              Rolling up the latest data — this may take a moment. You can
              navigate away; results will appear automatically.
            </p>
            <p className="text-xs text-muted-foreground/50">
              Next auto-refresh in {countdown}s
            </p>
          </>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("pb-6 pt-2 space-y-2", embedded ? "" : "px-4")}>
        <p className="text-sm text-destructive">{error}</p>
        <button
          className="text-xs text-blue-600 dark:text-blue-400 underline"
          onClick={() => refreshAnalysis(true)}
        >
          Retry
        </button>
      </div>
    );
  }

  if (noData) {
    return (
      <div className={cn("pb-6 pt-4 space-y-2", embedded ? "" : "px-4")}>
        <p className="text-sm font-medium">Waiting for data</p>
        <p className="text-sm text-muted-foreground">
          No events have arrived yet for this experiment. Once your instrumentation
          starts sending <code>flag_evaluation</code> and metric events for
          <code> env={featbitEnvId ?? "…"}</code> / <code>flag={flagKey ?? "…"}</code>,
          results will show up here automatically.
        </p>
        <button
          className="text-xs text-blue-600 dark:text-blue-400 underline"
          onClick={() => refreshAnalysis(true)}
        >
          Check again
        </button>
      </div>
    );
  }

  if (!analysisResult) {
    return (
      <div className={cn("pb-6 pt-2 space-y-2", embedded ? "" : "px-4")}>
        <RefreshAnalysisButton loading={loading} onConfirm={() => refreshAnalysis(true)} />
        <p className="text-sm text-muted-foreground/60">No analysis available yet.</p>
      </div>
    );
  }

  return (
    <div className={cn("pb-6 overflow-x-auto", embedded ? "" : "px-4")}>
      <div className="mb-2">
        <RefreshAnalysisButton loading={loading} onConfirm={() => refreshAnalysis(true)} />
      </div>
      {warning && (
        <p className="mb-2 text-sm text-amber-600 dark:text-amber-400">{warning}</p>
      )}
      <div className="rounded border bg-muted/20 px-3 py-2.5">
        <AnalysisView content={analysisResult} variants={variants} />
      </div>
    </div>
  );
}

function sanitizeDecisionReason(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;

  const blocked = [
    "analyze_run",
    "usable Bayesian schema",
    "analysisResult",
    "sample_check",
    "primary_metric",
    "guardrail sections",
    "featbit_release_decision_",
    "MCP tool",
  ];

  const paragraphs = value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !blocked.some((token) => part.toLowerCase().includes(token.toLowerCase())));

  return paragraphs.join("\n\n") || null;
}

function TrafficTab({
  exp,
  experimentId,
  variants,
}: {
  exp: ExperimentRun;
  experimentId: string;
  variants: string | null;
}) {
  return (
    <div className="px-4 pb-6 space-y-4">
      <div>
        <SectionLabel
          icon={<Filter className="size-3" />}
          label="Analysis Method & Traffic"
        />
        <ExperimentRunTrafficConfig
          experimentRun={exp}
          experimentId={experimentId}
          variants={variants}
        />
      </div>

      {exp.trafficAllocation && (
        <div>
          <SectionLabel
            icon={<Flag className="size-3" />}
            label="Traffic Allocation"
          />
          <p className="text-sm leading-relaxed text-muted-foreground">
            {exp.trafficAllocation}
          </p>
        </div>
      )}
    </div>
  );
}

function NewExperimentRunDialog({
  open,
  onOpenChange,
  method,
  onMethodChange,
  variantChoices,
  controlVariant,
  treatmentVariants,
  onControlChange,
  onArmToggle,
  creating,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method: ExperimentMethod;
  onMethodChange: (method: ExperimentMethod) => void;
  variantChoices: VariantChoice[];
  controlVariant: string;
  treatmentVariants: string[];
  onControlChange: (control: string) => void;
  onArmToggle: (arm: string, checked: boolean) => void;
  creating: boolean;
  onCreate: () => void;
}) {
  const selected = METHOD_OPTIONS.find((option) => option.value === method);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Plus className="size-4 text-primary" />
            New experiment run
          </DialogTitle>
          <DialogDescription className="text-xs">
            Choose the analysis method before creating the run. You can change
            it later from Analysis Method &amp; Traffic.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Analysis Method
            </p>
            <MethodChoiceCards value={method} onChange={onMethodChange} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {method === "bandit" ? "Baseline & Arms" : "Control & Treatments"}
            </p>
            {variantChoices.length < 2 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                Bind a FeatBit flag with at least two variations before assigning
                control and treatment variants.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {method === "bandit" ? "Baseline / control" : "Control"}
                  </label>
                  <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border bg-background/70 p-1.5">
                    {variantChoices.map((choice) => (
                      <div
                        key={choice.key}
                        role="button"
                        tabIndex={0}
                        onClick={() => onControlChange(choice.key)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onControlChange(choice.key);
                          }
                        }}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted",
                          controlVariant === choice.key && "bg-primary/10",
                        )}
                      >
                        <input
                          type="radio"
                          checked={controlVariant === choice.key}
                          onChange={() => onControlChange(choice.key)}
                          onClick={(event) => event.stopPropagation()}
                          className="size-3.5"
                        />
                        <VariantChoiceIdentity choice={choice} />
                        <VariantIdCopyButton id={choice.key} />
                      </div>
                    ))}
                  </div>
                </div>

                {method === "bandit" ? (
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Additional arms
                    </label>
                    <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border bg-background/70 p-1.5">
                      {variantChoices
                        .filter((choice) => choice.key !== controlVariant)
                        .map((choice) => (
                          <div
                            key={choice.key}
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              onArmToggle(choice.key, !treatmentVariants.includes(choice.key))
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onArmToggle(
                                  choice.key,
                                  !treatmentVariants.includes(choice.key),
                                );
                              }
                            }}
                            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted"
                          >
                            <input
                              type="checkbox"
                              checked={treatmentVariants.includes(choice.key)}
                              onChange={(event) =>
                                onArmToggle(choice.key, event.target.checked)
                              }
                              onClick={(event) => event.stopPropagation()}
                              className="size-3.5"
                            />
                            <VariantChoiceIdentity choice={choice} />
                            <VariantIdCopyButton id={choice.key} />
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Treatments
                    </label>
                    <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border bg-background/70 p-1.5">
                      {variantChoices
                        .filter((choice) => choice.key !== controlVariant)
                        .map((choice) => (
                          <div
                            key={choice.key}
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              onArmToggle(choice.key, !treatmentVariants.includes(choice.key))
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onArmToggle(
                                  choice.key,
                                  !treatmentVariants.includes(choice.key),
                                );
                              }
                            }}
                            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted"
                          >
                            <input
                              type="checkbox"
                              checked={treatmentVariants.includes(choice.key)}
                              onChange={(event) =>
                                onArmToggle(choice.key, event.target.checked)
                              }
                              onClick={(event) => event.stopPropagation()}
                              className="size-3.5"
                            />
                            <VariantChoiceIdentity choice={choice} />
                            <VariantIdCopyButton id={choice.key} />
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {selected && (
            <div className="rounded-md border bg-muted/25 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              New run will start as <span className="font-semibold text-foreground">{selected.title}</span>.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onCreate} disabled={creating}>
            {creating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            {creating ? "Creating..." : "Create run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type AgentId = "codex" | "claude" | "opencode" | "copilot" | "generic";

const AGENT_OPTIONS: { id: AgentId; label: string; help: string }[] = [
  {
    id: "codex",
    label: "Codex",
    help: "Copy prompt text into your current Codex conversation.",
  },
  {
    id: "claude",
    label: "Claude Code",
    help: "Copy prompt text for Claude Code.",
  },
  {
    id: "opencode",
    label: "OpenCode",
    help: "Copy prompt text for OpenCode.",
  },
  {
    id: "copilot",
    label: "Copilot CLI",
    help: "Copy prompt text for Copilot CLI.",
  },
  {
    id: "generic",
    label: "Generic MCP",
    help: "Copy prompt text for any MCP-capable coding agent.",
  },
];

function buildDecisionPrompt({
  agent,
  experimentId,
  run,
}: {
  agent: AgentId;
  experimentId: string;
  run: ExperimentRun;
}) {
  const agentLead =
    agent === "codex"
      ? "Use the local agent skills and FeatBit MCP server for this task."
      : agent === "claude"
        ? "In Claude Code, load the release-decision skills and use the configured FeatBit MCP server for this task."
        : agent === "opencode"
          ? "In OpenCode, use the release-decision skills and configured FeatBit MCP server for this task."
          : agent === "copilot"
            ? "In Copilot CLI, use the release-decision skill guidance and configured FeatBit MCP server for this task."
            : "Use the release-decision skill guidance and configured FeatBit MCP server for this task.";

  const decisionMode = run.decision
    ? `Revisit the existing ${run.decision} decision for run "${run.slug}" against the latest analysis.`
    : `Produce the first decision for run "${run.slug}".`;

  return [
    agentLead,
    "Requires FeatBit MCP tools named featbit_release_decision_*. If they are missing, ask me to register MCP from this page before continuing.",
    "If a FeatBit MCP tool fails with an expired or revoked token, ask me to create a new MCP token and restart or resume the agent with the new setup command.",
    "",
    `Experiment id: ${experimentId}`,
    `Run id: ${run.id}`,
    `Run slug: ${run.slug}`,
    "",
    "Use $featbit-release-decision as the router and $evidence-analysis for CF-06 evidence sufficiency and CF-07 decision framing.",
    "Refresh analysis with $experiment-workspace only when this run has no usable Bayesian/Bandit analysisResult. Usable Bayesian analysis includes SRM, sample_check, primary_metric rows with p_win/risk, and guardrails.",
    "Do not replace a usable Bayesian/Bandit analysisResult with stats_ready/raw stats. If analyze_run returns only raw stats, stop and report the analyzer mismatch.",
    "Guardrail inverse mapping: increase_bad => inverse=true; decrease_bad => inverse=false.",
    "",
    "Use FeatBit MCP tools:",
    "1. Call featbit_release_decision_get_experiment with the experiment id.",
    "2. Inspect the selected run, current analysisResult, observation window, primary metric, guardrails, minimum sample, SRM result, and risk values.",
    "3. If analysis is missing or clearly unusable, call featbit_release_decision_analyze_run for this run with forceFresh=true, then read the refreshed experiment. If the refreshed analysisResult is only a stats_ready/raw-stats summary, do not make a rollout decision; report the analyzer mismatch.",
    "4. Apply evidence-analysis. Pick exactly one API decision value: CONTINUE, PAUSE, ROLLBACK, or INCONCLUSIVE. If the skill frames it as ROLLBACK CANDIDATE, persist ROLLBACK.",
    "5. Call featbit_release_decision_update_run for this run and write decision, decisionSummary, decisionReason, and status=\"decided\". decisionSummary must start with the concrete feature-flag action: CONTINUE = move treatment to 100% or expand gradually; PAUSE = hold the current rollout; ROLLBACK = route users back to control/default; INCONCLUSIVE = keep observing or fix measurement. decisionReason must cite the primary metric, guardrails, SRM/sample health, and rollout risk. Do not mention tools, MCP, analyze_run, schemas, JSON fields, or whether existing analysis was reused.",
    "6. Call featbit_release_decision_update_experiment with lastAction=\"Decision: <category>\". Do not move the stage to learning unless learning-capture is explicitly requested.",
    "7. Optionally call featbit_release_decision_add_message with a short assistant summary of what was decided and why.",
    "",
    decisionMode,
    "Tie the decision back to the hypothesis, quote concrete metric numbers from the analysis, call out guardrail or instrumentation risks, and finish with the exact next feature-flag action the product team should take.",
    "After writing through MCP, tell me what fields you updated so the UI can refresh and show the result.",
  ].join("\n");
}

function AgentDecisionPromptDialog({
  open,
  onOpenChange,
  experimentId,
  run,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  experimentId: string;
  run: ExperimentRun | null;
}) {
  const [agent, setAgent] = useState<AgentId>("codex");
  const [copied, setCopied] = useState(false);
  const selectedAgent =
    AGENT_OPTIONS.find((option) => option.id === agent) ?? AGENT_OPTIONS[0];
  const prompt = run ? buildDecisionPrompt({ agent, experimentId, run }) : "";
  const value = prompt;

  function copyPrompt() {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[86vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ClipboardList className="size-4 text-primary" />
            Coding agent decision prompt
          </DialogTitle>
          <DialogDescription className="text-xs">
            Copy this into your coding agent. It tells the agent which
            release-decision skills to use, how to refresh the current run data,
            and how to write the decision back through FeatBit MCP.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div
            role="tablist"
            aria-label="Coding agent"
            className="flex flex-wrap gap-1 rounded-md border border-border/80 bg-background/65 p-1"
          >
            {AGENT_OPTIONS.map((option) => {
              const selected = option.id === agent;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  title={option.help}
                  onClick={() => {
                    setAgent(option.id);
                    setCopied(false);
                  }}
                  className={cn(
                    "min-h-7 rounded px-2.5 text-xs font-medium transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="rounded-md border border-border/80 bg-muted/20 p-2.5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {selectedAgent.help}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 shrink-0 text-[11px]"
                onClick={copyPrompt}
              >
                {copied ? (
                  <Check className="size-3" />
                ) : (
                  <Copy className="size-3" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <code className="block max-h-80 overflow-auto whitespace-pre-wrap break-words rounded border bg-background/75 p-3 font-mono text-[11px] leading-relaxed text-foreground">
              {value}
            </code>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main export: inline run selector + merged content ──────────────────── */

export function ExperimentRunTable({
  experimentRuns,
  experimentId,
  flagKey,
  featbitEnvId,
  variants,
  isSequential,
}: {
  experimentRuns: ExperimentRun[];
  experimentId: string;
  flagKey: string | null;
  featbitEnvId: string | null;
  variants: string | null;
  isSequential: boolean;
}) {
  // Tab order = **creation order** (Phase 1 = first created). The parent's
  // sort-by-observationStart is load-bearing for sequential-design detection
  // but misleads the UI when runs haven't set an observation window yet.
  const ordered = useMemo(
    () =>
      [...experimentRuns].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [experimentRuns],
  );

  const [selectedId, setSelectedId] = useState<string | null>(
    ordered.at(-1)?.id ?? null,
  );
  const [creating, startCreate] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [promptRun, setPromptRun] = useState<ExperimentRun | null>(null);
  const [newRunOpen, setNewRunOpen] = useState(false);
  const [newRunMethod, setNewRunMethod] =
    useState<ExperimentMethod>("bayesian_ab");
  const [newRunControlVariant, setNewRunControlVariant] = useState("");
  const [newRunTreatmentVariants, setNewRunTreatmentVariants] = useState<string[]>([]);
  const router = useRouter();
  const variantChoices = useMemo(
    () => parseVariantIdentities(variants),
    [variants],
  );

  // Track previous run count so we can auto-focus the newly-created run when
  // it appears in the list, rather than sticking to the old selection.
  const prevRunCountRef = useRef(ordered.length);
  useEffect(() => {
    if (ordered.length > prevRunCountRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(ordered.at(-1)?.id ?? null);
    }
    prevRunCountRef.current = ordered.length;
  }, [ordered]);

  // If selected run disappears (e.g., deleted), fall back to the last run.
  useEffect(() => {
    if (selectedId && ordered.some((r) => r.id === selectedId)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(ordered.at(-1)?.id ?? null);
  }, [selectedId, ordered]);

  const selected = selectedId
    ? ordered.find((e) => e.id === selectedId) ?? null
    : null;
  const selectedIndex = selected
    ? ordered.findIndex((e) => e.id === selected.id)
    : -1;

  function createRun() {
    const fd = new FormData();
    fd.append("experimentId", experimentId);
    fd.append("method", newRunMethod);
    fd.append("controlVariant", newRunControlVariant);
    fd.append("treatmentVariant", newRunTreatmentVariants.join("|"));
    startCreate(async () => {
      await createNewExperimentRunAction(fd);
      setNewRunOpen(false);
      setNewRunMethod("bayesian_ab");
      resetNewRunVariants("bayesian_ab");
      router.refresh();
    });
  }

  function resetNewRunVariants(method: ExperimentMethod) {
    const normalized = normalizeRunVariantSelection(
      method,
      "",
      [],
      variantChoices,
    );
    setNewRunControlVariant(normalized.control);
    setNewRunTreatmentVariants(normalized.treatments);
  }

  function openNewRunDialog() {
    const method: ExperimentMethod = "bayesian_ab";
    setNewRunMethod(method);
    resetNewRunVariants(method);
    setNewRunOpen(true);
  }

  function changeNewRunMethod(method: ExperimentMethod) {
    const normalized = normalizeRunVariantSelection(
      method,
      newRunControlVariant,
      newRunTreatmentVariants,
      variantChoices,
    );
    setNewRunMethod(method);
    setNewRunControlVariant(normalized.control);
    setNewRunTreatmentVariants(normalized.treatments);
  }

  function changeNewRunControl(control: string) {
    const normalized = normalizeRunVariantSelection(
      newRunMethod,
      control,
      newRunTreatmentVariants,
      variantChoices,
    );
    setNewRunControlVariant(normalized.control);
    setNewRunTreatmentVariants(normalized.treatments);
  }

  function toggleNewRunArm(arm: string, checked: boolean) {
    const normalized = normalizeRunVariantSelection(
      newRunMethod,
      newRunControlVariant,
      checked
        ? [...newRunTreatmentVariants, arm]
        : newRunTreatmentVariants.filter((item) => item !== arm),
      variantChoices,
    );
    setNewRunControlVariant(normalized.control);
    setNewRunTreatmentVariants(normalized.treatments);
  }

  function deleteRun(runId: string) {
    const fd = new FormData();
    fd.append("experimentId", experimentId);
    fd.append("experimentRunId", runId);
    startDelete(async () => {
      await deleteExperimentRunAction(fd);
      setPendingDeleteId(null);
    });
  }

  return (
    <div className="space-y-3">
      {/* ── Run selector ── */}
      <div className="flex items-end gap-1 border-b overflow-x-auto pb-0">
        {ordered.map((exp, idx) => {
          const active = exp.id === selectedId;
          const confirming = pendingDeleteId === exp.id;
          return (
            <div key={exp.id} className="group flex items-stretch">
              <button
                type="button"
                onClick={() => setSelectedId(exp.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-xs border-b-2 -mb-px transition-colors whitespace-nowrap",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="font-medium">
                  {isSequential ? `Phase ${idx + 1}` : `Run ${idx + 1}`}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground/70">
                  {exp.slug}
                </span>
                <RunStatusDot run={exp} />
              </button>
              {active && (
                confirming ? (
                  <div className="flex items-center gap-1 -mb-px border-b-2 border-foreground pb-2 pr-1">
                    <button
                      type="button"
                      onClick={() => deleteRun(exp.id)}
                      disabled={deleting}
                      className="text-[10px] text-destructive font-medium hover:underline disabled:opacity-50"
                    >
                      {deleting ? "Deleting…" : "Confirm"}
                    </button>
                    <span className="text-muted-foreground/60">·</span>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(null)}
                      disabled={deleting}
                      className="text-[10px] text-muted-foreground hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(exp.id)}
                    className="flex items-center -mb-px border-b-2 border-foreground pb-2 pl-1 pr-1 text-muted-foreground/50 hover:text-destructive transition-colors"
                    title="Delete this run"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )
              )}
            </div>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          onClick={openNewRunDialog}
          disabled={creating}
          className="h-8 text-xs gap-1 ml-1 text-muted-foreground"
        >
          {creating ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Plus className="size-3" />
          )}
          New run
        </Button>
      </div>

      {/* ── Selected run content ── */}
      {selected ? (
        <div key={selected.id} className="-mx-4">
          {/* Run header */}
          <div className="px-4 pt-2 pb-3 flex items-center gap-2 flex-wrap">
            {isSequential && selectedIndex >= 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                Phase {selectedIndex + 1}
              </Badge>
            )}
            <span className="font-mono text-sm font-medium">{selected.slug}</span>
            <div className="flex items-center gap-1.5 ml-auto flex-wrap">
              {selected.method && <MethodBadge method={selected.method} />}
              <StatusBadge status={selected.status} />
              {selected.decision && <DecisionBadge decision={selected.decision} />}
            </div>
          </div>

          {/* Merged content: Analyze & Decision, then Audience & Traffic */}
          <SummaryTab
            exp={selected}
            variantChoices={variantChoices}
            onOpenAgentPrompt={() => setPromptRun(selected)}
            analysisPanel={
              <AnalysisTab
                exp={selected}
                experimentId={experimentId}
                flagKey={flagKey}
                featbitEnvId={featbitEnvId}
                variants={variants}
                embedded
              />
            }
          />
          <TrafficTab
            exp={selected}
            experimentId={experimentId}
            variants={variants}
          />
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground/70">
            No experiment runs yet.
          </p>
          <p className="text-xs text-muted-foreground/50 mt-1">
            Click &ldquo;+ New run&rdquo; above to create one.
          </p>
        </div>
      )}
      <AgentDecisionPromptDialog
        open={Boolean(promptRun)}
        onOpenChange={(open) => {
          if (!open) setPromptRun(null);
        }}
        experimentId={experimentId}
        run={promptRun}
      />
      <NewExperimentRunDialog
        open={newRunOpen}
        onOpenChange={setNewRunOpen}
        method={newRunMethod}
        onMethodChange={changeNewRunMethod}
        variantChoices={variantChoices}
        controlVariant={newRunControlVariant}
        treatmentVariants={newRunTreatmentVariants}
        onControlChange={changeNewRunControl}
        onArmToggle={toggleNewRunArm}
        creating={creating}
        onCreate={createRun}
      />
    </div>
  );
}

function RunStatusDot({ run }: { run: ExperimentRun }) {
  if (run.decision) {
    // Decided: green check for CONTINUE, red for ROLLBACK, amber for PAUSE.
    const d = run.decision.toUpperCase();
    const cls =
      d.includes("CONTINUE")
        ? "bg-emerald-500"
        : d.includes("ROLLBACK")
          ? "bg-rose-500"
          : d.includes("PAUSE")
            ? "bg-amber-500"
            : "bg-slate-400";
    return <span className={`size-1.5 rounded-full ${cls}`} title={`Decision: ${run.decision}`} />;
  }
  if (run.status === "running" || run.status === "active") {
    return (
      <span
        className="size-1.5 rounded-full bg-blue-500 animate-pulse"
        title="Running"
      />
    );
  }
  return (
    <span className="size-1.5 rounded-full bg-muted-foreground/40" title={run.status} />
  );
}
