type RawRuntimeEnv = Partial<
  Record<RuntimeEnvKey | Lowercase<RuntimeEnvKey>, string>
>

export type RuntimeEnvKey =
  | "API_URL"
  | "DEMO_URL"
  | "EVALUATION_URL"
  | "BASE_HREF"
  | "DISPLAY_API_URL"
  | "DISPLAY_EVALUATION_URL"
  | "HOSTING_MODE"
  | "VERSION"

export type RuntimeEnv = {
  apiUrl: string
  demoUrl: string
  evaluationUrl: string
  baseHref: string
  displayApiUrl: string
  displayEvaluationUrl: string
  hostingMode: string
  version: string
}

const DEFAULT_RUNTIME_ENV: Record<RuntimeEnvKey, string> = {
  API_URL: "http://localhost:5000",
  DEMO_URL: "https://featbit-samples.vercel.app",
  EVALUATION_URL: "http://localhost:5100",
  BASE_HREF: "",
  DISPLAY_API_URL: "",
  DISPLAY_EVALUATION_URL: "",
  HOSTING_MODE: "self-hosted",
  VERSION: "dev",
}

function readValue(env: RawRuntimeEnv, key: RuntimeEnvKey) {
  return (
    env[key] ??
    env[key.toLowerCase() as Lowercase<RuntimeEnvKey>] ??
    DEFAULT_RUNTIME_ENV[key]
  ) || DEFAULT_RUNTIME_ENV[key]
}

export function getRuntimeEnv(): RuntimeEnv {
  const env = window.env ?? {}

  return {
    apiUrl: readValue(env, "API_URL"),
    demoUrl: readValue(env, "DEMO_URL"),
    evaluationUrl: readValue(env, "EVALUATION_URL"),
    baseHref: normalizeBaseHref(readValue(env, "BASE_HREF")),
    displayApiUrl: readValue(env, "DISPLAY_API_URL"),
    displayEvaluationUrl: readValue(env, "DISPLAY_EVALUATION_URL"),
    hostingMode: readValue(env, "HOSTING_MODE"),
    version: readValue(env, "VERSION"),
  }
}

function normalizeBaseHref(value: string) {
  const trimmed = value.trim()

  if (!trimmed || trimmed === "/") {
    return ""
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`
}
