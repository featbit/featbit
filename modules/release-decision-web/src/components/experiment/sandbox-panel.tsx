"use client";

import { activateSandboxAction } from "@/lib/actions";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Terminal, Play, Square, RefreshCw } from "lucide-react";
import type { Experiment } from "@/generated/prisma";

const STATUS_MAP: Record<
  string,
  { label: string; variant: "secondary" | "outline" | "destructive" }
> = {
  idle: { label: "Idle", variant: "outline" },
  running: { label: "Running", variant: "secondary" },
  completed: { label: "Completed", variant: "secondary" },
  error: { label: "Error", variant: "destructive" },
};

export function SandboxPanel({ experiment }: { experiment: Experiment }) {
  const status = STATUS_MAP[experiment.sandboxStatus ?? "idle"] ?? STATUS_MAP.idle;
  const isRunning = experiment.sandboxStatus === "running";
  const canActivate = Boolean(experiment.flagKey && experiment.envSecret);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="size-4" />
            <CardTitle className="text-base">Sandbox Agent</CardTitle>
          </div>
          <Badge variant={status.variant} className="text-xs">
            {status.label}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          A remote Claude Code agent runs the release decision skills. Configure
          the feature flag first, then activate the sandbox.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!canActivate && (
          <p className="text-xs text-muted-foreground rounded-md bg-muted p-3">
            Configure the feature flag key and environment secret before
            activating the sandbox.
          </p>
        )}

        {isRunning && (
          <div className="rounded-md bg-muted p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
              </span>
              <span className="font-mono text-muted-foreground">
                {experiment.sandboxId}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              The sandbox is executing the release decision workflow. Steps and
              results will sync to this experiment automatically.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          {!isRunning ? (
            <Button
              size="sm"
              disabled={!canActivate}
              onClick={() => activateSandboxAction(experiment.id)}
            >
              <Play className="size-3" data-icon="inline-start" />
              Activate Sandbox
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" disabled>
                <RefreshCw className="size-3" data-icon="inline-start" />
                Sync
              </Button>
              <Button size="sm" variant="destructive" disabled>
                <Square className="size-3" data-icon="inline-start" />
                Stop
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
