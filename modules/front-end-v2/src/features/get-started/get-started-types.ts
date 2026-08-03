import type { EnvironmentSecret } from "@/features/layout/layout-types"

export type GetStartedStep = 0 | 1 | 2

export type GetStartedFlag = {
  id?: string
  name: string
  key: string
  description?: string
  variationType: string
  isEnabled: boolean
}

export type GetStartedEnvironment = {
  id: string
  projectId: string
  name: string
  key: string
  secrets: EnvironmentSecret[]
}

export type SdkId = "javascript" | "node" | "python" | "java" | "dotnet" | "go"

export type SdkSnippetInput = {
  flagKey: string
  secret: string
  eventUrl: string
  streamingUrl: string
}

export type SdkDefinition = {
  id: SdkId
  label: string
  codeLanguage: string
  installLanguage: string
  recommendedSecretType: EnvironmentSecret["type"]
  install: string
  documentationUrl: string
  buildSnippet: (input: SdkSnippetInput) => string
}
