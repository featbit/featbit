import { apiRequest } from "./http";
import type { LoginToken, OAuthProvider } from "./types";

export const socialService = {
  getProviders(redirectUri: string) {
    // Pre-login: hits the proxy without a session — proxy forwards as-is.
    return apiRequest<OAuthProvider[]>("/social/providers", {
      method: "GET",
      query: { redirectUri },
    });
  },
  async login(
    code: string,
    providerName: string,
    redirectUri: string,
  ): Promise<LoginToken> {
    return apiRequest<LoginToken>("/social/login", {
      method: "POST",
      skipAuth: true,
      body: { code, providerName, redirectUri },
    });
  },
};
