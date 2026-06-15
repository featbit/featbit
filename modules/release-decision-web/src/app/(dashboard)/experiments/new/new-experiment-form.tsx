"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/featbit-auth/auth-context";
import { createExperiment } from "@/lib/release-decision-client-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

export function NewExperimentForm() {
  const { currentProject, currentEnvironment } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const projectKey = currentProject?.key ?? "";
  const projectName = currentProject?.name ?? "(no project selected)";
  const envName = currentEnvironment?.name ?? "";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const form = new FormData(event.currentTarget);
    const name = (form.get("name") as string | null)?.trim();
    const description = (form.get("description") as string | null)?.trim();

    if (!name) {
      setError("Experiment name is required");
      setSaving(false);
      return;
    }

    try {
      const experiment = await createExperiment({
        name,
        description: description || null,
        featbitProjectKey: projectKey || null,
      });
      router.push(`/${experiment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create experiment.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Experiment Name</Label>
        <Input
          id="name"
          name="name"
          placeholder="e.g. Onboarding tooltip experiment"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>FeatBit Project</Label>
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">{projectName}</span>
          {projectKey && (
            <span className="font-mono text-xs text-muted-foreground">({projectKey})</span>
          )}
          {envName && (
            <span className="ml-auto text-xs text-muted-foreground">env: {envName}</span>
          )}
        </div>
        <input type="hidden" name="featbitProjectKey" value={projectKey} />
        <p className="text-xs text-muted-foreground">
          Determined by the workspace you&apos;re currently in. Switch workspace from the top bar to change.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="What are you trying to learn or improve?"
          rows={3}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={!projectKey || saving}>
          {saving ? "Creating..." : "Create Experiment"}
        </Button>
        <Button nativeButton={false} variant="outline" render={<Link href="/" />}>
          Cancel
        </Button>
      </div>
      {error && (
        <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
