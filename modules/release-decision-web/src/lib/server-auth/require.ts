import { cache } from "react";
import { getSessionCookie } from "./cookie";
import { loadSessionById, refreshIfNeeded, type ServerSession } from "./sessions";

/**
 * Load and (if needed) refresh the current request's session. Returns null
 * for unauthenticated requests. Memoised per request via React.cache so the
 * RSC tree only parses the signed session cookie once.
 */
export const getSession = cache(async (): Promise<ServerSession | null> => {
  const id = await getSessionCookie();
  if (!id) return null;
  try {
    const loaded = await loadSessionById(id);
    if (!loaded) return null;
    return refreshIfNeeded(loaded);
  } catch (err) {
    console.error("[getSession] invalid session cookie, treating as unauthenticated:", err);
    return null;
  }
});

export async function requireSession(): Promise<ServerSession> {
  const session = await getSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}
