import type { MetricSourceAuthenticationType } from "../release-health-types"

export type SourceConnectionProviderType =
  "prometheus-compatible" | "datadog" | "new-relic" | "azure-data-explorer"

export type SourceConnectionConfigurationDraft = {
  endpoint: string
  authentication: MetricSourceAuthenticationType
  prometheusBearerToken: string
  prometheusBasicUsername: string
  prometheusBasicPassword: string
  datadogSite: "us1" | "eu1" | "custom"
  datadogApiKey: string
  datadogApplicationKey: string
  newRelicRegion: "us" | "eu"
  newRelicAccountId: string
  newRelicApiKey: string
  azureClusterUri: string
  azureDatabase: string
  azureAuthentication: "entra-application" | "managed-identity"
  azureTenantId: string
  azureClientId: string
  azureClientSecret: string
}

export const emptySourceConnectionConfiguration: SourceConnectionConfigurationDraft =
  {
    endpoint: "",
    authentication: "bearer_token",
    prometheusBearerToken: "",
    prometheusBasicUsername: "",
    prometheusBasicPassword: "",
    datadogSite: "us1",
    datadogApiKey: "",
    datadogApplicationKey: "",
    newRelicRegion: "us",
    newRelicAccountId: "",
    newRelicApiKey: "",
    azureClusterUri: "",
    azureDatabase: "",
    azureAuthentication: "entra-application",
    azureTenantId: "",
    azureClientId: "",
    azureClientSecret: "",
  }

export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}
