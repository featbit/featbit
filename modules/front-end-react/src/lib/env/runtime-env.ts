type RawRuntimeEnv = Partial<Record<RuntimeEnvKey | Lowercase<RuntimeEnvKey>, string>>;

export type RuntimeEnvKey =
  | "API_URL"
  | "DEMO_URL"
  | "EVALUATION_URL"
  | "DISPLAY_API_URL"
  | "DISPLAY_EVALUATION_URL"
  | "HOSTING_MODE"
  | "VERSION";

export type RuntimeEnv = {
  apiUrl: string;
  demoUrl: string;
  evaluationUrl: string;
  displayApiUrl: string;
  displayEvaluationUrl: string;
  hostingMode: string;
  version: string;
};

function readValue(env: RawRuntimeEnv, key: RuntimeEnvKey, fallback = "") {
  return env[key] ?? env[key.toLowerCase() as Lowercase<RuntimeEnvKey>] ?? fallback;
}

export function getRuntimeEnv(): RuntimeEnv {
  const env = window.env ?? {};

  return {
    apiUrl: readValue(env, "API_URL"),
    demoUrl: readValue(env, "DEMO_URL"),
    evaluationUrl: readValue(env, "EVALUATION_URL"),
    displayApiUrl: readValue(env, "DISPLAY_API_URL"),
    displayEvaluationUrl: readValue(env, "DISPLAY_EVALUATION_URL"),
    hostingMode: readValue(env, "HOSTING_MODE"),
    version: readValue(env, "VERSION", "dev")
  };
}
