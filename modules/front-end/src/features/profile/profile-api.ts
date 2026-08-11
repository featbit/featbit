import { fetchApi } from "@/lib/api/authenticated-api"

const USER_PROFILE_STORAGE_KEY = "auth"

export const PROFILE_CHANGED_EVENT = "featbit:profile-changed"

export type UserOrigin = "Local" | "Sso" | string

export type UserProfile = {
  id?: string
  name?: string
  email?: string
  origin?: UserOrigin
}

export type UpdateProfilePayload = {
  name: string
  email: string
}

export type ResetPasswordResult = {
  success: boolean
  reason?: string
}

function profileRequest<T>(path: string, init?: RequestInit) {
  return fetchApi<T>(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
}

export function getStoredProfile(): UserProfile {
  const rawProfile =
    localStorage.getItem(USER_PROFILE_STORAGE_KEY) ??
    sessionStorage.getItem(USER_PROFILE_STORAGE_KEY)

  if (!rawProfile) {
    return { origin: "Local" }
  }

  try {
    const profile = JSON.parse(rawProfile) as UserProfile
    return {
      ...profile,
      origin: profile.origin ?? "Local",
    }
  } catch {
    return { origin: "Local" }
  }
}

export function persistProfile(profile: UserProfile) {
  const storage =
    sessionStorage.getItem(USER_PROFILE_STORAGE_KEY) !== null
      ? sessionStorage
      : localStorage

  storage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile))
  window.dispatchEvent(new CustomEvent(PROFILE_CHANGED_EVENT))
}

export async function updateProfile(payload: UpdateProfilePayload) {
  const updatedProfile = await profileRequest<UserProfile>("/api/v1/user/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  })
  const normalizedProfile = {
    ...updatedProfile,
    origin: updatedProfile.origin ?? getStoredProfile().origin ?? "Local",
  }

  persistProfile(normalizedProfile)
  return normalizedProfile
}

export function resetPassword(payload: {
  currentPassword: string
  newPassword: string
}) {
  return profileRequest<ResetPasswordResult>("/api/v1/identity/reset-password", {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}
