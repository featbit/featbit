import {
  ArrowLeftRight,
  Code,
  ExternalLink,
  Flag,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { featureFlagTargetingUrl } from "@/lib/feature-flag-link";
import type { Experiment, ExperimentRun } from "@/lib/release-decision-types";
import {
  parseVariantIdentities,
  VariantIdentityInline,
} from "./variant-identity";

export function FlagIntegrationHeader({
  experiment,
  experimentRuns,
  onChangeFlag,
}: {
  experiment: Experiment;
  experimentRuns: ExperimentRun[];
  onChangeFlag: () => void;
}) {
  const flagKey = experiment.flagKey;
  const variants = parseVariantIdentities(experiment.variants);
  const usedInRuns = new Set<string>();

  for (const run of experimentRuns) {
    if (run.controlVariant) {
      run.controlVariant
        .split("|")
        .forEach((variant) => usedInRuns.add(variant.trim()));
    }
    if (run.treatmentVariant) {
      run.treatmentVariant
        .split("|")
        .forEach((variant) => usedInRuns.add(variant.trim()));
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Code className="size-3.5" />
        <h3 className="rd-heading-label">Flag Integration & Rollout</h3>
      </div>

      <div className="flex min-h-10 flex-wrap items-center gap-2.5 rounded-md border bg-background px-3 py-2.5">
        {flagKey ? (
          <>
            <a
              href={featureFlagTargetingUrl(flagKey)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex shrink-0 items-center gap-1.5 text-left underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              title={`Open ${flagKey} targeting in FeatBit`}
              aria-label={`Open ${flagKey} targeting in FeatBit`}
            >
              <Flag className="size-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
              <span className="font-mono text-sm font-bold text-foreground transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {flagKey}
              </span>
              <ExternalLink className="size-3 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-blue-600" />
            </a>

            {variants.length > 0 ? (
              <span className="shrink-0 select-none text-muted-foreground/30">·</span>
            ) : null}

            <div className="grid min-w-0 flex-1 gap-1">
              {variants.map(({ key, description, name }) => {
                const isControl = description?.toLowerCase().includes("control");
                const isUsed = usedInRuns.has(key);

                return (
                  <div
                    key={key}
                    className={`inline-flex min-w-0 items-center gap-1.5 rounded border px-2 py-1 text-xs ${
                      isControl
                        ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                        : isUsed
                          ? "border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-300"
                          : "border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    <GitBranch className="mr-1 size-3" />
                    <VariantIdentityInline
                      token={key}
                      variants={variants}
                      role={name || description ? undefined : "Variant"}
                      className="min-w-0"
                    />
                  </div>
                );
              })}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={onChangeFlag}
            >
              <ArrowLeftRight className="size-3.5" />
              Change feature flag
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onChangeFlag}
          >
            <Flag className="size-3.5" />
            Select feature flag
          </Button>
        )}
      </div>
    </section>
  );
}
