import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { parseJwt } from "@/lib/featbit-auth/jwt";
import type { Profile } from "@/lib/featbit-auth/types";
import {
  bridgeFetch,
  mergeCookies,
  refreshFeatBitToken,
  type FeatBitCookie,
} from "./featbit-bridge";
import { SESSION_TTL_DAYS } from "./cookie";

export interface ServerSession {
  id: string;
  token: string;
  cookies: FeatBitCookie[];
  profile: Profile;
  workspaceId: string | null;
  organizationId: string | null;
  expiresAt: Date;
  refreshedAt: Date;
}

interface CreateSessionInput {
  token: string;
  cookies: FeatBitCookie[];
  profile: Profile;
  workspaceId?: string | null;
  organizationId?: string | null;
}

interface SealedSessionPayload {
  sid: string;
  token: string;
  cookies: FeatBitCookie[];
  profile: Profile;
  workspaceId: string | null;
  organizationId: string | null;
  expiresAt: string;
  refreshedAt: string;
}

function newSessionSid(): string {
  return randomBytes(32).toString("base64url");
}

function ttl(): Date {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function sessionSecret(): string {
  return (
    process.env.RELEASE_DECISION_SESSION_SECRET ||
    process.env.Jwt__Key ||
    "please_change_me_to_a_secure_release_decision_session_secret"
  );
}

function sign(body: string): string {
  return createHmac("sha256", sessionSecret()).update(body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function seal(payload: SealedSessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function unseal(value: string): ServerSession | null {
  const [body, signature] = value.split(".");
  if (!body || !signature || !safeEqual(sign(body), signature)) return null;

  let payload: SealedSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SealedSessionPayload;
  } catch {
    return null;
  }

  const expiresAt = new Date(payload.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) return null;

  const refreshedAt = new Date(payload.refreshedAt);
  return {
    id: value,
    token: payload.token,
    cookies: payload.cookies ?? [],
    profile: payload.profile,
    workspaceId: payload.workspaceId,
    organizationId: payload.organizationId,
    expiresAt,
    refreshedAt: Number.isNaN(refreshedAt.getTime()) ? new Date(0) : refreshedAt,
  };
}

export async function createSession(input: CreateSessionInput): Promise<ServerSession> {
  const expiresAt = ttl();
  const refreshedAt = new Date();
  const payload: SealedSessionPayload = {
    sid: newSessionSid(),
    token: input.token,
    cookies: input.cookies,
    profile: input.profile,
    workspaceId: input.workspaceId ?? input.profile.workspaceId ?? null,
    organizationId: input.organizationId ?? null,
    expiresAt: expiresAt.toISOString(),
    refreshedAt: refreshedAt.toISOString(),
  };
  return {
    id: seal(payload),
    token: payload.token,
    cookies: payload.cookies,
    profile: payload.profile,
    workspaceId: payload.workspaceId,
    organizationId: payload.organizationId,
    expiresAt,
    refreshedAt,
  };
}

export async function destroySession(id: string): Promise<void> {
  void id;
}

export async function loadSessionById(id: string): Promise<ServerSession | null> {
  return unseal(id);
}

export async function updateSessionOrganization(
  id: string,
  organizationId: string | null,
): Promise<void> {
  void id;
  void organizationId;
}

// ── singleflight refresh ─────────────────────────────────────────────────────
// One refresh per session id at any moment; concurrent callers await the same
// promise.

const inflight = new Map<string, Promise<ServerSession | null>>();

const REFRESH_BUFFER_MS = 60_000; // refresh if <= 1 min remains

function tokenExpiresSoon(token: string): boolean {
  const claims = parseJwt(token);
  if (!claims?.exp) return true;
  return claims.exp * 1000 - Date.now() <= REFRESH_BUFFER_MS;
}

export async function refreshIfNeeded(session: ServerSession): Promise<ServerSession | null> {
  if (!tokenExpiresSoon(session.token)) return session;
  const existing = inflight.get(session.id);
  if (existing) return existing;
  const promise = doRefresh(session)
    .catch((err) => {
      // Network errors (fetch failed, ECONNREFUSED, etc.) should not crash the
      // page tree. Return the existing session so the user stays logged in; the
      // refresh will be retried on the next request.
      console.error("[refreshIfNeeded] token refresh failed, keeping stale session:", err);
      return session;
    })
    .finally(() => {
      inflight.delete(session.id);
    });
  inflight.set(session.id, promise);
  return promise;
}

async function doRefresh(session: ServerSession): Promise<ServerSession | null> {
  const result = await refreshFeatBitToken(session.cookies);
  if (!result.ok || !result.token) {
    // 401 means the refresh token itself is definitively rejected — destroy.
    // Any other failure (5xx, network hiccup caught before here, missing token
    // in an otherwise-ok response) is treated as transient: keep the existing
    // session so the user stays logged in and we retry on the next request.
    if (result.status === 401) {
      await destroySession(session.id).catch(() => undefined);
      return null;
    }
    console.error("[doRefresh] refresh failed with status", result.status, "— keeping stale session");
    return session;
  }
  const cookies = result.cookies ?? session.cookies;
  return createSession({
    token: result.token,
    cookies,
    profile: session.profile,
    workspaceId: session.workspaceId,
    organizationId: session.organizationId,
  });
}

// ── helper used by login routes ──────────────────────────────────────────────

export async function fetchProfile(
  token: string,
  cookies: FeatBitCookie[],
): Promise<{ profile: Profile; cookies: FeatBitCookie[] }> {
  const res = await bridgeFetch("/user/profile", {
    method: "GET",
    token,
    cookies,
  });
  if (!res.ok) {
    throw new Error(`Failed to load profile: ${res.status}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(res.bodyText);
  } catch {
    throw new Error("Profile response was not JSON");
  }
  const profile = unwrap<Profile>(parsed);
  if (!profile?.id) throw new Error("Profile response missing id");
  return {
    profile,
    cookies: mergeCookies(cookies, res.setCookies),
  };
}

function unwrap<T>(parsed: unknown): T {
  if (parsed && typeof parsed === "object" && "success" in parsed) {
    const env = parsed as { success: boolean; data?: T };
    if (env.success) return env.data as T;
  }
  return parsed as T;
}
