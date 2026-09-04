interface JwtClaims {
  exp?: number;
  iat?: number;
  [k: string]: unknown;
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  if (typeof atob === "function") {
    return atob(padded + pad);
  }
  return Buffer.from(padded + pad, "base64").toString("utf-8");
}

export function parseJwt(token: string | null | undefined): JwtClaims | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}

/** Milliseconds until token expiry. Negative or 0 means already expired / unknown. */
export function millisecondsUntilExpiry(token: string | null | undefined): number {
  const claims = parseJwt(token);
  if (!claims?.exp) return 0;
  return claims.exp * 1000 - Date.now();
}
