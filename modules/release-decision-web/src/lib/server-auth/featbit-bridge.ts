import { FEATBIT_API_V1, FEATBIT_API_URL } from "@/lib/featbit-auth/config";

export interface FeatBitCookie {
  name: string;
  value: string;
  expiresAt?: string;
}

export interface BridgeRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  query?: Record<string, string | number | boolean | undefined | null>;
  token?: string | null;
  cookies?: FeatBitCookie[];
  organizationId?: string | null;
  workspaceId?: string | null;
}

export interface BridgeResponse {
  status: number;
  ok: boolean;
  headers: Headers;
  bodyText: string;
  setCookies: FeatBitCookie[];
}

function buildUrl(path: string, query?: BridgeRequestInit["query"]): string {
  const base = path.startsWith("http")
    ? path
    : path.startsWith("/api/v1")
      ? `${FEATBIT_API_URL}${path}`
      : `${FEATBIT_API_V1}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return base;
  const qs = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) qs.append(k, String(v));
  });
  const s = qs.toString();
  return s ? `${base}${base.includes("?") ? "&" : "?"}${s}` : base;
}

function activeCookies(jar: FeatBitCookie[]): FeatBitCookie[] {
  const now = Date.now();
  return jar.filter((c) => {
    if (!c.expiresAt) return true;
    return new Date(c.expiresAt).getTime() > now;
  });
}

function serializeCookieHeader(jar: FeatBitCookie[]): string {
  return activeCookies(jar)
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

function parseSetCookie(header: string): FeatBitCookie | null {
  const segments = header.split(";").map((s) => s.trim());
  if (segments.length === 0) return null;
  const first = segments.shift();
  if (!first) return null;
  const eqIdx = first.indexOf("=");
  if (eqIdx === -1) return null;
  const name = first.slice(0, eqIdx).trim();
  const value = first.slice(eqIdx + 1).trim();
  if (!name) return null;

  let expiresAt: string | undefined;
  for (const seg of segments) {
    const [rawK, ...rest] = seg.split("=");
    const k = rawK?.toLowerCase();
    const v = rest.join("=");
    if (k === "max-age") {
      const secs = Number(v);
      if (Number.isFinite(secs)) {
        expiresAt = new Date(Date.now() + secs * 1000).toISOString();
      }
    } else if (k === "expires" && !expiresAt) {
      const t = Date.parse(v);
      if (!Number.isNaN(t)) expiresAt = new Date(t).toISOString();
    }
  }
  return { name, value, expiresAt };
}

function readSetCookies(headers: Headers): FeatBitCookie[] {
  // Node 20+ undici exposes getSetCookie(); fallback to raw "set-cookie" header.
  const anyHeaders = headers as unknown as { getSetCookie?: () => string[] };
  const list =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : headers.get("set-cookie")
        ? [headers.get("set-cookie") as string]
        : [];
  const out: FeatBitCookie[] = [];
  for (const raw of list) {
    const c = parseSetCookie(raw);
    if (c) out.push(c);
  }
  return out;
}

export function mergeCookies(
  prev: FeatBitCookie[],
  incoming: FeatBitCookie[],
): FeatBitCookie[] {
  const map = new Map<string, FeatBitCookie>();
  for (const c of activeCookies(prev)) map.set(c.name, c);
  for (const c of incoming) {
    if (c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now()) {
      map.delete(c.name);
    } else {
      map.set(c.name, c);
    }
  }
  return Array.from(map.values());
}

/**
 * Server-to-server FeatBit fetch. Always sends the supplied cookie jar and
 * returns any Set-Cookie headers as a parsed list so callers can merge them
 * back into the persisted jar.
 */
export async function bridgeFetch(
  path: string,
  init: BridgeRequestInit = {},
): Promise<BridgeResponse> {
  const url = buildUrl(path, init.query);
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.headers || {}),
  };

  if (init.token) headers["Authorization"] = `Bearer ${init.token}`;
  if (init.organizationId) headers["Organization"] = init.organizationId;
  if (init.workspaceId) headers["Workspace"] = init.workspaceId;

  const cookieHeader = init.cookies
    ? serializeCookieHeader(init.cookies)
    : "";
  if (cookieHeader) headers["Cookie"] = cookieHeader;

  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers,
    body: init.body ?? undefined,
    redirect: "manual",
  });

  return {
    status: res.status,
    ok: res.ok,
    headers: res.headers,
    bodyText: await res.text(),
    setCookies: readSetCookies(res.headers),
  };
}

interface RefreshResult {
  ok: boolean;
  status: number;
  token?: string;
  cookies?: FeatBitCookie[];
}

/**
 * Calls /identity/refresh-token using the persisted cookie jar.
 * Returns the new token plus updated cookies (caller is responsible for
 * persisting both).
 */
export async function refreshFeatBitToken(
  cookies: FeatBitCookie[],
): Promise<RefreshResult> {
  const res = await bridgeFetch("/identity/refresh-token", {
    method: "POST",
    cookies,
  });
  if (!res.ok) return { ok: false, status: res.status };
  let parsed: unknown;
  try {
    parsed = JSON.parse(res.bodyText);
  } catch {
    return { ok: false, status: res.status };
  }
  const token = extractToken(parsed);
  if (!token) return { ok: false, status: res.status };
  return {
    ok: true,
    status: res.status,
    token,
    cookies: mergeCookies(cookies, res.setCookies),
  };
}

function extractToken(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const obj = parsed as Record<string, unknown>;
  if ("success" in obj && obj.success && obj.data && typeof obj.data === "object") {
    const data = obj.data as Record<string, unknown>;
    return typeof data.token === "string" ? data.token : undefined;
  }
  return typeof obj.token === "string" ? obj.token : undefined;
}
