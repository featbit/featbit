import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ExperimentRun } from "@/generated/prisma";

function parseGuardrailEvents(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [raw];
  } catch {
    return [raw];
  }
}

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  analyzing:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  decided:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  archived: "bg-muted text-muted-foreground",
};

const DECISION_COLOR: Record<string, string> = {
  CONTINUE:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  PAUSE: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  ROLLBACK:
    "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  INCONCLUSIVE:
    "bg-muted text-muted-foreground",
};

export function ExperimentRunList({
  experimentRuns,
  experimentId,
}: {
  experimentRuns: ExperimentRun[];
  experimentId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Experiment Runs</CardTitle>
          <span className="text-xs text-muted-foreground">
            Created by sandbox agent
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {experimentRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No experiment runs yet. The sandbox agent will create experiment runs when
            the experiment reaches the measuring stage.
          </p>
        ) : (
          <div className="space-y-3">
            {experimentRuns.map((exp) => (
              <div
                key={exp.id}
                className="rounded-md border p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">
                    {exp.slug}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${STATUS_COLOR[exp.status] ?? ""}`}
                    >
                      {exp.status}
                    </Badge>
                    {exp.decision && (
                      <Badge
                        variant="secondary"
                        className={`text-xs ${DECISION_COLOR[exp.decision] ?? ""}`}
                      >
                        {exp.decision}
                      </Badge>
                    )}
                  </div>
                </div>
                {exp.primaryMetricEvent && (
                  <div className="text-sm text-muted-foreground">
                    Primary metric:{" "}
                    <span className="font-mono">
                      {exp.primaryMetricEvent}
                    </span>
                  </div>
                )}
                {(() => {
                  const gEvents = parseGuardrailEvents(exp.guardrailEvents);
                  return gEvents.length > 0 ? (
                    <div className="text-sm text-muted-foreground">
                      Guardrails:{" "}
                      {gEvents.map((evt, i) => (
                        <span key={evt}>
                          {i > 0 && ", "}
                          <span className="font-mono">{evt}</span>
                        </span>
                      ))}
                    </div>
                  ) : null;
                })()}
                {(exp.decisionSummary || exp.decisionReason) && (
                  <p className="text-sm text-muted-foreground">
                    {exp.decisionSummary ?? exp.decisionReason}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
