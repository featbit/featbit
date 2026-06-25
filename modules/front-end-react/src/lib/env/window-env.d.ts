import type { RuntimeEnvKey } from "./runtime-env";

declare global {
  interface Window {
    env?: Partial<Record<RuntimeEnvKey | Lowercase<RuntimeEnvKey>, string>>;
  }
}

export {};
