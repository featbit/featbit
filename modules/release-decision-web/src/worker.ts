import { Container, getContainer } from "@cloudflare/containers";

export class WebContainer extends Container<Env> {
  defaultPort = 3000;
  sleepAfter = "10m";
  envVars = {
    NODE_ENV: "production",
  };

  override onStart(): void {
    console.log("WebContainer started");
  }

  override onError(error: unknown): void {
    console.error("WebContainer error:", error);
    throw error;
  }
}

export interface Env {
  WEB_CONTAINER: DurableObjectNamespace<WebContainer>;
}

// Route all traffic to a single container instance (singleton pattern).
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return getContainer(env.WEB_CONTAINER).fetch(request);
  },
} satisfies ExportedHandler<Env>;
