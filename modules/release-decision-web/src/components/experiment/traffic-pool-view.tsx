"use client";

import { useMemo } from "react";
import type { ExperimentRun } from "@/generated/prisma";

/* ── Palette ── */
const PALETTE = [
  { bar: "bg-blue-500",   light: "bg-blue-50 dark:bg-blue-950/40",    text: "text-blue-700 dark:text-blue-300",    dot: "bg-blue-500"   },
  { bar: "bg-violet-500", light: "bg-violet-50 dark:bg-violet-950/40", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  { bar: "bg-emerald-500",light: "bg-emerald-50 dark:bg-emerald-950/40",text:"text-emerald-700 dark:text-emerald-300",dot:"bg-emerald-500"},
  { bar: "bg-amber-500",  light: "bg-amber-50 dark:bg-amber-950/40",   text: "text-amber-700 dark:text-amber-300",   dot: "bg-amber-500"  },
  { bar: "bg-rose-500",   light: "bg-rose-50 dark:bg-rose-950/40",     text: "text-rose-700 dark:text-rose-300",     dot: "bg-rose-500"   },
] as const;

function palette(idx: number) {
  return PALETTE[idx % PALETTE.length];
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "?";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type ExpWithColor = ExperimentRun & { colorIdx: number };

/* ── Top-level component ── */
export function TrafficPoolView({ experimentRuns, isSequential }: { experimentRuns: ExperimentRun[]; isSequential?: boolean }) {
  const { layers, colorMap } = useMemo(() => {
    const colorMap = new Map<string, number>();
    experimentRuns.forEach((e, i) => colorMap.set(e.id, i));

    // Group by layerId (null = "default")
    const layerMap = new Map<string, ExperimentRun[]>();
    for (const exp of experimentRuns) {
      const key = (exp.layerId as string | null) ?? "__default__";
      if (!layerMap.has(key)) layerMap.set(key, []);
      layerMap.get(key)!.push(exp);
    }

    const layers = Array.from(layerMap.entries()).map(([layerId, exps]) => ({
      layerId: layerId === "__default__" ? null : layerId,
      experimentRuns: exps.map(e => ({ ...e, colorIdx: colorMap.get(e.id)! })),
    }));

    return { layers, colorMap };
  }, [experimentRuns]);

  // Detect sequential: all experiment runs use the full bucket [0, 100)
  const isAllDefault = experimentRuns.every(
    e => (e.trafficOffset ?? 0) === 0 && (e.trafficPercent ?? 100) >= 100
  );

  const withDates = experimentRuns.filter(e => e.observationStart);

  if (experimentRuns.length === 0) return null;

  return (
    <div className="rounded-md border divide-y">
      {/* Bucket section */}
      {!isAllDefault && (
        <div className="px-3 py-2.5 space-y-2.5">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Hash-space Allocation
          </div>
          {layers.map((layer, i) => (
            <div key={i} className="space-y-1">
              {layers.length > 1 && (
                <div className="text-[10px] text-muted-foreground">
                  Layer: <span className="font-mono">{layer.layerId ?? "default"}</span>
                </div>
              )}
              <BucketBar experimentRuns={layer.experimentRuns} />
            </div>
          ))}
          {/* Legend */}
          <ExpLegend experimentRuns={experimentRuns.map(e => ({ ...e, colorIdx: colorMap.get(e.id)! }))} />
        </div>
      )}

      {/* Timeline section */}
      {withDates.length > 0 && (
        <div className="px-3 py-2.5 space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Observation Windows
          </div>
          <Timeline experimentRuns={experimentRuns.map(e => ({ ...e, colorIdx: colorMap.get(e.id)! }))} isSequential={isSequential} />
        </div>
      )}

      {/* If all default and no dates: show a plain note */}
      {isAllDefault && withDates.length === 0 && (
        <div className="px-3 py-2.5">
          <ExpLegend experimentRuns={experimentRuns.map(e => ({ ...e, colorIdx: colorMap.get(e.id)! }))} />
          <p className="text-[10px] text-muted-foreground/50 italic mt-1.5">
            All experiment runs use the full traffic pool — set observation windows to visualize the timeline.
          </p>
        </div>
      )}

      {isAllDefault && withDates.length > 0 && (
        <div className="px-3 py-2.5">
          <ExpLegend experimentRuns={experimentRuns.map(e => ({ ...e, colorIdx: colorMap.get(e.id)! }))} />
        </div>
      )}
    </div>
  );
}

/* ── Bucket bar ── */
type Segment =
  | { type: "exp"; exp: ExpWithColor; start: number; end: number }
  | { type: "gap"; start: number; end: number };

function BucketBar({ experimentRuns }: { experimentRuns: ExpWithColor[] }) {
  const sorted = [...experimentRuns].sort(
    (a, b) => (a.trafficOffset ?? 0) - (b.trafficOffset ?? 0)
  );

  const segments: Segment[] = [];
  let cursor = 0;
  for (const exp of sorted) {
    const start = exp.trafficOffset ?? 0;
    const end = Math.min(start + (exp.trafficPercent ?? 100), 100);
    if (start > cursor) segments.push({ type: "gap", start: cursor, end: start });
    segments.push({ type: "exp", exp, start, end });
    cursor = end;
  }
  if (cursor < 100) segments.push({ type: "gap", start: cursor, end: 100 });

  return (
    <div>
      {/* Bar */}
      <div className="relative h-9 w-full flex rounded overflow-hidden border bg-muted/30">
        {segments.map((seg, i) => {
          const w = seg.end - seg.start;
          if (seg.type === "gap") {
            return (
              <div
                key={i}
                style={{ width: `${w}%` }}
                className="flex items-center justify-center border-r border-dashed border-muted-foreground/20 last:border-r-0"
              >
                {w >= 8 && (
                  <span className="text-[9px] text-muted-foreground/30">unallocated</span>
                )}
              </div>
            );
          }
          const c = palette(seg.exp.colorIdx);
          const isBandit = seg.exp.method === "bandit";
          return (
            <div
              key={i}
              style={{ width: `${w}%` }}
              className={`${c.light} border-r last:border-r-0 border-muted-foreground/20 relative flex flex-col items-center justify-center overflow-hidden min-w-0`}
            >
              {/* 50/50 divider (A/B) or dynamic indicator (bandit) */}
              {isBandit ? (
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full h-px border-t border-dashed border-muted-foreground/30" />
                </div>
              ) : (
                <div className="absolute inset-y-0 left-1/2 w-px bg-muted-foreground/20" />
              )}
              <span className={`text-[9px] font-mono font-semibold ${c.text} relative z-10 truncate px-0.5`}>
                {w >= 12 ? seg.exp.slug : ""}
              </span>
              <span className={`text-[8px] ${c.text} opacity-60 relative z-10`}>
                [{seg.start}, {seg.end})
              </span>
            </div>
          );
        })}
      </div>
      {/* Tick labels */}
      <div className="flex justify-between text-[9px] text-muted-foreground/40 mt-0.5 select-none">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}

/* ── Timeline / Gantt ── */
function Timeline({ experimentRuns, isSequential }: { experimentRuns: ExpWithColor[]; isSequential?: boolean }) {
  const withDates = experimentRuns.filter(e => e.observationStart);
  if (withDates.length === 0) return null;

  const starts = withDates.map(e => new Date(e.observationStart!).getTime());
  const ends = withDates.map(e =>
    e.observationEnd ? new Date(e.observationEnd).getTime() : Date.now()
  );
  const minTime = Math.min(...starts);
  const maxTime = Math.max(...ends);
  const totalMs = Math.max(maxTime - minTime, 1);

  return (
    <div className="space-y-1">
      {/* X-axis */}
      <div className="flex pl-24 pr-0">
        <div className="flex-1 flex justify-between text-[9px] text-muted-foreground/40 select-none">
          <span>{fmtDate(new Date(minTime))}</span>
          <span>{fmtDate(new Date(maxTime))}</span>
        </div>
      </div>
      {/* Bars */}
      {withDates.map((exp, i) => {
        const start = new Date(exp.observationStart!).getTime();
        const end = exp.observationEnd
          ? new Date(exp.observationEnd).getTime()
          : Date.now();
        const leftPct = ((start - minTime) / totalMs) * 100;
        const widthPct = ((end - start) / totalMs) * 100;
        const isOngoing = !exp.observationEnd;
        const c = palette(exp.colorIdx);
        const phaseLabel = isSequential ? `Phase ${i + 1}` : `#${i + 1}`;

        return (
          <div key={exp.id} className="flex items-center gap-2">
            <div className="w-28 shrink-0 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-medium text-muted-foreground/60 shrink-0">{phaseLabel}</span>
                <span className="text-[10px] font-mono text-muted-foreground truncate">
                  {exp.slug}
                </span>
              </div>
            </div>
            <div className="relative flex-1 h-5">
              <div className="absolute inset-0 bg-muted/20 rounded" />
              <div
                className={`absolute inset-y-0 ${c.bar} rounded opacity-75 ${isOngoing ? "rounded-r-none" : ""}`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              >
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-medium text-white/90 truncate px-1">
                  {widthPct > 15 ? `${fmtDate(exp.observationStart)} → ${isOngoing ? "ongoing" : fmtDate(exp.observationEnd)}` : ""}
                </span>
              </div>
              {isOngoing && (
                <div
                  className={`absolute inset-y-0 w-1.5 ${c.bar} opacity-40`}
                  style={{ left: `calc(${leftPct + widthPct}% - 2px)` }}
                />
              )}
            </div>
            <span className="text-[9px] text-muted-foreground shrink-0 tabular-nums">
              {fmtDate(exp.observationStart)} →{" "}
              {isOngoing ? "ongoing" : fmtDate(exp.observationEnd)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Experiment legend ── */
function ExpLegend({ experimentRuns }: { experimentRuns: ExpWithColor[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {experimentRuns.map(exp => {
        const c = palette(exp.colorIdx);
        return (
          <div key={exp.id} className="flex items-center gap-1.5 text-[10px]">
            <div className={`size-2 rounded-sm shrink-0 ${c.dot}`} />
            <span className="font-mono font-medium">{exp.slug}</span>
            {(exp.controlVariant || exp.treatmentVariant) && (
              <span className="text-muted-foreground">
                {exp.controlVariant ?? "—"} / {exp.treatmentVariant ?? "—"}
              </span>
            )}
            {exp.method === "bandit" && (
              <span className="text-amber-600 dark:text-amber-400">(bandit)</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
