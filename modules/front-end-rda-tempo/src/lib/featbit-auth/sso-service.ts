import { apiRequest } from "./http";
import { FEATBIT_BROWSER_API_V1 } from "./config";
import type { LoginToken, SsoPreCheck } from "./types";

export const ssoService = {
  preCheck() {
    return apiRequest<SsoPreCheck>("/sso/pre-check", { method: "GET" });
  },
  getAuthorizeUrl(workspaceKey: string, redirectUri: string) {
    const query = new URLSearchParams({
      redirect_uri: redirectUri,
      workspace_key: workspaceKey,
    });
    return Promise.resolve(`${FEATBIT_BROWSER_API_V1}/sso/oidc-authorize-url?${query}`);
  },
  async oidcLogin(
    code: string,
    workspaceKey: string,
    redirectUri: string,
  ): Promise<LoginToken> {
    return apiRequest<LoginToken>("/sso/oidc/login", {
      method: "POST",
      skipAuth: true,
      body: { code, workspaceKey, redirectUri },
    });
  },
};
