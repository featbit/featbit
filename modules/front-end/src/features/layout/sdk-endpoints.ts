import { getRuntimeEnv, type RuntimeEnv } from "@/lib/env/runtime-env"

export type SdkEndpointId = "streamingUrl" | "eventUrl" | "openApiEndpoint"

export type SdkEndpoint = {
  id: SdkEndpointId
  value: string
}

type SdkEndpointRuntimeEnv = Pick<
  RuntimeEnv,
  "apiUrl" | "evaluationUrl" | "displayApiUrl" | "displayEvaluationUrl"
>

export function resolveSdkEndpoints(
  runtimeEnv: SdkEndpointRuntimeEnv = getRuntimeEnv()
): SdkEndpoint[] {
  const evaluationUrl =
    runtimeEnv.displayEvaluationUrl.trim() || runtimeEnv.evaluationUrl.trim()
  const apiUrl = runtimeEnv.displayApiUrl.trim() || runtimeEnv.apiUrl.trim()

  return [
    {
      id: "streamingUrl",
      value: evaluationUrl.replace(/^http/, "ws"),
    },
    { id: "eventUrl", value: evaluationUrl },
    { id: "openApiEndpoint", value: apiUrl },
  ]
}
