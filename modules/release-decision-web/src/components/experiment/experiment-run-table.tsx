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
  ShieldCheck,
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { appPath } from "@/lib/app-path";
import { authStorage } from "@/lib/featbit-auth/storage";
import { AnalysisView } from "./analysis-markdown";
import { ExperimentRunTrafficConfig } from "./experiment-run-traffic-config";
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
  const label = method === "bandit" ? "Bandit" : "Bayesian A/B";
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

/* ── Simple inline tab bar ── */

/* ── Helpers ── */

function parseGuardrailEvents(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [raw];
  } catch {
    return [raw];
  }
}

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
  onOpenAgentPrompt,
  analysisPanel,
}: {
  exp: ExperimentRun;
  onOpenAgentPrompt?: () => void;
  analysisPanel?: React.ReactNode;
}) {
  const hasDecision = Boolean(exp.decision);

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
      {exp.decisionSummary && (
        <div
          className={`rounded-md border px-3 py-2.5 ${DECISION_BG[exp.decision ?? ""] ?? "bg-muted/30 border-border"}`}
        >
          <p className="text-sm font-medium leading-relaxed">
            {exp.decisionSummary}
          </p>
        </div>
      )}

      {/* Technical rationale */}
      {exp.decisionReason && (
        <div>
          <SectionLabel
            icon={<Target className="size-3" />}
            label="Technical Rationale"
          />
          <p className="text-sm leading-relaxed text-muted-foreground">
            {exp.decisionReason}
          </p>
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
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {[
              exp.controlVariant,
              ...(exp.treatmentVariant
                ?.split("|")
                .map((s: string) => s.trim()) ?? []),
            ]
              .filter(Boolean)
              .map((arm) => (
                <span
                  key={arm}
                  className="inline-flex items-center rounded border px-1.5 py-0.5 text-sm font-mono bg-muted/40"
                >
                  {arm}
                  {arm === exp.controlVariant && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (baseline)
                    </span>
                  )}
                </span>
              ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {exp.controlVariant && (
            <span>
              <Users className="inline size-3 mr-0.5" />
              <span className="text-muted-foreground">Control:</span>{" "}
              <span className="font-mono">{exp.controlVariant}</span>
            </span>
          )}
          {exp.treatmentVariant && (
            <span>
              <span className="text-muted-foreground">Treatment:</span>{" "}
              <span className="font-mono">{exp.treatmentVariant}</span>
            </span>
          )}
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
  embedded = false,
}: {
  exp: ExperimentRun;
  experimentId: string;
  flagKey: string | null;
  featbitEnvId: string | null;
  embedded?: boolean;
}) {
  // Pre-check what the backend requires. Rendering a config gap here beats
  // auto-firing a POST that always 400s before the experiment is set up.
  // If inputData was already pasted in expert setup, we can analyze without
  // live flag wiring — only the metric event is strictly needed.
  const hasStoredInputData = !!exp.inputData;
  const missingFields: string[] = [];
  if (!exp.primaryMetricEvent) missingFields.push("primary metric event");
  if (!hasStoredInputData) {
    if (!flagKey) missingFields.push("flag key");
    if (!featbitEnvId) missingFields.push("FeatBit env ID");
  }

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

  const runAnalysis = useCallback(async (forceFresh = false) => {
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
    runAnalysis(true);
  }, [runAnalysis, exp.analysisResult, missingFields.length]);

  if (missingFields.length > 0 && !analysisResult) {
    return (
      <div className={cn("pb-6 pt-4 space-y-2", embedded ? "" : "px-4")}>
        <p className="text-sm font-medium">Analysis not ready</p>
        <p className="text-sm text-muted-foreground">
          Set up {missingFields.join(", ")} before running analysis.
        </p>
        <p className="text-xs text-muted-foreground/70">
          Ask Codex to configure these through FeatBit MCP, or edit the
          experiment in the <code>Exposing</code> stage.
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
          onClick={() => runAnalysis(true)}
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
          onClick={() => runAnalysis(true)}
        >
          Check again
        </button>
      </div>
    );
  }

  if (!analysisResult) {
    return (
      <div className={cn("pb-6 pt-2 space-y-2", embedded ? "" : "px-4")}>
        <RefreshAnalysisButton loading={loading} onConfirm={() => runAnalysis(true)} />
        <p className="text-sm text-muted-foreground/60">No analysis available yet.</p>
      </div>
    );
  }

  return (
    <div className={cn("pb-6 overflow-x-auto", embedded ? "" : "px-4")}>
      <div className="mb-2">
        <RefreshAnalysisButton loading={loading} onConfirm={() => runAnalysis(true)} />
      </div>
      {warning && (
        <p className="mb-2 text-sm text-amber-600 dark:text-amber-400">{warning}</p>
      )}
      <div className="rounded border bg-muted/20 px-3 py-2.5">
        <AnalysisView content={analysisResult} />
      </div>
    </div>
  );
}

function TrafficTab({
  exp,
  experimentId,
}: {
  exp: ExperimentRun;
  experimentId: string;
}) {
  return (
    <div className="px-4 pb-6 space-y-4">
      <div>
        <SectionLabel
          icon={<Filter className="size-3" />}
          label="Audience & Traffic"
        />
        <ExperimentRunTrafficConfig experimentRun={exp} experimentId={experimentId} />
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
    "This prompt assumes the FeatBit MCP tools are already visible in this agent session. If featbit_release_decision_* tools are not available, stop and tell me to register MCP, then restart or resume the agent with the setup command from this page; do not try to use MCP resources/templates as a substitute.",
    "If a FeatBit MCP tool is visible but fails with an expired or revoked token error, stop and tell me to create a new MCP token on this page, then restart or resume the agent with the newly generated command. Retrying with the same token will not fix it.",
    "",
    `Experiment id: ${experimentId}`,
    `Run id: ${run.id}`,
    `Run slug: ${run.slug}`,
    "",
    "Use the $featbit-release-decision skill as the router, then use $evidence-analysis for CF-06 evidence sufficiency and CF-07 decision framing.",
    "Only use $experiment-workspace to refresh analysis when the selected run has no usable Bayesian/Bandit analysisResult. A usable Bayesian analysisResult includes srm, sample_check, primary_metric rows with p_win and risk values, and any guardrail sections.",
    "Do not overwrite an existing usable Bayesian/Bandit analysisResult with a stats_ready summary. If featbit_release_decision_analyze_run returns analysisResult without p_win/risk/SRM, stop and report that the API analyzer is returning raw stats instead of the full release-decision analysis schema.",
    "Guardrail direction mapping: increase_bad means inverse=true because lower is better; decrease_bad means inverse=false because higher is better. Do not report decrease_bad plus inverse=false as a mismatch.",
    "",
    "Use FeatBit MCP tools, not the old project-sync scripts:",
    "1. Call featbit_release_decision_get_experiment with the experiment id.",
    "2. Inspect the selected run, current analysisResult, observation window, primary metric, guardrails, minimum sample, SRM result, and risk values.",
    "3. If analysis is missing or clearly unusable, call featbit_release_decision_analyze_run for this run with forceFresh=true, then read the refreshed experiment. If the refreshed analysisResult is only a stats_ready/raw-stats summary, do not make a rollout decision; report the analyzer mismatch.",
    "4. Apply evidence-analysis. Pick exactly one API decision value: CONTINUE, PAUSE, ROLLBACK, or INCONCLUSIVE. If the skill frames it as ROLLBACK CANDIDATE, persist ROLLBACK.",
    "5. Call featbit_release_decision_update_run for this run and write decision, decisionSummary, decisionReason, and status=\"decided\".",
    "6. Call featbit_release_decision_update_experiment with lastAction=\"Decision: <category>\". Do not move the stage to learning unless learning-capture is explicitly requested.",
    "7. Optionally call featbit_release_decision_add_message with a short assistant summary of what was decided and why.",
    "",
    decisionMode,
    "Tie the decision back to the hypothesis, quote concrete metric numbers from the analysis, call out guardrail or instrumentation risks, and finish with the next action the product team should take.",
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
  isSequential,
}: {
  experimentRuns: ExperimentRun[];
  experimentId: string;
  flagKey: string | null;
  featbitEnvId: string | null;
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

  // Track previous run count so we can auto-focus the newly-created run when
  // it appears in the list, rather than sticking to the old selection.
  const prevRunCountRef = useRef(ordered.length);
  useEffect(() => {
    if (ordered.length > prevRunCountRef.current) {
      setSelectedId(ordered.at(-1)?.id ?? null);
    }
    prevRunCountRef.current = ordered.length;
  }, [ordered]);

  // If selected run disappears (e.g., deleted), fall back to the last run.
  useEffect(() => {
    if (selectedId && ordered.some((r) => r.id === selectedId)) return;
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
    startCreate(async () => {
      await createNewExperimentRunAction(fd);
    });
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
          onClick={createRun}
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
            onOpenAgentPrompt={() => setPromptRun(selected)}
            analysisPanel={
              <AnalysisTab
                exp={selected}
                experimentId={experimentId}
                flagKey={flagKey}
                featbitEnvId={featbitEnvId}
                embedded
              />
            }
          />
          <TrafficTab exp={selected} experimentId={experimentId} />
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
