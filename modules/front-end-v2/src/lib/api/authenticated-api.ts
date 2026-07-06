import {
  getIdentityToken,
  getStoredUserProfile,
} from "@/features/auth/auth-api"
import { getRuntimeEnv } from "@/lib/env/runtime-env"

type ApiEnvelope<T> = {
  success?: boolean
  data?: T
  errors?: string[]
}

const IDENTITY_TOKEN_STORAGE_KEY = "token"

function apiOrigin() {
  return getRuntimeEnv().apiUrl || "http://localhost:5000"
}

function unwrapApiResponse<T>(body: T | ApiEnvelope<T>): T {
  if (body && typeof body === "object" && "data" in body) {
    const envelope = body as ApiEnvelope<T>
    if (envelope.success === false) {
      throw new Error(envelope.errors?.[0] || "Request failed")
    }

    return envelope.data as T
  }

  return body as T
}

function scopedStorageKey(key: string) {
  const profile = getStoredUserProfile()
  return profile.id ? `${key}_${profile.id}` : key
}

function readStorageObject<T>(key: string): T | null {
  const rawValue = localStorage.getItem(key)
  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as T
  } catch {
    return null
  }
}

function currentContextIds() {
  const workspace = readStorageObject<{ id?: string }>(
    scopedStorageKey("current-workspace")
  )
  const organization = readStorageObject<{ id?: string }>(
    scopedStorageKey("current-organization")
  )

  return {
    organizationId: organization?.id ?? "",
    workspaceId: workspace?.id ?? "",
  }
}

function authHeaders(token: string | null) {
  const { organizationId, workspaceId } = currentContextIds()

  return {
    Authorization: `Bearer ${token ?? ""}`,
    Organization: organizationId,
    Workspace: workspaceId,
  }
}

let refreshTokenPromise: Promise<string> | null = null

async function refreshIdentityToken() {
  const response = await fetch(`${apiOrigin()}/api/v1/identity/refresh-token`, {
    method: "POST",
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error(response.statusText || "Failed to refresh token")
  }

  const body = (await response.json()) as ApiEnvelope<{ token?: string }>
  const data = unwrapApiResponse(body)
  const token = data.token

  if (!token) {
    throw new Error("Refresh response did not include a token")
  }

  localStorage.setItem(IDENTITY_TOKEN_STORAGE_KEY, token)
  return token
}

async function getRefreshedToken() {
  refreshTokenPromise ??= refreshIdentityToken().finally(() => {
    refreshTokenPromise = null
  })

  return refreshTokenPromise
}

export async function fetchApi<T>(
  path: string,
  init?: RequestInit,
  token = getIdentityToken(),
  retryOnUnauthorized = true
): Promise<T> {
  const response = await fetch(`${apiOrigin()}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...authHeaders(token),
      ...init?.headers,
    },
  })

  if (response.status === 401 && retryOnUnauthorized) {
    const refreshedToken = await getRefreshedToken()
    return fetchApi<T>(path, init, refreshedToken, false)
  }

  if (!response.ok) {
    throw new Error(response.statusText || "Request failed")
  }

  const body = (await response.json()) as T | ApiEnvelope<T>
  return unwrapApiResponse<T>(body)
}
