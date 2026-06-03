"use client";

import { updateDecisionStateAction } from "@/lib/actions";
import { getStage } from "@/lib/stages";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, Lightbulb, FlaskConical, BarChart3 } from "lucide-react";
import type { Experiment } from "@/generated/prisma";

const STAGE_FIELDS: Record<
  string,
  { fields: string[]; icon: React.ReactNode; hint: string }
> = {
  intent: {
    fields: ["goal", "intent"],
    icon: <Target className="size-4" />,
    hint: "The sandbox agent will use intent-shaping (CF-01) to help you extract a clear, measurable business goal from your idea.",
  },
  hypothesis: {
    fields: ["goal", "intent", "hypothesis", "change"],
    icon: <Lightbulb className="size-4" />,
    hint: 'The sandbox agent will use hypothesis-design (CF-02) to form a falsifiable claim: "We believe [change] will [move metric] for [audience], because [reason]."',
  },
  implementing: {
    fields: ["goal", "hypothesis", "change", "primaryMetric"],
    icon: <FlaskConical className="size-4" />,
    hint: "The sandbox agent will use reversible-exposure-control (CF-03/04) to create a feature flag, set rollout %, define targeting rules, and manage traffic exposure.",
  },
  measuring: {
    fields: [
      "goal",
      "hypothesis",
      "primaryMetric",
      "guardrails",
    ],
    icon: <BarChart3 className="size-4" />,
    hint: "The sandbox agent will use measurement-design (CF-05) + experiment-workspace to collect data, run Bayesian analysis, and frame a decision: CONTINUE, PAUSE, ROLLBACK, or INCONCLUSIVE.",
  },
  learning: {
    fields: ["goal", "hypothesis", "primaryMetric"],
    icon: <Lightbulb className="size-4" />,
    hint: "The sandbox agent will use learning-capture (CF-08) to produce a 5-part structured learning and seed the next cycle.",
  },
};

const FIELD_META: Record<
  string,
  { label: string; placeholder: string; multiline?: boolean }
> = {
  goal: { label: "Goal", placeholder: "What measurable business outcome do you want?" },
  intent: {
    label: "Intent",
    placeholder: "What are you trying to improve or learn?",
  },
  hypothesis: {
    label: "Hypothesis",
    placeholder:
      'We believe [change X] will [move metric Y in direction Z] for [audience A], because [reason R].',
    multiline: true,
  },
  change: {
    label: "Change",
    placeholder: "What is being built, gated, or measured?",
  },
  primaryMetric: {
    label: "Primary Metric",
    placeholder: "Single metric to decide with",
  },
  guardrails: {
    label: "Guardrails",
    placeholder: "Metrics that must not degrade (comma-separated)",
  },
};

export function DecisionState({ experiment }: { experiment: Experiment }) {
  const stage = getStage(experiment.stage);
  const config = STAGE_FIELDS[experiment.stage] ?? STAGE_FIELDS.intent;
  const fields = config.fields;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {config.icon}
          <CardTitle className="text-base">Decision State</CardTitle>
          <Badge variant="secondary" className={`text-xs ${stage.color}`}>
            {stage.cf} · {stage.label}
          </Badge>
        </div>
        <CardDescription className="text-xs">{config.hint}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updateDecisionStateAction} className="space-y-3">
          <input type="hidden" name="experimentId" value={experiment.id} />
          {fields.map((field) => {
            const meta = FIELD_META[field];
            if (!meta) return null;
            const value =
              (experiment[field as keyof Experiment] as string) ?? "";
            return (
              <div key={field} className="space-y-1">
                <Label htmlFor={field} className="text-xs">
                  {meta.label}
                </Label>
                {meta.multiline ? (
                  <Textarea
                    id={field}
                    name={field}
                    defaultValue={value}
                    placeholder={meta.placeholder}
                    rows={3}
                    className="text-sm"
                  />
                ) : (
                  <Input
                    id={field}
                    name={field}
                    defaultValue={value}
                    placeholder={meta.placeholder}
                    className="text-sm"
                  />
                )}
              </div>
            );
          })}
          <Button type="submit" size="sm">
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
