"use client";

import { useState } from "react";
import { RotateCcw, Save, AlertCircle } from "lucide-react";
import {
  useConnectorUrl,
  DEFAULT_CONNECTOR_URL,
  normalizeConnectorUrl,
} from "@/lib/connector-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ConnectorUrlCard() {
  const [savedUrl, setSavedUrl] = useConnectorUrl();
  const [draft, setDraft] = useState(
    savedUrl === DEFAULT_CONNECTOR_URL ? "" : savedUrl,
  );
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const isCustom = savedUrl !== DEFAULT_CONNECTOR_URL;
  const dirty =
    normalizeConnectorUrl(draft) !== (isCustom ? savedUrl : "");

  function save() {
    const normalized = normalizeConnectorUrl(draft);
    if (!normalized) {
      setSavedUrl("");
      flashSaved();
      return;
    }
    try {
      new URL(normalized);
    } catch {
      setError("Invalid URL — use http://host:port");
      return;
    }
    setSavedUrl(normalized);
    setError(null);
    flashSaved();
  }

  function reset() {
    setSavedUrl("");
    setDraft("");
    setError(null);
    flashSaved();
  }

  function flashSaved() {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder={DEFAULT_CONNECTOR_URL}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          className="font-mono text-xs"
        />
        <Button onClick={save} disabled={!dirty} className="shrink-0">
          <Save className="size-3.5" />
          Save
        </Button>
        {isCustom && (
          <Button
            variant="outline"
            onClick={reset}
            className="shrink-0"
            title="Reset to default"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        )}
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="size-3.5" />
          {error}
        </p>
      )}

      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          Currently using:{" "}
          <code className="font-mono text-foreground/80 rounded bg-foreground/10 px-1 py-0.5">
            {savedUrl}
          </code>
          {!isCustom && (
            <span className="ml-1 text-muted-foreground/70">(default)</span>
          )}
          {savedFlash && (
            <span className="ml-2 text-emerald-600 dark:text-emerald-400">
              ✓ Saved
            </span>
          )}
        </p>
        <p>
          Empty input + Save also resets to default. Accepts shorthand like{" "}
          <code className="font-mono">localhost:4100</code> — <code>http://</code>{" "}
          is added automatically.
        </p>
      </div>
    </div>
  );
}
