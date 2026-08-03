const GET_STARTED_STORAGE_KEY = "get-started"

export type AuthenticatedLandingPath = "/get-started" | "/feature-flags"

export function getAuthenticatedLandingPath(): AuthenticatedLandingPath {
  return localStorage.getItem(GET_STARTED_STORAGE_KEY)
    ? "/feature-flags"
    : "/get-started"
}

export function markGetStartedVisited() {
  localStorage.setItem(GET_STARTED_STORAGE_KEY, "true")
}
