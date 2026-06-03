/**
 * Env secret signing / parsing.
 *
 * Format:  fbes.<b64url(envId)>.<b64url(HMAC-SHA256(envId, SIGNING_KEY)[0..16])>
 *
 * Produced here (server-side Node only — SIGNING_KEY must never hit the
 * browser) and validated by track-service's EnvSecretMiddleware. ClickHouse
 * stores the plain envId; the token exists purely to bind an envId to the
 * bearer in transit.
 */
import { createHmac } from "node:crypto";

export const TOKEN_PREFIX = "fbes.";
export const SIGNATURE_BYTES = 16;

function getSigningKey(override?: string): string | null {
  const key = override ?? process.env.TRACK_SERVICE_SIGNING_KEY;
  return key && key.length > 0 ? key : null;
}

/**
 * Mint an env secret for `envId`. When no signing key is configured, returns
 * the plain envId so legacy track-service deployments (running without
 * TRACK_SERVICE_SIGNING_KEY) still work — matches the middleware's fallback.
 */
export function signEnvSecret(envId: string, signingKey?: string): string {
  if (!envId) throw new Error("envId is required");

  const key = getSigningKey(signingKey);
  if (!key) return envId;

  const envIdB64 = Buffer.from(envId, "utf8").toString("base64url");
  const sig = createHmac("sha256", key)
    .update(envId, "utf8")
    .digest()
    .subarray(0, SIGNATURE_BYTES)
    .toString("base64url");

  return `${TOKEN_PREFIX}${envIdB64}.${sig}`;
}
