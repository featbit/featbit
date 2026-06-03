import { bridgeFetch, mergeCookies, type FeatBitCookie } from "./featbit-bridge";
import { createSession, fetchProfile } from "./sessions";
import { setSessionCookie } from "./cookie";
import type { Profile } from "@/lib/featbit-auth/types";

export interface ExchangeResult {
  profile: Profile;
  isSsoFirstLogin: boolean;
}

/**
 * Calls a FeatBit token-issuing endpoint, captures cookies + token, fetches
 * the profile, and persists a server session. Returns the profile and a flag
 * for the SSO first-login UI hint.
 */
export async function exchangeAndCreateSession(
  path: string,
  body: unknown,
): Promise<ExchangeResult> {
  const res = await bridgeFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cookies: [],
  });

  if (!res.ok) {
    const text = res.bodyText || `${res.status}`;
    throw new ExchangeError(`Exchange failed: ${text}`, res.status);
  }

  const parsed = safeParse(res.bodyText);
  const token = extractToken(parsed);
  const isSsoFirstLogin = Boolean(extractFlag(parsed, "isSsoFirstLogin"));
  if (!token) {
    throw new ExchangeError("Exchange response missing token", 502);
  }

  const initialCookies: FeatBitCookie[] = res.setCookies;
  const { profile, cookies: afterProfile } = await fetchProfile(
    token,
    initialCookies,
  );
  const finalCookies = mergeCookies(initialCookies, afterProfile);

  const session = await createSession({
    token,
    cookies: finalCookies,
    profile,
  });
  await setSessionCookie(session.id);

  return { profile, isSsoFirstLogin };
}

export class ExchangeError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ExchangeError";
    this.status = status;
  }
}

function safeParse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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

function extractFlag(parsed: unknown, key: string): boolean | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const obj = parsed as Record<string, unknown>;
  if ("success" in obj && obj.success && obj.data && typeof obj.data === "object") {
    const data = obj.data as Record<string, unknown>;
    return typeof data[key] === "boolean" ? (data[key] as boolean) : undefined;
  }
  return typeof obj[key] === "boolean" ? (obj[key] as boolean) : undefined;
}
