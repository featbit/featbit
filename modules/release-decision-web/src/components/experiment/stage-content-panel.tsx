import { useState } from "react";
import { getStage } from "@/lib/stages";
import { EditDecisionStateDialog } from "./decision-state-edit";
import { MetricEditDialog } from "./metric-edit";
import { Badge } from "@/components/ui/badge";
import { ExperimentActions } from "./experiment-actions";
import {
  Lightbulb,
  FlaskConical,
  BarChart3,
  Flag,
  Filter,
  BookOpen,
  Beaker,
  Calendar,
  Info,
  Code,
  Pencil,
  Activity,
  ShieldAlert,
  ShieldCheck,
  Target,
  Settings as SettingsIcon,
} from "lucide-react";
import type { Experiment, ExperimentRun } from "@/lib/release-decision-types";
import {
  FlagIntegrationHeader,
  FlagIntegrationPanel,
  SdkCredentialsPopup,
} from "./flag-config";
import { Button } from "@/components/ui/button";
import { MetricEditPanel } from "./metric-edit";
import { ExperimentRunTrafficConfig } from "./experiment-run-traffic-config";
import { ExperimentRunTable } from "./experiment-run-table";
import { TrafficPoolView } from "./traffic-pool-view";
import {
  parseVariantIdentities,
  splitVariantTokens,
  VariantIdentityInline,
} from "./variant-identity";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

type ExperimentWithRelations = Experiment & {
  experimentRuns: ExperimentRun[];
};

/* ── Shared: sort experiment runs by observationStart & detect sequential design ── */
function sortAndDetectSequential(experimentRuns: ExperimentRun[]) {
  const sorted = [...experimentRuns].sort((a, b) => {
    if (!a.observationStart) return 1;
    if (!b.observationStart) return -1;
    return new Date(a.observationStart).getTime() - new Date(b.observationStart).getTime();
  });
  const isSequential =
    sorted.length >= 2 &&
    !!sorted[0].observationEnd &&
    !!sorted[1].observationStart &&
    new Date(sorted[0].observationEnd) <= new Date(sorted[1].observationStart);
  return { sorted, isSequential };
}

/* ── Per-stage field definitions ── */
const STAGE_CONFIG: Record<
  string,
  { icon: React.ReactNode; fields: { key: keyof Experiment; label: string }[] }
> = {
  hypothesis: {
    icon: <Lightbulb className="size-3.5" />,
    fields: [
      { key: "description", label: "Description" },
      { key: "goal", label: "Goal" },
      { key: "intent", label: "Intent" },
      { key: "hypothesis", label: "Hypothesis" },
      { key: "change", label: "Change" },
      { key: "constraints", label: "Constraints" },
    ],
  },
  implementing: {
    icon: <FlaskConical className="size-3.5" />,
    fields: [],
  },
  measuring: {
    icon: <BarChart3 className="size-3.5" />,
    fields: [], // measuring has its own custom layout
  },
  learning: {
    icon: <BookOpen className="size-3.5" />,
    fields: [
      { key: "hypothesis", label: "Hypothesis" },
      { key: "lastLearning", label: "Key Learning" },
    ],
  },
};

/* ── Main panel ── */
export function StageContentPanel({
  experiment,
  activeTab,
  onStageChange,
}: {
  experiment: ExperimentWithRelations;
  activeTab: string;
  onStageChange?: (stageKey: string) => void;
}) {
  if (activeTab === "settings") {
    return <SettingsContent experiment={experiment} />;
  }

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      {/* Stage-specific content */}
      {activeTab === "measuring" ? (
        <MeasuringContent experiment={experiment} />
      ) : activeTab === "implementing" ? (
        <FlagAndExperimentSection experiment={experiment} />
      ) : activeTab === "learning" ? (
        <>
          <FieldsSection experiment={experiment} stageKey={activeTab} />
          <LearningSection experimentRuns={experiment.experimentRuns} />
        </>
      ) : activeTab === "hypothesis" ? (
        <>
          <FieldsSection experiment={experiment} stageKey={activeTab} />
          <ConflictAnalysisSection conflictAnalysis={experiment.conflictAnalysis} />
        </>
      ) : (
        <FieldsSection experiment={experiment} stageKey={activeTab} />
      )}
    </div>
  );
}

/* ── Settings pseudo-stage ── */
function SettingsContent({
  experiment,
}: {
  experiment: ExperimentWithRelations;
}) {
  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <SettingsIcon className="size-4" />
          <h2 className="rd-heading-section">Settings</h2>
        </div>
        <h3 className="rd-heading-subtitle">
          Administrative actions for this experiment.
        </h3>
      </div>

      <section className="space-y-2">
        <h3 className="rd-heading-label">
          Metadata
        </h3>
        <div className="rounded-md border bg-muted/10 px-3 py-3 space-y-2 text-sm">
          <div>
            <h4 className="rd-heading-field">Name</h4>
            <p className="leading-relaxed">{experiment.name}</p>
          </div>
          <div>
            <h4 className="rd-heading-field">Description</h4>
            <p className="fb-wrap-text leading-relaxed whitespace-pre-line">
              {experiment.description || (
                <span className="italic text-muted-foreground/50">Not set (edit in Hypothesis stage)</span>
              )}
            </p>
          </div>
          <div>
            <h4 className="rd-heading-field">Experiment ID</h4>
            <p className="font-mono text-xs text-muted-foreground">{experiment.id}</p>
          </div>
          {experiment.featbitEnvId && (
            <div>
              <h4 className="rd-heading-field">FeatBit Env ID</h4>
              <p className="font-mono text-xs text-muted-foreground">{experiment.featbitEnvId}</p>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="rd-heading-label">
          Danger zone
        </h3>
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-3 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Deleting an experiment permanently removes its runs, activity, and message history. This cannot be undone.
          </p>
          <ExperimentActions experimentId={experiment.id} experimentName={experiment.name} />
        </div>
      </section>
    </div>
  );
}

/* ── Shared multi-line metric renderer ── */
type ParsedMetricLines =
  | { kind: "empty" }
  | { kind: "guardrails"; items: { name?: string; event?: string; description?: string }[] }
  | { kind: "structured"; item: { name?: string; event?: string; metricType?: string; metricAgg?: string; expectedDirection?: string; description?: string } }
  | { kind: "plain"; lines: string[] };

function MetricLines({ value }: { value: string | null | undefined }) {
  const parsed = parseMetricLinesValue(value);

  switch (parsed.kind) {
    case "empty":
      return <p className="text-sm italic text-muted-foreground/50">Not set</p>;
    case "guardrails":
      return (
        <ul className="space-y-1">
          {parsed.items.map((g, i) => (
            <li key={i} className="fb-wrap-text text-sm">
              <span className="font-mono font-medium">{g.name ?? g.event ?? ""}</span>
              {g.description && (
                <span className="text-muted-foreground"> — {g.description}</span>
              )}
            </li>
          ))}
        </ul>
      );
    case "structured": {
      const item = parsed.item;
      const technicalLine = [
        item.event,
        item.metricType,
        item.metricAgg ? `counted ${item.metricAgg}` : null,
        item.expectedDirection === "decrease_good"
          ? "lower is better"
          : item.expectedDirection === "increase_good"
            ? "higher is better"
            : null,
      ].filter(Boolean).join(" · ");

      return (
        <div className="space-y-0.5">
          {item.name && <p className="fb-wrap-text text-sm leading-relaxed font-medium">{item.name}</p>}
          {item.event && (
            <p className="fb-wrap-text text-xs font-mono text-muted-foreground">{technicalLine}</p>
          )}
          {item.description && (
            <p className="fb-wrap-text text-xs text-muted-foreground/70 leading-relaxed">{item.description}</p>
          )}
        </div>
      );
    }
    case "plain":
      if (parsed.lines.length === 1) {
        return <p className="fb-wrap-text text-sm leading-relaxed">{parsed.lines[0]}</p>;
      }

      return (
        <ul className="space-y-0.5">
          {parsed.lines.map((line, i) => (
            <li key={i} className="fb-wrap-text text-sm leading-relaxed">{line}</li>
          ))}
        </ul>
      );
  }
}

function parseMetricLinesValue(value: string | null | undefined): ParsedMetricLines {
  if (!value) return { kind: "empty" };

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed) && parsed.length > 0) {
      return { kind: "guardrails", items: parsed };
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && (parsed.event || parsed.name)) {
      return { kind: "structured", item: parsed };
    }
  } catch {
    // Plain text metrics are still supported for older MCP/user-entered data.
  }

  return { kind: "plain", lines: value.split("\n").filter(Boolean) };
}

/* ── Generic fields renderer ── */
function FieldsSection({
  experiment,
  stageKey,
}: {
  experiment: ExperimentWithRelations;
  stageKey: string;
}) {
  const config = STAGE_CONFIG[stageKey];
  if (!config || config.fields.length === 0) return null;

  const editableKeys = config.fields.map((f) => f.key) as Array<keyof Experiment>;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5">
        {config.icon}
        <h3 className="rd-heading-label">Details</h3>
        <EditDecisionStateDialog experiment={experiment} fields={editableKeys} />
      </div>
      <div className="space-y-2">
        {config.fields.map(({ key, label }) => {
          const value = (experiment[key] as string) ?? "";
          return (
            <div key={key}>
              <h4 className="rd-heading-field">
                {label}
              </h4>
              {key === "guardrails" ? (
                <MetricLines value={value} />
              ) : (
                <p className="fb-wrap-text text-sm leading-relaxed whitespace-pre-line">
                  {value || (
                    <span className="italic text-muted-foreground/50">
                      Not set
                    </span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── Combined flag + metric integration + experiment runs (implementing) ── */
function FlagAndExperimentSection({
  experiment,
}: {
  experiment: ExperimentWithRelations;
}) {
  const experimentRuns = experiment.experimentRuns;
  const { sorted } = sortAndDetectSequential(experimentRuns);

  // Full-screen edit panels replace stage content instead of using a Sheet
  // overlay, keeping the stage workflow in one stable workspace.
  const [flagPanelOpen, setFlagPanelOpen] = useState(false);
  const [metricsPanelOpen, setMetricsPanelOpen] = useState(false);
  const [sdkCredsOpen, setSdkCredsOpen] = useState(false);

  if (flagPanelOpen) {
    return (
      <div className="min-h-[70vh]">
        <FlagIntegrationPanel
          experiment={experiment}
          experimentRuns={sorted}
          onClose={() => setFlagPanelOpen(false)}
          onEditAdvanced={() => setSdkCredsOpen(true)}
        />
        <SdkCredentialsPopup
          experiment={experiment}
          open={sdkCredsOpen}
          onOpenChange={setSdkCredsOpen}
        />
      </div>
    );
  }

  if (metricsPanelOpen) {
    return (
      <div className="min-h-[70vh]">
        <MetricEditPanel
          experiment={experiment}
          onClose={() => setMetricsPanelOpen(false)}
        />
      </div>
    );
  }

  return (
    <>
      {/* ─── Section 1: Flag Integration & Rollout (summary) ─── */}
      <FlagIntegrationHeader
        experiment={experiment}
        experimentRuns={sorted}
        onEdit={() => setFlagPanelOpen(true)}
      />

      {/* ─── Section 2: Metrics Integration ─── */}
      <MetricsIntegrationSection
        experiment={experiment}
        experimentRuns={sorted}
        onEdit={() => setMetricsPanelOpen(true)}
      />
    </>
  );
}

/* ── Metrics integration section ── */
// metricType / metricAgg vocabulary is the canonical set ("continuous" not "numeric";
// adds "average") shared with the run columns and sync.ts. See AGENTS.md → Metric
// Vocabulary. Parser below tolerates legacy "numeric" values for back-compat.
type PrimaryMetric = {
  name?: string;
  event?: string;
  metricType?: "binary" | "continuous";
  metricAgg?: "once" | "count" | "sum" | "average";
  expectedDirection?: "increase_good" | "decrease_good";
  description?: string;
};

type GuardrailMetric = {
  name?: string;
  event?: string;
  metricType?: "binary" | "continuous";
  metricAgg?: "once" | "count" | "sum" | "average";
  direction?: "increase_bad" | "decrease_bad";
  description?: string;
};

function parsePrimary(raw: string | null | undefined): PrimaryMetric | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
  } catch {
    // legacy free text → treat as display name
    return { name: raw };
  }
  return null;
}

function parseGuardrails(raw: string | null | undefined): GuardrailMetric[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v as GuardrailMetric[];
  } catch {
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const m = l.match(/^(.+?)\s*[—–-]+\s*(.+)$/);
        return m ? { name: m[1].trim(), description: m[2].trim() } : { name: l };
      });
  }
  return [];
}

function MetricsIntegrationSection({
  experiment,
  onEdit,
}: {
  experiment: ExperimentWithRelations;
  experimentRuns: ExperimentRun[];
  onEdit: () => void;
}) {
  const primary = parsePrimary(experiment.primaryMetric);
  const guardrails = parseGuardrails(experiment.guardrails);
  const primaryNeedsEventMapping = !!primary && !primary.event;

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Activity className="size-3.5" />
        <h3 className="rd-heading-label">Metrics Integration</h3>
        <button
          type="button"
          onClick={onEdit}
          className="ml-1 text-muted-foreground/50 hover:text-foreground transition-colors"
          title="Edit metrics"
        >
          <Pencil className="size-3" />
        </button>
      </div>

      {!primary && guardrails.length === 0 ? (
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1.5 text-sm text-muted-foreground/60 italic hover:text-muted-foreground cursor-pointer"
        >
          Not configured — click to set up
          <Pencil className="size-3" />
        </button>
      ) : (
        <div className="space-y-2">
          {primaryNeedsEventMapping && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              This is a success metric concept from the decision-framing step.
              It still needs a FeatBit metric event, type, and aggregation before
              analysis can run.
            </div>
          )}
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-1.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-20">Role</th>
                  <th className="px-3 py-1.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="px-3 py-1.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Event</th>
                  <th className="px-3 py-1.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-20">Type</th>
                  <th className="px-3 py-1.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28">Agg</th>
                  <th className="px-3 py-1.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">Direction</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {primary && (
                  <tr className="bg-blue-50/40 dark:bg-blue-950/20">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                        <Target className="size-3 shrink-0" />
                        Primary
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold">{primary.name || <span className="italic text-muted-foreground/50">—</span>}</td>
                    <td className="px-3 py-2">
                      {primary.event
                        ? <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{primary.event}</code>
                        : <span className="text-amber-700 dark:text-amber-300">Needs event mapping</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{primary.metricType ?? (primary.event ? "—" : "pending")}</td>
                    <td className="px-3 py-2 text-muted-foreground">{primary.metricAgg ? formatAgg(primary.metricAgg) : primary.event ? "—" : "pending"}</td>
                    <td className="px-3 py-2">
                      {primary.expectedDirection === "decrease_good"
                        ? <span className="text-blue-700 dark:text-blue-300 font-mono">↓ good</span>
                        : <span className="text-blue-700 dark:text-blue-300 font-mono">↑ good</span>}
                    </td>
                  </tr>
                )}
                {guardrails.map((g, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                        <ShieldCheck className="size-3 shrink-0" />
                        Guard
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">{g.name || <span className="italic text-muted-foreground/50">—</span>}</td>
                    <td className="px-3 py-2">
                      {g.event
                        ? <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{g.event}</code>
                        : <span className="text-amber-700 dark:text-amber-300">Needs event mapping</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{g.metricType ?? (g.event ? "—" : "pending")}</td>
                    <td className="px-3 py-2 text-muted-foreground">{g.metricAgg ? formatAgg(g.metricAgg) : g.event ? "—" : "pending"}</td>
                    <td className="px-3 py-2">
                      {g.direction === "increase_bad"
                        ? <span className="text-rose-600 dark:text-rose-400 font-mono">↑ bad</span>
                        : g.direction === "decrease_bad"
                        ? <span className="text-rose-600 dark:text-rose-400 font-mono">↓ bad</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5">
          <Pencil className="size-3.5" />
          Edit Metrics
        </Button>
      </div>
    </section>
  );
}

function formatAgg(agg?: string): string {
  switch (agg) {
    case "once":    return "once per user";
    case "count":   return "count all";
    case "sum":     return "sum values";
    case "average": return "average values";
    default:        return "—";
  }
}

/* ── Single experiment run card ── */
function ExperimentRunCard({
  run,
  idx,
  isSequential,
  experimentId,
  flagKey,
  variants,
  existingLayerKeys = [],
}: {
  run: ExperimentRun;
  idx: number;
  isSequential: boolean;
  experimentId: string;
  flagKey: string | null;
  variants?: string | null;
  existingLayerKeys?: string[];
}) {
  const variantRows = parseVariantIdentities(variants);
  const treatmentVariants = splitVariantTokens(run.treatmentVariant);

  return (
    <div className="rounded-md border space-y-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b">
        {isSequential ? (
          <Badge variant="outline" className="text-xs px-1.5 py-0">
            Phase {idx + 1}
          </Badge>
        ) : (
          <span className="text-sm font-medium text-muted-foreground">
            #{idx + 1}
          </span>
        )}
        <h3 className="rd-heading-subsection font-mono">{run.slug}</h3>
        <div className="ml-auto flex items-center gap-1.5">
          {run.method && <MethodBadge method={run.method} />}
          <StatusBadge status={run.status} />
        </div>
      </div>

      <div className="px-3 py-2 space-y-3">
        {/* Variants */}
        <div className="grid gap-1 text-sm">
          {run.controlVariant && (
            <div className="flex min-w-0 items-center gap-1">
              <span className="inline-block size-2 rounded-full bg-emerald-500" />
              <VariantIdentityInline
                token={run.controlVariant}
                variants={variantRows}
                role="Control"
                className="min-w-0"
              />
            </div>
          )}
          {treatmentVariants.map((variant, index) => (
            <div key={`${variant}-${index}`} className="flex min-w-0 items-center gap-1">
              <span className="inline-block size-2 rounded-full bg-violet-500" />
              <VariantIdentityInline
                token={variant}
                variants={variantRows}
                role={treatmentVariants.length > 1 ? `Treatment ${index + 1}` : "Treatment"}
                className="min-w-0"
              />
            </div>
          ))}
        </div>

        {/* Audience & Traffic — merged with traffic allocation */}
        <div>
          <SectionLabel icon={<Filter className="size-3" />} label="Audience &amp; Traffic" />
          <ExperimentRunTrafficConfig
            experimentRun={run}
            experimentId={experimentId}
            variants={variants}
            existingLayerKeys={existingLayerKeys}
          />
        </div>

        {/* Schedule: Observation window + min sample */}
        {(run.observationStart || run.minimumSample) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {run.minimumSample && (
              <span>
                Min sample: <span className="tabular-nums font-medium text-foreground">{run.minimumSample}</span>/variant
              </span>
            )}
            {run.observationStart && run.observationEnd && (
              <span>
                <Calendar className="inline size-3 mr-0.5" />
                {fmtDate(run.observationStart)} → {fmtDate(run.observationEnd)}
              </span>
            )}
          </div>
        )}

        {/* Method reason — collapsible */}
        {run.methodReason && (
          <Collapsible>
            <CollapsibleTrigger className="text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground">
              <Info className="size-3" />
              Why This Method
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              <p className="fb-wrap-text text-sm leading-relaxed text-muted-foreground pl-5">
                {run.methodReason}
              </p>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

/* ── Measuring: metrics overview + rich experiment run cards ── */
function MeasuringContent({
  experiment,
}: {
  experiment: ExperimentWithRelations;
}) {
  const { sorted, isSequential } = sortAndDetectSequential(experiment.experimentRuns);

  return (
    <>
      {/* Metrics are defined in Implementing — not duplicated here. */}

      {/* Run tabs already carry the label — no separate heading needed. */}
      <section>
        <ExperimentRunTable
          experimentRuns={sorted}
          experimentId={experiment.id}
          flagKey={experiment.flagKey}
          featbitEnvId={experiment.featbitEnvId}
          variants={experiment.variants}
          isSequential={isSequential}
        />
      </section>
    </>
  );
}

/* ── Experiment run learnings (learning tab) ── */
function LearningSection({
  experimentRuns,
}: {
  experimentRuns: ExperimentRun[];
}) {
  const { sorted, isSequential } = sortAndDetectSequential(experimentRuns);
  const withLearnings = sorted.filter(
    (e) =>
      e.whatChanged ||
      e.whatHappened ||
      e.confirmedOrRefuted ||
      e.nextHypothesis
  );

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5">
        <BookOpen className="size-3.5" />
        <h3 className="rd-heading-label">Experiment Run Learnings</h3>
      </div>
      {withLearnings.length === 0 ? (
        <div className="rounded-md border border-dashed p-3 text-center">
          <p className="text-sm text-muted-foreground/60">
            No learnings captured yet.
          </p>
          <p className="text-xs text-muted-foreground/40 mt-1">
            Learnings will be recorded after experiment runs are analyzed.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {withLearnings.map((exp) => {
            const phaseIdx = sorted.indexOf(exp);
            return (
            <div key={exp.id} className="rounded border px-2 py-2 space-y-1">
              <div className="flex items-center gap-1.5">
                {isSequential ? (
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    Phase {phaseIdx + 1}
                  </Badge>
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">
                    #{phaseIdx + 1}
                  </span>
                )}
                <h4 className="rd-heading-subsection font-mono">{exp.slug}</h4>
              </div>
              {exp.whatChanged && (
                <div>
                  <h4 className="rd-heading-field">
                    What Changed
                  </h4>
                  <p className="fb-wrap-text text-sm leading-relaxed">{exp.whatChanged}</p>
                </div>
              )}
              {exp.whatHappened && (
                <div>
                  <h4 className="rd-heading-field">
                    What Happened
                  </h4>
                  <p className="fb-wrap-text text-sm leading-relaxed">{exp.whatHappened}</p>
                </div>
              )}
              {exp.confirmedOrRefuted && (
                <div>
                  <h4 className="rd-heading-field">
                    Confirmed or Refuted
                  </h4>
                  <p className="fb-wrap-text text-sm leading-relaxed">
                    {exp.confirmedOrRefuted}
                  </p>
                </div>
              )}
              {exp.whyItHappened && (
                <div>
                  <h4 className="rd-heading-field">
                    Why It Happened
                  </h4>
                  <p className="fb-wrap-text text-sm leading-relaxed">
                    {exp.whyItHappened}
                  </p>
                </div>
              )}
              {exp.nextHypothesis && (
                <div>
                  <h4 className="rd-heading-field">
                    Next Hypothesis
                  </h4>
                  <p className="fb-wrap-text text-sm leading-relaxed">
                    {exp.nextHypothesis}
                  </p>
                </div>
              )}
            </div>
          );
          })}
        </div>
      )}
    </section>
  );
}

/* ── Conflict analysis section (hypothesis stage) ── */
function ConflictAnalysisSection({
  conflictAnalysis,
}: {
  conflictAnalysis: string | null | undefined;
}) {
  if (!conflictAnalysis) return null;

  const hasConflict =
    conflictAnalysis.includes("⚠️") ||
    conflictAnalysis.toLowerCase().includes("conflict detected") ||
    conflictAnalysis.toLowerCase().includes("potential conflict");

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5">
        {hasConflict ? (
          <ShieldAlert className="size-3.5 text-amber-500" />
        ) : (
          <ShieldCheck className="size-3.5 text-emerald-500" />
        )}
        <h3 className="rd-heading-label">Experiment Conflict Check</h3>
      </div>
      <div
        className={`fb-wrap-text rounded-md border px-3 py-3 text-sm leading-relaxed whitespace-pre-line ${
          hasConflict
            ? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
            : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
        }`}
      >
        {conflictAnalysis}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   Shared primitives
   ═══════════════════════════════════════════════════════════ */

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <h4 className="rd-heading-label mb-0.5 flex items-center gap-1">
      {icon}
      <span>{label}</span>
    </h4>
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

const DECISION_COLORS: Record<string, string> = {
  CONTINUE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  PAUSE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  ROLLBACK: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  INCONCLUSIVE: "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300",
};

function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision) {
    return (
      <Badge variant="outline" className="text-[10px]">
        Pending
      </Badge>
    );
  }
  const color = DECISION_COLORS[decision] ?? "";
  return (
    <Badge className={`text-[10px] px-1.5 py-0 ${color}`}>
      {decision}
    </Badge>
  );
}

function parseGuardrailDescriptions(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

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

