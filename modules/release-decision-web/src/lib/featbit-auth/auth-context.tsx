"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authStorage } from "./storage";
import { userService } from "./user-service";
import { identityService } from "./identity-service";
import { projectService } from "./project-service";
import { SESSION_EXPIRED_EVENT } from "./http";
import type {
  Environment,
  Organization,
  Profile,
  Project,
  ProjectEnv,
  Workspace,
} from "./types";

export type SessionStatus = "unknown" | "checking" | "valid" | "invalid";

interface AuthContextValue {
  isReady: boolean;
  isAuthenticated: boolean;
  /** FeatBit JWT shared with the Angular app through localStorage["token"]. */
  token: string | null;
  profile: Profile | null;
  workspace: Workspace | null;
  organization: Organization | null;
  projectEnv: ProjectEnv | null;
  sessionStatus: SessionStatus;
  organizations: Organization[];
  projects: Project[];
  currentProject: Project | null;
  currentEnvironment: Environment | null;
  /** Called after a successful FeatBit login; persists the returned JWT. */
  completeLogin: (token?: string) => Promise<Profile>;
  logout: () => Promise<void>;
  selectOrganization: (org: Organization) => Promise<void>;
  selectProjectEnv: (projectId: string, envId: string) => void;
}

interface MeResponse {
  profile: Profile | null;
  organizationId?: string | null;
  workspaceId?: string | null;
}

function toProjectEnv(project: Project, env: Environment): ProjectEnv {
  return {
    projectId: project.id,
    projectName: project.name,
    projectKey: project.key,
    envId: env.id,
    envKey: env.key,
    envName: env.name,
  };
}

function pickProjectEnv(
  projects: Project[],
  stored: ProjectEnv | null,
): ProjectEnv | null {
  if (projects.length === 0) return null;
  if (stored) {
    const project = projects.find((p) => p.id === stored.projectId);
    const env = project?.environments.find((e) => e.id === stored.envId);
    if (project && env) return toProjectEnv(project, env);
  }
  const first = projects[0];
  const firstEnv = first.environments?.[0];
  return firstEnv ? toProjectEnv(first, firstEnv) : null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  initialProfile?: Profile | null;
  children: React.ReactNode;
}

export function AuthProvider({
  initialProfile = null,
  children,
}: AuthProviderProps) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [projectEnv, setProjectEnvState] = useState<ProjectEnv | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(
    initialProfile ? "valid" : "unknown",
  );
  // Server-injected profile means we're already past the "is the user signed
  // in" round-trip — no client-side bootstrap needed.
  const isReady = true;

  const isAuthenticated = profile !== null;

  const currentProject = useMemo(
    () => projects.find((p) => p.id === projectEnv?.projectId) ?? null,
    [projects, projectEnv],
  );
  const currentEnvironment = useMemo(
    () =>
      currentProject?.environments.find((e) => e.id === projectEnv?.envId) ??
      null,
    [currentProject, projectEnv],
  );

  const refreshProjects = useCallback(async () => {
    try {
      const list = await projectService.getProjects();
      setProjects(list);
      const stored = authStorage.getProjectEnv();
      const next = pickProjectEnv(list, stored);
      authStorage.setProjectEnv(next);
      setProjectEnvState(next);
    } catch {
      setProjects([]);
    }
  }, []);

  const hydrateAfterAuth = useCallback(
    async (nextProfile: Profile) => {
      // Caller is responsible for putting `profile` into state — either via
      // useState initializer (server-injected path) or setProfile after login
      // (completeLogin path). All the setState calls below are post-await so
      // they don't trigger effect-body render cascades.
      authStorage.setProfile(nextProfile);

      try {
        const ws = await userService.getWorkspace();
        if (ws) {
          authStorage.setWorkspace(ws);
          setWorkspace(ws);
        }
      } catch {
        /* optional */
      }

      try {
        const orgs = await userService.getOrganizations(false);
        setOrganizations(orgs);
        const stored = authStorage.getOrganization();
        const org = orgs.find((o) => o.id === stored?.id) || orgs[0] || null;
        if (org) {
          authStorage.setOrganization(org);
          setOrganization(org);
        }
      } catch {
        setOrganizations([]);
      }

      await refreshProjects();
      setSessionStatus("valid");
    },
    [refreshProjects],
  );

  // Server-injected hydration is kept for source compatibility. In the embedded
  // Angular flow this normally starts from localStorage["token"] instead.
  useEffect(() => {
    if (!initialProfile) return;
    // The setStates inside hydrateAfterAuth are all post-await — this is the
    // canonical "fetch data on mount" pattern and the cascading-render concern
    // doesn't apply to async hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hydrateAfterAuth(initialProfile);
  }, [initialProfile, hydrateAfterAuth]);

  useEffect(() => {
    if (initialProfile || profile) return;
    if (typeof window === "undefined") return;

    const token = window.localStorage.getItem("token");
    if (!token) {
      setSessionStatus("invalid");
      return;
    }

    let cancelled = false;
    setSessionStatus("checking");

    const run = async () => {
      const profile = await userService.getProfile();
      if (cancelled) return;
      if (!profile) {
        setSessionStatus("invalid");
        return;
      }
      setProfile(profile);
      await hydrateAfterAuth(profile);
    };

    void run().catch(() => {
      if (!cancelled) setSessionStatus("invalid");
    });

    return () => {
      cancelled = true;
    };
  }, [initialProfile, profile, hydrateAfterAuth]);

  // Server-side session expired (proxy returned 401) → drop client state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      authStorage.clearAll();
      setProfile(null);
      setWorkspace(null);
      setOrganization(null);
      setProjectEnvState(null);
      setOrganizations([]);
      setProjects([]);
      setSessionStatus("invalid");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
  }, []);

  const completeLogin = useCallback(
    async (_token?: string): Promise<Profile> => {
      if (_token && _token !== "session" && typeof window !== "undefined") {
        window.localStorage.setItem("token", _token);
      }
      const profile = await userService.getProfile();
      if (!profile) {
        throw new Error("Login completed but session was not found.");
      }
      setProfile(profile);
      setSessionStatus("valid");
      await hydrateAfterAuth(profile);
      return profile;
    },
    [hydrateAfterAuth],
  );

  const logout = useCallback(async () => {
    try {
      await identityService.logout();
    } catch {
      /* ignore */
    }
    authStorage.clearAll();
    setProfile(null);
    setWorkspace(null);
    setOrganization(null);
    setProjectEnvState(null);
    setOrganizations([]);
    setProjects([]);
    setSessionStatus("invalid");
  }, []);

  const selectOrganization = useCallback(
    async (org: Organization) => {
      authStorage.setOrganization(org);
      authStorage.setProjectEnv(null);
      setOrganization(org);
      setProjectEnvState(null);
      await refreshProjects();
    },
    [refreshProjects],
  );

  const selectProjectEnv = useCallback(
    (projectId: string, envId: string) => {
      const project = projects.find((p) => p.id === projectId);
      const env = project?.environments.find((e) => e.id === envId);
      if (!project || !env) return;
      const next = toProjectEnv(project, env);
      authStorage.setProjectEnv(next);
      setProjectEnvState(next);
    },
    [projects],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isReady,
      isAuthenticated,
      token:
        isAuthenticated && typeof window !== "undefined"
          ? window.localStorage.getItem("token")
          : null,
      profile,
      workspace,
      organization,
      projectEnv,
      sessionStatus,
      organizations,
      projects,
      currentProject,
      currentEnvironment,
      completeLogin,
      logout,
      selectOrganization,
      selectProjectEnv,
    }),
    [
      isReady,
      isAuthenticated,
      profile,
      workspace,
      organization,
      projectEnv,
      sessionStatus,
      organizations,
      projects,
      currentProject,
      currentEnvironment,
      completeLogin,
      logout,
      selectOrganization,
      selectProjectEnv,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
