"use client";

import { useState } from "react";
import { Database, ClipboardPaste, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/**
 * Project-level data source step in the Expert experiment setup wizard.
 *
 * Customer-managed endpoints were a Next.js DB-backed feature. The FeatBit
 * integration path now keeps experiment data in FeatBit API and reads metrics
 * through the FeatBit stats/query endpoint.
 */

export type DataSourceMode =
  | "featbit-managed"
  | "manual"
  | "external-text";

export interface CustomerEndpointConfigA {
  providerId: string;
  path: string;
  staticParams?: Record<string, unknown>;
}

const MODE_OPTIONS: {
  key: DataSourceMode;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    key: "featbit-managed",
    label: "FeatBit API",
    desc: "Read experiment exposures and metrics from FeatBit API stats/query.",
    icon: Database,
  },
  {
    key: "manual",
    label: "Paste manually",
    desc: "Enter per-variant totals in the Primary metric / Guardrails steps.",
    icon: ClipboardPaste,
  },
  {
    key: "external-text",
    label: "External / other",
    desc: "Describe where data will come from. No live fetch; record only.",
    icon: ExternalLink,
  },
];

export function DataSourceStepContent({
  initialMode,
  initialExternalNote,
}: {
  projectKey: string | null;
  initialMode: DataSourceMode;
  initialCustomerConfig: CustomerEndpointConfigA | null;
  initialExternalNote: string;
}) {
  const normalizedInitialMode: DataSourceMode =
    initialMode === "manual" || initialMode === "external-text"
      ? initialMode
      : "featbit-managed";

  const [mode, setMode] = useState<DataSourceMode>(normalizedInitialMode);
  const [externalNote, setExternalNote] = useState<string>(initialExternalNote);

  return (
    <div className="space-y-3">
      <input type="hidden" name="dataSourceMode" value={mode} />
      <input type="hidden" name="customerEndpointConfig" value="" />
      <input type="hidden" name="externalNote" value={externalNote} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {MODE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = mode === opt.key;
          return (
            <button
              type="button"
              key={opt.key}
              onClick={() => setMode(opt.key)}
              className={cn(
                "rounded-md border px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-foreground bg-foreground/5"
                  : "border-border hover:bg-muted/40",
              )}
            >
              <div className="flex items-start gap-2">
                <Icon className={cn("size-4 mt-0.5 shrink-0", active ? "text-foreground" : "text-muted-foreground")} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                    {opt.desc}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {mode === "featbit-managed" && (
        <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
          Analysis will call FeatBit API for experiment stats. No Next.js database table is used for metric reads.
        </div>
      )}

      {mode === "manual" && (
        <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
          Manual mode skips live metric reads. Enter the sufficient statistics in the metric steps.
        </div>
      )}

      {mode === "external-text" && (
        <div className="rounded-md border bg-muted/20 p-3 space-y-2">
          <Label htmlFor="ds-external-note" className="text-xs">External data notes</Label>
          <Textarea
            id="ds-external-note"
            value={externalNote}
            onChange={(e) => setExternalNote(e.target.value)}
            rows={3}
            placeholder="Where will this experiment's evidence come from?"
            className="text-sm resize-none"
          />
        </div>
      )}
    </div>
  );
}
