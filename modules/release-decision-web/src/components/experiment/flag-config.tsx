"use client";

import { useCallback, useEffect, useState } from "react";
import { updateFlagConfigAction } from "@/lib/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Flag,
  Pencil,
  Eye,
  EyeOff,
  ExternalLink,
  Code,
  GitBranch,
  Plus,
  X,
  KeyRound,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { Experiment, ExperimentRun } from "@/generated/prisma";
import {
  projectService,
  SecretType,
  type EnvSecret,
} from "@/lib/featbit-auth";

/* ── Types ── */
type VariantRow = { key: string; description: string };

/* ── Parse stored variants to row array ── */
function parseVariantsToRows(variants: string | null | undefined): VariantRow[] {
  if (!variants) return [];
  const raw = variants.trim();
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as { key?: string; name?: string; description?: string }[];
      return parsed.map((v) => ({ key: v.key ?? v.name ?? "", description: v.description ?? "" }));
    } catch { /* fall through */ }
  }
  // Pipe-separated legacy format: "standard (control)|streamlined (treatment)"
  return raw.split("|").map((s) => {
    const match = s.trim().match(/^(.+?)\s*\((.+)\)\s*$/);
    return match
      ? { key: match[1].trim(), description: match[2].trim() }
      : { key: s.trim(), description: "" };
  });
}

/* ── Password input with visibility toggle ── */
function SecretInput({
  id,
  name,
  defaultValue,
  placeholder,
}: {
  id: string;
  name: string;
  defaultValue: string;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="text-sm font-mono pr-9"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
      >
        {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </div>
  );
}

/* ── Mask helper for read-only display ── */
function mask(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 6) return "••••••";
  return value.slice(0, 3) + "••••" + value.slice(-3);
}

/* ── Build FeatBit targeting URL ── */
function buildFeatBitUrl(experiment: Experiment) {
  const base = (experiment.flagServerUrl ?? "https://app.featbit.co").replace(/\/+$/, "");
  const flagKey = experiment.flagKey;
  const envId = experiment.featbitEnvId;
  if (!flagKey || !envId) return null;
  return `${base}/en/feature-flags/${encodeURIComponent(flagKey)}/targeting?envId=${encodeURIComponent(envId)}`;
}

/* ── Dynamic variations editor ── */
function VariationsEditor({ initialRows }: { initialRows: VariantRow[] }) {
  const [rows, setRows] = useState<VariantRow[]>(
    initialRows.length > 0 ? initialRows : [{ key: "", description: "" }]
  );

  function update(i: number, field: keyof VariantRow, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function add() {
    setRows((prev) => [...prev, { key: "", description: "" }]);
  }

  function remove(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {/* Hidden input carries the JSON to the server action */}
      <input type="hidden" name="variants" value={JSON.stringify(rows)} />

      <div className="grid grid-cols-[1fr_1.5fr_auto] gap-x-2 gap-y-1.5 items-center">
        <span className="text-[10px] font-medium text-muted-foreground uppercase">Key</span>
        <span className="text-[10px] font-medium text-muted-foreground uppercase">Description</span>
        <span />
        {rows.map((row, i) => (
          <>
            <Input
              key={`k-${i}`}
              value={row.key}
              onChange={(e) => update(i, "key", e.target.value)}
              placeholder="e.g. standard"
              className="text-xs font-mono h-7"
            />
            <Input
              key={`d-${i}`}
              value={row.description}
              onChange={(e) => update(i, "description", e.target.value)}
              placeholder="e.g. control"
              className="text-xs h-7"
            />
            <button
              key={`r-${i}`}
              type="button"
              onClick={() => remove(i)}
              className="text-muted-foreground/50 hover:text-destructive transition-colors"
              title="Remove"
            >
              <X className="size-3.5" />
            </button>
          </>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="size-3" />
        Add variation
      </button>
    </div>
  );
}

/* ── Edit form (mounts fresh each time editing=true) ── */
function FlagEditForm({
  experiment,
  onDone,
  onCancel,
}: {
  experiment: Experiment;
  onDone: () => void;
  onCancel: () => void;
}) {
  const initialRows = parseVariantsToRows(experiment.variants);

  return (
    <form
      action={async (formData) => {
        await updateFlagConfigAction(formData);
        onDone();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="experimentId" value={experiment.id} />

      <div className="space-y-1">
        <Label htmlFor="flagKey" className="text-xs">Flag Key</Label>
        <Input
          id="flagKey"
          name="flagKey"
          defaultValue={experiment.flagKey ?? ""}
          placeholder="e.g. checkout-flow-ab"
          className="text-sm font-mono"
        />
      </div>

      <fieldset className="space-y-1.5 rounded-lg border px-3 pb-3 pt-2">
        <legend className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Variations
        </legend>
        <VariationsEditor initialRows={initialRows} />
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="featbitProjectKey" className="text-xs">FeatBit Project</Label>
          <Input
            id="featbitProjectKey"
            name="featbitProjectKey"
            defaultValue={experiment.featbitProjectKey ?? ""}
            placeholder="e.g. my-project"
            className="text-sm font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="featbitEnvId" className="text-xs">Environment ID</Label>
          <Input
            id="featbitEnvId"
            name="featbitEnvId"
            defaultValue={experiment.featbitEnvId ?? ""}
            placeholder="e.g. env-uuid"
            className="text-sm font-mono"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="flagServerUrl" className="text-xs">Server URL</Label>
        <Input
          id="flagServerUrl"
          name="flagServerUrl"
          defaultValue={experiment.flagServerUrl ?? ""}
          placeholder="https://app.featbit.co"
          className="text-sm font-mono"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="envSecret" className="text-xs">Env Secret</Label>
        <SecretInput
          id="envSecret"
          name="envSecret"
          defaultValue={experiment.envSecret ?? ""}
          placeholder="FeatBit environment secret"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="accessToken" className="text-xs">Access Token</Label>
        <SecretInput
          id="accessToken"
          name="accessToken"
          defaultValue={experiment.accessToken ?? ""}
          placeholder="FeatBit API access token"
        />
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">Save</Button>
      </DialogFooter>
    </form>
  );
}

/* ── Read-only row ── */
function ReadOnlyRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] font-medium text-muted-foreground uppercase w-28 shrink-0">
        {label}
      </span>
      <span className={`text-xs ${mono ? "font-mono" : ""} ${value ? "" : "italic text-muted-foreground/50"}`}>
        {value || "Not set"}
      </span>
    </div>
  );
}

/* ── SDK Credentials popup: live secrets from FeatBit + editable server URL ── */
function SdkCredentialsPopup({
  experiment,
  open,
  onOpenChange,
}: {
  experiment: Experiment;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [secrets, setSecrets] = useState<EnvSecret[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState(experiment.flagServerUrl ?? "");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!experiment.featbitEnvId) {
      setError("No FeatBit environment bound. Connect a flag first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const projects = await projectService.getProjects();
      let env = null;
      for (const p of projects) {
        env = p.environments?.find((e) => e.id === experiment.featbitEnvId);
        if (env) break;
      }
      if (!env) {
        setError(
          "Couldn't find this environment in FeatBit. You may have lost access.",
        );
        setSecrets([]);
      } else {
        setSecrets(env.secrets ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [experiment.featbitEnvId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (open) setServerUrl(experiment.flagServerUrl ?? "");
  }, [open, experiment.flagServerUrl]);

  const serverSecret = secrets?.find((s) => s.type === SecretType.Server);
  const clientSecret = secrets?.find((s) => s.type === SecretType.Client);

  async function saveServerUrlAndSyncSecret() {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("experimentId", experiment.id);
      fd.append("flagKey", experiment.flagKey ?? "");
      fd.append("flagServerUrl", serverUrl.trim());
      // Sync the server env secret into the experiment so the sandbox runner
      // can evaluate flags. Don't touch variants or other fields.
      if (serverSecret?.value) fd.append("envSecret", serverSecret.value);
      if (experiment.accessToken) fd.append("accessToken", experiment.accessToken);
      if (experiment.featbitProjectKey)
        fd.append("featbitProjectKey", experiment.featbitProjectKey);
      if (experiment.featbitEnvId)
        fd.append("featbitEnvId", experiment.featbitEnvId);
      await updateFlagConfigAction(fd);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <KeyRound className="size-4" />
            SDK Credentials
          </DialogTitle>
          <DialogDescription className="text-xs">
            Credentials for FeatBit SDKs / API to evaluate this flag. Pulled
            live from FeatBit — regenerate them in FeatBit if compromised.
          </DialogDescription>
        </DialogHeader>

        {loading && !secrets ? (
          <div className="flex items-center gap-2 justify-center py-8 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading from FeatBit…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-6 text-sm">
            <AlertCircle className="size-6 text-destructive" />
            <p className="text-destructive text-center text-xs max-w-md">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="size-3.5 mr-1.5" /> Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="serverUrl" className="text-xs">
                Server address
              </Label>
              <Input
                id="serverUrl"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://app-eval.featbit.co"
                className="text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Used by SDKs or API for flag evaluation.
              </p>
            </div>

            <SecretRow label="Server env secret" secret={serverSecret} />
            <SecretRow label="Client env secret" secret={clientSecret} />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            size="sm"
            disabled={saving || !serverSecret}
            onClick={saveServerUrlAndSyncSecret}
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
            ) : null}
            Sync to experiment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Read-only secret row with copy button ── */
function SecretRow({ label, secret }: { label: string; secret: EnvSecret | undefined }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!secret?.value) return;
    try {
      await navigator.clipboard.writeText(secret.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked — no-op */
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {secret ? (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              readOnly
              type={visible ? "text" : "password"}
              value={secret.value}
              className="text-sm font-mono pr-9"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copy}
            className="shrink-0 gap-1.5"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          Not defined in this environment.
        </p>
      )}
    </div>
  );
}

/* ── Main flag + variants section (summary view only) ── */
export function FlagIntegrationHeader({
  experiment,
  experimentRuns,
  onEdit,
}: {
  experiment: Experiment;
  experimentRuns: ExperimentRun[];
  onEdit: () => void;
}) {
  const isConfigured = Boolean(experiment.flagKey);
  const featbitUrl = buildFeatBitUrl(experiment);

  const allVariants = parseVariantsToRows(experiment.variants);

  // Variants used in any run (for colour-coding)
  const usedInRuns = new Set<string>();
  for (const run of experimentRuns) {
    if (run.controlVariant) run.controlVariant.split("|").forEach((v) => usedInRuns.add(v.trim()));
    if (run.treatmentVariant) run.treatmentVariant.split("|").forEach((v) => usedInRuns.add(v.trim()));
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <Code className="size-3.5" />
        <span>Flag Integration & Rollout</span>
        <button
          type="button"
          onClick={onEdit}
          className="ml-1 text-muted-foreground/50 hover:text-foreground transition-colors"
          title="Edit feature flag"
        >
          <Pencil className="size-3" />
        </button>
      </div>

      <div className="rounded-md border bg-background px-3 py-2.5 flex items-center gap-2.5 flex-wrap min-h-[2.5rem]">
        {isConfigured ? (
          <>
            {/* Flag key */}
            <button
              type="button"
              onClick={onEdit}
              className="group flex items-center gap-1.5 cursor-pointer text-left shrink-0"
            >
              <Flag className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="font-mono text-sm font-bold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {experiment.flagKey}
              </span>
              {featbitUrl && (
                <ExternalLink className="size-3 text-muted-foreground/50 group-hover:text-blue-600 transition-colors shrink-0" />
              )}
            </button>

            {/* Divider */}
            {allVariants.length > 0 && (
              <span className="text-muted-foreground/30 select-none shrink-0">·</span>
            )}

            {/* Variations inline */}
            <div className="flex flex-wrap gap-1 flex-1">
              {allVariants.map(({ key, description }) => {
                const isControl = description?.toLowerCase().includes("control");
                const isUsed = usedInRuns.has(key);
                return (
                  <Badge
                    key={key}
                    variant="outline"
                    className={`font-mono text-xs px-2 py-0 ${
                      isControl
                        ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                        : isUsed
                        ? "border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-300"
                        : "border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    <GitBranch className="size-3 mr-1" />
                    {key}
                    {description && (
                      <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                        ({description})
                      </span>
                    )}
                  </Badge>
                );
              })}
            </div>

            {/* Edit link — far right */}
            <button
              type="button"
              onClick={onEdit}
              className="ml-auto shrink-0 flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <Pencil className="size-3" />
              Edit
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 text-sm text-muted-foreground/60 italic hover:text-muted-foreground cursor-pointer"
          >
            Not configured — click to set up
            <Pencil className="size-3" />
          </button>
        )}
      </div>
    </section>
  );
}

/* Re-export for the stage-content-panel to render the inline config panel +
 * SDK creds dialog. Parent controls open/close state. */
export { FlagIntegrationPanel } from "./flag-integration-drawer";
export { SdkCredentialsPopup };

/* ── Legacy export ── */
export function FlagConfig({ experiment }: { experiment: Experiment }) {
  return (
    <FlagIntegrationHeader
      experiment={experiment}
      experimentRuns={[]}
      onEdit={() => {}}
    />
  );
}
