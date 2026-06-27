import { getStage } from "@/lib/stages";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Lightbulb,
  FlaskConical,
  BarChart3,
  Flag,
  ScrollText,
} from "lucide-react";
import type { Experiment, ExperimentRun, Activity } from "@/lib/release-decision-types";
import { EditDecisionStateDialog } from "./decision-state-edit";

/* ── Field metadata per stage ── */
const STAGE_FIELDS: Record<string, { fields: string[]; icon: React.ReactNode }> = {
  intent: { fields: ["goal", "intent"], icon: <Target className="size-3.5" /> },
  hypothesis: {
    fields: ["goal", "intent", "hypothesis", "change"],
    icon: <Lightbulb className="size-3.5" />,
  },
  implementing: {
    fields: ["goal", "hypothesis", "change", "primaryMetric"],
    icon: <FlaskConical className="size-3.5" />,
  },
  measuring: {
    fields: ["goal", "hypothesis", "primaryMetric", "guardrails"],
    icon: <BarChart3 className="size-3.5" />,
  },
  learning: {
    fields: ["goal", "hypothesis", "primaryMetric"],
    icon: <Lightbulb className="size-3.5" />,
  },
};

const FIELD_LABELS: Record<string, string> = {
  goal: "Goal",
  intent: "Intent",
  hypothesis: "Hypothesis",
  change: "Change",
  constraints: "Constraints",
  primaryMetric: "Primary Metric",
  guardrails: "Guardrails",
};

function renderFieldText(field: string, value: string): string {
  if (!value) return value;
  if (field === "primaryMetric") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && (parsed.event || parsed.name)) {
        const parts: string[] = [];
        if (parsed.name) parts.push(parsed.name);
        if (parsed.event) {
          parts.push(
            [
              parsed.event,
              parsed.metricType,
              parsed.metricAgg ? `counted ${parsed.metricAgg}` : null,
              parsed.expectedDirection === "decrease_good"
                ? "lower is better"
                : parsed.expectedDirection === "increase_good"
                  ? "higher is better"
                  : null,
            ]
              .filter(Boolean)
              .join(" · ")
          );
        }
        return parts.join(" — ");
      }
    } catch {
      // not JSON
    }
  }
  return value;
}

export function ContextPanel({
  experiment,
}: {
  experiment: Experiment & { experimentRuns: ExperimentRun[]; activities: Activity[] };
}) {
  const stage = getStage(experiment.stage);
  const config = STAGE_FIELDS[experiment.stage] ?? STAGE_FIELDS.intent;
  const isConfigured = Boolean(experiment.flagKey && experiment.envSecret);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5 text-sm">
      {/* ── Decision State ── */}
      <section className="space-y-2">
        <div className="flex items-center gap-1.5">
          {config.icon}
          <h3 className="rd-heading-label">Decision State</h3>
          <Badge variant="secondary" className={`ml-auto text-[10px] ${stage.color}`}>
            {stage.cf}
          </Badge>
          <EditDecisionStateDialog experiment={experiment} />
        </div>
        <div className="space-y-1.5">
          {config.fields.map((field) => {
            const raw = (experiment[field as keyof Experiment] as string) ?? "";
            const value = renderFieldText(field, raw);
            return (
              <div key={field}>
                <h4 className="rd-heading-field">
                  {FIELD_LABELS[field] ?? field}
                </h4>
                <p className="text-xs leading-relaxed">
                  {value || (
                    <span className="italic text-muted-foreground/50">
                      Not set
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Feature Flag ── */}
      <section className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Flag className="size-3.5" />
          <h3 className="rd-heading-label">Feature Flag</h3>
          <Badge
            variant={isConfigured ? "secondary" : "outline"}
            className="ml-auto text-[10px]"
          >
            {isConfigured ? "Configured" : "Not set"}
          </Badge>
        </div>
        {isConfigured ? (
          <div className="space-y-1">
            <div>
              <h4 className="rd-heading-field">
                Key
              </h4>
              <p className="text-xs font-mono">{experiment.flagKey}</p>
            </div>
            {experiment.flagServerUrl && (
              <div>
                <h4 className="rd-heading-field">
                  Server
                </h4>
                <p className="text-xs font-mono truncate">
                  {experiment.flagServerUrl}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/50 italic">
            The agent will configure the flag during implementation.
          </p>
        )}
      </section>

      {/* ── Experiment Runs ── */}
      {experiment.experimentRuns.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-1.5">
            <FlaskConical className="size-3.5" />
            <h3 className="rd-heading-label">Experiment Runs</h3>
            <span className="ml-auto text-[10px] tabular-nums">
              {experiment.experimentRuns.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {experiment.experimentRuns.map((exp) => (
              <div
                key={exp.id}
                className="rounded border px-2 py-1.5 space-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono">{exp.slug}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {exp.status}
                  </Badge>
                </div>
                {exp.decision && (
                  <p className="text-[10px] text-muted-foreground">
                    Decision: {exp.decision}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Recent Activity ── */}
      <section className="space-y-2">
        <div className="flex items-center gap-1.5">
          <ScrollText className="size-3.5" />
          <h3 className="rd-heading-label">Activity</h3>
        </div>
        {experiment.activities.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 italic">
            No activity yet
          </p>
        ) : (
          <div className="space-y-1.5">
            {experiment.activities.slice(0, 8).map((a) => (
              <div key={a.id} className="text-xs">
                <p className="leading-tight">{a.title}</p>
                <p className="text-[10px] text-muted-foreground/60">
                  {new Date(a.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
