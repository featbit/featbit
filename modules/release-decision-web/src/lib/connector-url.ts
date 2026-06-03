"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * URL of the local Claude Code connector. Default is the port-3100 loopback
 * that `npx @featbit/experimentation-claude-code-connector` listens on, but
 * users can override (for example when 3100 is already taken on their
 * machine and they start the connector with `PORT=4100`).
 *
 * Per-browser (localStorage), since the web app is multi-tenant.
 */
export const DEFAULT_CONNECTOR_URL = "http://127.0.0.1:3100";

const STORAGE_KEY = "featbit:connector-url";
const URL_CHANGE_EVENT = "featbit:connector-url-change";

function isValidUrl(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Normalise a user-typed value: trim, prepend `http://` if no scheme. Accepts
 * `localhost:4100`, `127.0.0.1:4100`, `http://...`, `https://...`. Returns
 * empty string for empty input (caller treats that as "reset to default").
 */
export function normalizeConnectorUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return trimmed;
}

export function readConnectorUrl(): string {
  if (typeof window === "undefined") return DEFAULT_CONNECTOR_URL;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return isValidUrl(raw) ? raw : DEFAULT_CONNECTOR_URL;
}

/**
 * Persist a new URL. Empty string clears the override (falls back to default).
 * Invalid URLs are rejected silently — caller should validate beforehand if it
 * wants to surface errors.
 */
export function writeConnectorUrl(url: string): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeConnectorUrl(url);
  if (!normalized) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else if (isValidUrl(normalized)) {
    window.localStorage.setItem(STORAGE_KEY, normalized);
  } else {
    return;
  }
  window.dispatchEvent(new CustomEvent(URL_CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(URL_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(URL_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * React hook that reads the current connector URL and re-renders when it
 * changes (in this tab via `writeConnectorUrl`, or in another tab via the
 * browser's native `storage` event).
 */
export function useConnectorUrl(): [string, (next: string) => void] {
  const url = useSyncExternalStore(
    subscribe,
    readConnectorUrl,
    () => DEFAULT_CONNECTOR_URL,
  );

  const update = useCallback((next: string) => {
    writeConnectorUrl(next);
  }, []);

  return [url, update];
}
