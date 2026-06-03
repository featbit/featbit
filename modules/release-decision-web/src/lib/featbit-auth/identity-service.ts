import type { LoginToken } from "./types";
import { apiRequest } from "./http";

export const identityService = {
  /**
   * Server-side login: trades email/password for an opaque session cookie.
   * The shape mirrors the legacy LoginToken to keep callers unchanged — but
   * the token is no longer exposed to the browser.
   */
  async loginByEmail(
    email: string,
    password: string,
    workspaceKey?: string,
  ): Promise<LoginToken> {
    return apiRequest<LoginToken>("/identity/login-by-email", {
      method: "POST",
      skipAuth: true,
      body: { email, password, workspaceKey },
    });
  },
  async logout(): Promise<boolean> {
    try {
      await apiRequest<boolean>("/identity/logout", { method: "POST" });
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("token");
      }
      return true;
    } catch {
      return false;
    }
  },
};
