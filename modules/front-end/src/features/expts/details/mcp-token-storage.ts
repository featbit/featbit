import type { StoredMcpToken } from "./experiment-details-types"

export type McpTokenContext = {
  apiUrl: string
  userId: string
  organizationId: string
  workspaceId: string
}

const LEGACY_STORAGE_PREFIX = "featbit:mcp-token:"
const STORAGE_PREFIX = `${LEGACY_STORAGE_PREFIX}v2:`

export const MCP_TOKEN_CHANGED_EVENT = "featbit:mcp-token-changed"

export function getMcpTokenStorageKey(context: McpTokenContext) {
  return (
    STORAGE_PREFIX +
    [
      context.apiUrl.trim().replace(/\/+$/, ""),
      context.userId,
      context.organizationId,
      context.workspaceId,
    ]
      .map(encodeURIComponent)
      .join(":")
  )
}

export function getStoredMcpTokenSnapshot(context: McpTokenContext) {
  try {
    return localStorage.getItem(getMcpTokenStorageKey(context))
  } catch {
    return null
  }
}

function parseStoredToken(raw: string | null): StoredMcpToken | null {
  if (!raw) return null

  try {
    const token: unknown = JSON.parse(raw)
    if (
      typeof token !== "object" ||
      token === null ||
      !("access_token" in token) ||
      typeof token.access_token !== "string" ||
      !token.access_token ||
      !("token_type" in token) ||
      token.token_type !== "Bearer" ||
      !("expires_in" in token) ||
      typeof token.expires_in !== "number" ||
      !Number.isFinite(token.expires_in) ||
      token.expires_in <= 0 ||
      !("expires_at" in token) ||
      typeof token.expires_at !== "string" ||
      !Number.isFinite(Date.parse(token.expires_at)) ||
      ("refresh_token" in token && typeof token.refresh_token !== "string") ||
      ("scope" in token && typeof token.scope !== "string")
    ) {
      return null
    }

    return token as StoredMcpToken
  } catch {
    return null
  }
}

export function readStoredMcpToken(context: McpTokenContext) {
  return parseStoredToken(getStoredMcpTokenSnapshot(context))
}

export function storeMcpToken(
  context: McpTokenContext,
  token: StoredMcpToken | null
) {
  const storageKey = getMcpTokenStorageKey(context)
  // A null record prevents an explicitly revoked token from being replaced by
  // another credential left in the old per-experiment cache.
  localStorage.setItem(storageKey, JSON.stringify(token))
  window.dispatchEvent(
    new CustomEvent(MCP_TOKEN_CHANGED_EVENT, { detail: { storageKey } })
  )
}

export function getMatchingMcpTokenExpiry(
  token: StoredMcpToken,
  context: McpTokenContext
): number | null {
  try {
    const parts = token.access_token.split(".")
    if (parts.length !== 3 || parts.some((part) => !part)) return null

    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const claims: unknown = JSON.parse(
      atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "="))
    )
    if (
      typeof claims !== "object" ||
      claims === null ||
      !("id" in claims) ||
      claims.id !== context.userId ||
      !("featbit_org_id" in claims) ||
      claims.featbit_org_id !== context.organizationId ||
      !("featbit_workspace_id" in claims) ||
      claims.featbit_workspace_id !== context.workspaceId ||
      !("featbit_token_type" in claims) ||
      claims.featbit_token_type !== "mcp" ||
      !("exp" in claims) ||
      typeof claims.exp !== "number" ||
      !Number.isFinite(claims.exp)
    ) {
      return null
    }

    const expiresAt = Math.min(Date.parse(token.expires_at), claims.exp * 1000)
    return expiresAt > Date.now() ? expiresAt : null
  } catch {
    return null
  }
}

export function migrateStoredMcpToken(context: McpTokenContext) {
  try {
    // Even an invalid record or a null tombstone means this context has already
    // been handled. Never restore a legacy credential over it.
    if (localStorage.getItem(getMcpTokenStorageKey(context)) !== null) return

    let candidate: StoredMcpToken | null = null
    let latestExpiry = 0

    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)
      if (
        !key?.startsWith(LEGACY_STORAGE_PREFIX) ||
        key.startsWith(STORAGE_PREFIX)
      ) {
        continue
      }

      const token = parseStoredToken(localStorage.getItem(key))
      if (!token) continue

      // JWT claims are only a local ownership hint for legacy records, which
      // lack an API URL. The MCP server still validates signatures and access.
      const expiresAt = getMatchingMcpTokenExpiry(token, context)
      if (expiresAt !== null && expiresAt > latestExpiry) {
        candidate = token
        latestExpiry = expiresAt
      }
    }

    if (candidate) {
      storeMcpToken(context, {
        ...candidate,
        expires_at: new Date(latestExpiry).toISOString(),
      })
    }
  } catch {
    // Storage can be unavailable in restricted browser sessions.
  }
}
