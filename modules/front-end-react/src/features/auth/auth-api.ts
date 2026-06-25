import { getRuntimeEnv } from "@/lib/env/runtime-env";

const IDENTITY_TOKEN = "token";
const USER_PROFILE = "auth";
const IS_SSO_FIRST_LOGIN = "is-sso-first-login";
const LOGIN_REDIRECT_URL = "login-redirect-url";
const REMEMBERED_EMAIL = "remembered-email";

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  errors?: string[];
};

type LoginData = {
  token?: string;
  isSsoFirstLogin?: boolean;
};

export type OAuthProvider = {
  name: string;
  authorizeUrl: string;
};

export type SsoPreCheck = {
  isEnabled?: boolean;
  workspaceKey?: string;
};

function clearAuthStorage() {
  localStorage.removeItem(IDENTITY_TOKEN);
  localStorage.removeItem(USER_PROFILE);
  sessionStorage.removeItem(IDENTITY_TOKEN);
  sessionStorage.removeItem(USER_PROFILE);
}

export function getIdentityToken() {
  return localStorage.getItem(IDENTITY_TOKEN);
}

export function getRememberedEmail() {
  return localStorage.getItem(REMEMBERED_EMAIL) ?? "";
}

function saveRememberedEmail(email: string, rememberMe: boolean) {
  if (rememberMe) {
    localStorage.setItem(REMEMBERED_EMAIL, email);
    return;
  }

  localStorage.removeItem(REMEMBERED_EMAIL);
}

function apiOrigin() {
  return getRuntimeEnv().apiUrl || "http://localhost:5000";
}

function apiUrl(path: string) {
  return `${apiOrigin()}${path}`;
}

function redirectUri(flag: "sso-logged-in" | "social-logged-in") {
  return `${window.location.origin}${window.location.pathname}?${flag}=true`;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T;

  if (!response.ok) {
    throw new Error(response.statusText || "Request failed");
  }

  return body;
}

function unwrapEnvelope<T>(envelope: ApiEnvelope<T>): T {
  if (envelope.success === false) {
    throw new Error(envelope.errors?.[0] || "Request failed");
  }

  return (envelope.data ?? envelope) as T;
}

async function postIdentityLogin(path: string, payload: unknown) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseJsonResponse<ApiEnvelope<LoginData>>(response);
}

export async function loginByEmail(email: string, password: string) {
  return postIdentityLogin("/api/v1/identity/login-by-email", { email, password });
}

export async function loginBySsoCode(code: string, workspaceKey: string) {
  return postIdentityLogin("/api/v1/sso/oidc/login", {
    code,
    redirectUri: redirectUri("sso-logged-in"),
    workspaceKey
  });
}

export async function loginBySocialCode(code: string, providerName: string) {
  return postIdentityLogin("/api/v1/social/login", {
    code,
    providerName,
    redirectUri: redirectUri("social-logged-in")
  });
}

export async function getProfile(token: string) {
  const response = await fetch(apiUrl("/api/v1/user/profile"), {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return unwrapEnvelope(await parseJsonResponse<ApiEnvelope<unknown>>(response));
}

export async function completeLogin(
  envelope: ApiEnvelope<LoginData>,
  navigate: (path: string) => void,
  fallbackPath: string,
  options?: {
    email?: string;
    rememberMe?: boolean;
  }
) {
  if (!envelope.success) {
    throw new Error(envelope.errors?.[0] || "Email and/or password incorrect");
  }

  const token = envelope.data?.token;
  if (!token) {
    throw new Error("Login response did not include a token");
  }

  clearAuthStorage();
  localStorage.setItem(IDENTITY_TOKEN, token);

  const profile = await getProfile(token);
  localStorage.setItem(USER_PROFILE, JSON.stringify(profile));

  if (options?.email !== undefined) {
    saveRememberedEmail(options.email, Boolean(options.rememberMe));
  }

  if (envelope.data?.isSsoFirstLogin !== undefined) {
    localStorage.setItem(IS_SSO_FIRST_LOGIN, String(envelope.data.isSsoFirstLogin));
  }

  const redirectUrl = localStorage.getItem(LOGIN_REDIRECT_URL);
  if (redirectUrl) {
    localStorage.removeItem(LOGIN_REDIRECT_URL);
    navigate(redirectUrl);
    return;
  }

  navigate(fallbackPath);
}

export async function getSocialProviders() {
  const params = new URLSearchParams({ redirectUri: redirectUri("social-logged-in") });
  const response = await fetch(apiUrl(`/api/v1/social/providers?${params.toString()}`));

  const providers = unwrapEnvelope(await parseJsonResponse<ApiEnvelope<OAuthProvider[]>>(response));

  return Array.isArray(providers) ? providers : [];
}

export async function getSsoPreCheck() {
  const response = await fetch(apiUrl("/api/v1/sso/pre-check"));

  return unwrapEnvelope(await parseJsonResponse<ApiEnvelope<SsoPreCheck>>(response));
}

export function getSsoAuthorizeUrl(workspaceKey: string) {
  const params = new URLSearchParams({
    redirect_uri: redirectUri("sso-logged-in"),
    workspace_key: workspaceKey
  });

  return apiUrl(`/api/v1/sso/oidc-authorize-url?${params.toString()}`);
}
