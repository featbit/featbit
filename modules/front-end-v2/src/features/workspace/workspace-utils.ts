import type { WorkspaceDetails } from "@/features/workspace/workspace-api"
import type { LicensePayload, SsoFormValues } from "@/features/workspace/workspace-types"

function decodeBase64UrlJson<T>(value: string): T | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
    return JSON.parse(atob(paddedBase64)) as T
  } catch {
    return null
  }
}

export function isSsoLicensed(workspace: WorkspaceDetails | null) {
  const payload = workspace?.license?.split(".")[1]
  const license = payload ? decodeBase64UrlJson<LicensePayload>(payload) : null
  return Boolean(
    license?.features?.includes("*") || license?.features?.includes("sso")
  )
}

export function emptySsoValues(workspace: WorkspaceDetails | null): SsoFormValues {
  return {
    clientId: workspace?.sso?.oidc?.clientId ?? "",
    clientSecret: workspace?.sso?.oidc?.clientSecret ?? "",
    tokenEndpoint: workspace?.sso?.oidc?.tokenEndpoint ?? "",
    clientAuthenticationMethod:
      workspace?.sso?.oidc?.clientAuthenticationMethod ?? "Client secret basic",
    authorizationEndpoint: workspace?.sso?.oidc?.authorizationEndpoint ?? "",
    scope: workspace?.sso?.oidc?.scope ?? "",
    userEmailClaim: workspace?.sso?.oidc?.userEmailClaim ?? "",
  }
}
