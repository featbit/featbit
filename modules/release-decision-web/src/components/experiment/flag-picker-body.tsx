"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  authStorage,
  featureFlagService,
  projectService,
  type Environment,
  type IFeatureFlagListItem,
  type IVariation,
  type Project,
} from "@/lib/featbit-auth";
import { bindFeatbitFlagAction } from "@/lib/actions";
import { Search, Loader2, AlertCircle } from "lucide-react";

function variationsToVariantsJson(variations: IVariation[]) {
  return JSON.stringify(
    variations.map((v) => ({ key: v.name, description: v.value })),
  );
}

export function FlagPickerBody({
  active,
  experimentId,
  experimentProjectKey,
  experimentEnvId,
  onPicked,
  onCancel,
}: {
  /** Pause data loading when body is mounted but hidden (e.g., inactive drawer tab). */
  active: boolean;
  experimentId: string;
  experimentProjectKey: string | null;
  experimentEnvId: string | null;
  onPicked: () => void;
  onCancel?: () => void;
}) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [projectKey, setProjectKey] = useState<string | null>(experimentProjectKey);
  const [envId, setEnvId] = useState<string | null>(experimentEnvId);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [flags, setFlags] = useState<IFeatureFlagListItem[]>([]);
  const [totalFlags, setTotalFlags] = useState(0);
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [flagsError, setFlagsError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(1);
  const pageSize = 20;

  const [submitting, setSubmitting] = useState<string | null>(null);

  // ─── Load projects once when body becomes active ────────────────────
  useEffect(() => {
    if (!active || projects !== null) return;
    let cancelled = false;
    projectService
      .getProjects()
      .then((list) => {
        if (cancelled) return;
        setProjects(list);
        const fallback = authStorage.getProjectEnv();
        const resolvedKey =
          experimentProjectKey ||
          fallback?.projectKey ||
          list[0]?.key ||
          null;
        setProjectKey((prev) => prev ?? resolvedKey);
      })
      .catch((e: Error) => {
        if (!cancelled) setProjectsError(e.message || "Failed to load projects");
      });
    return () => {
      cancelled = true;
    };
  }, [active, projects, experimentProjectKey]);

  const currentProject = useMemo(
    () => projects?.find((p) => p.key === projectKey) ?? null,
    [projects, projectKey],
  );
  const envs: Environment[] = currentProject?.environments ?? [];

  useEffect(() => {
    if (!currentProject) return;
    const stillValid = envs.some((e) => e.id === envId);
    if (stillValid) return;
    const resolved =
      (experimentEnvId && envs.find((e) => e.id === experimentEnvId)?.id) ||
      authStorage.getProjectEnv()?.envId ||
      envs[0]?.id ||
      null;
    setEnvId(resolved);
  }, [currentProject, envs, envId, experimentEnvId]);

  const loadFlags = useCallback(
    async (targetEnvId: string, name: string, page: number) => {
      setFlagsLoading(true);
      setFlagsError(null);
      try {
        const res = await featureFlagService.list(targetEnvId, {
          name,
          pageIndex: page,
          pageSize,
          isArchived: false,
        });
        setFlags(res.items);
        setTotalFlags(res.totalCount);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setFlagsError(msg);
        setFlags([]);
        setTotalFlags(0);
      } finally {
        setFlagsLoading(false);
      }
    },
    [],
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!active || !envId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadFlags(envId, search, pageIndex);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [active, envId, search, pageIndex, loadFlags]);

  useEffect(() => {
    setPageIndex(1);
  }, [envId, search]);

  async function handlePick(flag: IFeatureFlagListItem) {
    if (!envId || !projectKey) return;
    setSubmitting(flag.key);
    try {
      const detail = await featureFlagService.getByKey(envId, flag.key);
      const variants = variationsToVariantsJson(detail.variations);

      const fd = new FormData();
      fd.append("experimentId", experimentId);
      fd.append("flagKey", flag.key);
      fd.append("featbitEnvId", envId);
      fd.append("featbitProjectKey", projectKey);
      fd.append("variants", variants);
      await bindFeatbitFlagAction(fd);
      onPicked();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setFlagsError(`Couldn't bind flag: ${msg}`);
    } finally {
      setSubmitting(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalFlags / pageSize));

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* ── Project / Env scope bar ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">
            Project
          </label>
          <select
            className="w-full h-9 rounded-md border bg-background px-2 text-sm font-mono"
            value={projectKey ?? ""}
            onChange={(e) => setProjectKey(e.target.value || null)}
            disabled={!projects}
          >
            {!projects && <option>Loading…</option>}
            {projects?.map((p) => (
              <option key={p.id} value={p.key}>
                {p.name} ({p.key})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">
            Environment
          </label>
          <select
            className="w-full h-9 rounded-md border bg-background px-2 text-sm font-mono"
            value={envId ?? ""}
            onChange={(e) => setEnvId(e.target.value || null)}
            disabled={!currentProject}
          >
            {!currentProject && <option>—</option>}
            {envs.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {projectsError && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="size-3" />
          {projectsError}
        </p>
      )}

      {/* ── Search ── */}
      <div className="relative">
        <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search flags by name or key"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* ── Flag list ── */}
      <div className="flex-1 overflow-y-auto border rounded-md min-h-[200px]">
        {flagsLoading && (
          <div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin mr-2" />
            Loading flags…
          </div>
        )}
        {flagsError && !flagsLoading && (
          <div className="flex items-start gap-2 p-4 text-xs text-destructive">
            <AlertCircle className="size-3.5 mt-0.5" />
            <span>{flagsError}</span>
          </div>
        )}
        {!flagsLoading && !flagsError && flags.length === 0 && (
          <div className="p-8 text-center text-xs text-muted-foreground italic">
            No flags found in this environment. Create one in FeatBit first.
          </div>
        )}
        {!flagsLoading && !flagsError && flags.length > 0 && (
          <ul className="divide-y">
            {flags.map((f) => {
              const isSubmitting = submitting === f.key;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(f)}
                    disabled={Boolean(submitting)}
                    className="w-full text-left px-4 py-3 hover:bg-muted/40 focus:bg-muted/40 focus:outline-none disabled:opacity-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-sm font-medium">{f.key}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          f.isEnabled
                            ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                            : "border-muted-foreground/30 text-muted-foreground"
                        }`}
                      >
                        {f.isEnabled ? "ON" : "OFF"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {f.variationType}
                      </Badge>
                      {isSubmitting && (
                        <Loader2 className="size-3 animate-spin ml-auto text-muted-foreground" />
                      )}
                    </div>
                    {f.name !== f.key && (
                      <div className="text-xs text-muted-foreground truncate">
                        {f.name}
                      </div>
                    )}
                    {f.description && (
                      <div className="text-[11px] text-muted-foreground/70 truncate">
                        {f.description}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Pagination + actions footer ── */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {totalFlags > 0 && (
            <>
              Page {pageIndex} of {totalPages} · {totalFlags} flags
            </>
          )}
        </span>
        <div className="flex gap-1.5 items-center">
          {totalFlags > pageSize && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={pageIndex <= 1}
                onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pageIndex >= totalPages}
                onClick={() => setPageIndex((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </>
          )}
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
