import type {
  Organization,
  Profile,
  ProjectEnv,
  Workspace,
} from "./types";

// Notes on this file post-refactor:
// - The auth token is shared with the Angular app as localStorage["token"].
// - We keep ergonomic UI state in localStorage too: which workspace/org/project
//   the user last picked, and the "where should I land after login" hint.

const STATIC_KEYS = {
  profile: "auth",
  loginRedirectUrl: "login-redirect-url",
  isSsoFirstLogin: "is-sso-first-login",
  ssoWorkspaceKey: "sso-workspace-key",
} as const;

const SCOPED_KEY_BASE = {
  workspace: "current-workspace",
  organization: "current-organization",
  projectEnv: "current-project",
} as const;

export const ENV_COOKIE_NAME = "fb_env_id";

function isBrowser() {
  return typeof window !== "undefined";
}

function scopedKey(base: string, userId: string | null | undefined) {
  return userId ? `${base}_${userId}` : base;
}

function read<T>(key: string): T | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

function write(key: string, value: unknown) {
  if (!isBrowser()) return;
  if (value === null || value === undefined) {
    window.localStorage.removeItem(key);
    return;
  }
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  window.localStorage.setItem(key, serialized);
}

function getProfileRaw(): Profile | null {
  return read<Profile>(STATIC_KEYS.profile);
}

function currentUserId(): string | null {
  return getProfileRaw()?.id ?? null;
}

function setEnvCookie(envId: string | null) {
  if (!isBrowser()) return;
  const base = `${ENV_COOKIE_NAME}=${envId ?? ""}; Path=/; SameSite=Lax`;
  if (envId) {
    document.cookie = `${base}; Max-Age=31536000`;
  } else {
    document.cookie = `${base}; Max-Age=0`;
  }
}

export const authStorage = {
  getProfile(): Profile | null {
    return getProfileRaw();
  },
  setProfile(profile: Profile) {
    write(STATIC_KEYS.profile, profile);
  },
  clearProfile() {
    if (!isBrowser()) return;
    window.localStorage.removeItem(STATIC_KEYS.profile);
  },

  getWorkspace(): Workspace | null {
    return read<Workspace>(scopedKey(SCOPED_KEY_BASE.workspace, currentUserId()));
  },
  setWorkspace(workspace: Workspace | null) {
    write(scopedKey(SCOPED_KEY_BASE.workspace, currentUserId()), workspace);
  },

  getOrganization(): Organization | null {
    return read<Organization>(
      scopedKey(SCOPED_KEY_BASE.organization, currentUserId()),
    );
  },
  setOrganization(org: Organization) {
    write(scopedKey(SCOPED_KEY_BASE.organization, currentUserId()), org);
  },

  getProjectEnv(): ProjectEnv | null {
    return read<ProjectEnv>(
      scopedKey(SCOPED_KEY_BASE.projectEnv, currentUserId()),
    );
  },
  setProjectEnv(projectEnv: ProjectEnv | null) {
    const key = scopedKey(SCOPED_KEY_BASE.projectEnv, currentUserId());
    if (!projectEnv) {
      if (isBrowser()) window.localStorage.removeItem(key);
      setEnvCookie(null);
      return;
    }
    write(key, projectEnv);
    setEnvCookie(projectEnv.envId);
  },

  getLoginRedirectUrl(): string | null {
    if (!isBrowser()) return null;
    return window.localStorage.getItem(STATIC_KEYS.loginRedirectUrl);
  },
  setLoginRedirectUrl(url: string) {
    write(STATIC_KEYS.loginRedirectUrl, url);
  },
  clearLoginRedirectUrl() {
    if (!isBrowser()) return;
    window.localStorage.removeItem(STATIC_KEYS.loginRedirectUrl);
  },

  setSsoFirstLogin(flag: boolean) {
    write(STATIC_KEYS.isSsoFirstLogin, flag);
  },
  setSsoWorkspaceKey(key: string) {
    write(STATIC_KEYS.ssoWorkspaceKey, key);
  },
  getSsoWorkspaceKey(): string | null {
    if (!isBrowser()) return null;
    return window.localStorage.getItem(STATIC_KEYS.ssoWorkspaceKey);
  },

  clearAll() {
    if (!isBrowser()) return;
    const userId = currentUserId();
    Object.values(STATIC_KEYS).forEach((k) =>
      window.localStorage.removeItem(k),
    );
    Object.values(SCOPED_KEY_BASE).forEach((base) => {
      window.localStorage.removeItem(scopedKey(base, userId));
      window.localStorage.removeItem(base);
    });
    setEnvCookie(null);
  },
};
