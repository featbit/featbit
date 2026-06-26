/* eslint-disable react-refresh/only-export-components */
import { Award, Check, ChevronRight, ChevronsUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { getIdentityToken, getStoredUserProfile } from "@/features/auth/auth-api";
import { getRuntimeEnv } from "@/lib/env/runtime-env";
import { cn } from "@/lib/utils";

export type Lang = "en" | "zh";

export type Environment = {
  id: string;
  projectId: string;
  name: string;
  key?: string;
  secrets?: Secret[];
  settings?: EnvironmentSetting;
  type: "prod" | "staging" | "dev";
};

export type Secret = {
  id?: string;
  name: string;
  type: string;
  value: string;
};

export type EnvironmentSetting = {
  requireChangeComment?: boolean;
};

export type Project = {
  id: string;
  name: string;
  key: string;
  environments: Environment[];
};

export type ProjectEnv = {
  projectId: string;
  projectName: string;
  projectKey: string;
  envId: string;
  envKey: string;
  envName: string;
  envSecrets?: Secret[];
  envSettings?: EnvironmentSetting;
};

export type Workspace = {
  id: string;
  name: string;
  key: string;
  license?: string;
};

export type Organization = {
  id: string;
  name: string;
  key: string;
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  errors?: string[];
};

type LicenseData = {
  plan?: string;
  exp?: number;
};

type PlanBadgeState = {
  labelKey: string;
  plan: string;
  warning: boolean;
  href: string;
};

const IDENTITY_TOKEN_STORAGE_KEY = "token";
const LICENSE_EXPIRING_DAYS_THRESHOLD = 30;
const HOSTING_MODE_SAAS = "saas";
const PLAN_FREE = "free";

const fallbackOrganization: Organization = { id: "fallback-org", name: "Acme Corp", key: "acme" };
const fallbackWorkspace: Workspace = { id: "fallback-workspace", name: "Acme Workspace", key: "acme" };
const fallbackProjectEnv: ProjectEnv = {
  projectId: "growth",
  projectName: "Growth Platform",
  projectKey: "growth",
  envId: "prod",
  envKey: "prod",
  envName: "Production"
};

export const fallbackProjects: Project[] = [
  {
    id: "growth",
    name: "Growth Platform",
    key: "growth",
    environments: [
      { id: "prod", projectId: "growth", name: "Production", key: "prod", type: "prod" },
      { id: "staging", projectId: "growth", name: "Staging", key: "staging", type: "staging" },
      { id: "dev", projectId: "growth", name: "Development", key: "dev", type: "dev" }
    ]
  }
];

export function resolveLang(value: string | undefined): Lang {
  return value === "zh" ? "zh" : "en";
}

export function localizedPath(lang: Lang, href: string) {
  return `/${lang}${href}`;
}

function scopedStorageKey(key: string) {
  const profile = getStoredUserProfile();
  return profile.id ? `${key}_${profile.id}` : key;
}

function readStorageObject<T>(key: string): T | null {
  const rawValue = localStorage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

export function getCurrentWorkspace() {
  return readStorageObject<Workspace>(scopedStorageKey("current-workspace")) ?? fallbackWorkspace;
}

export function getCurrentOrganization() {
  return readStorageObject<Organization>(scopedStorageKey("current-organization")) ?? fallbackOrganization;
}

export function getCurrentProjectEnv() {
  return readStorageObject<ProjectEnv>(scopedStorageKey("current-project")) ?? fallbackProjectEnv;
}

export function saveCurrentProjectEnv(projectEnv: ProjectEnv) {
  localStorage.setItem(scopedStorageKey("current-project"), JSON.stringify(projectEnv));
}

function saveCurrentWorkspace(workspace: Workspace) {
  localStorage.setItem(scopedStorageKey("current-workspace"), JSON.stringify(workspace));
}

function saveCurrentOrganization(organization: Organization) {
  localStorage.setItem(scopedStorageKey("current-organization"), JSON.stringify(organization));
}

function decodeBase64UrlJson<T>(value: string): T | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(paddedBase64)) as T;
  } catch {
    return null;
  }
}

function parseLicense(license: string | undefined) {
  const payload = license?.split(".")[1];
  if (!payload) {
    return null;
  }

  return decodeBase64UrlJson<LicenseData>(payload);
}

function isExpired(license: LicenseData | null) {
  return Boolean(license?.exp && license.exp < Date.now());
}

function daysUntilExpiration(license: LicenseData | null) {
  if (!license?.exp) {
    return -1;
  }

  return Math.ceil((license.exp - Date.now()) / (1000 * 60 * 60 * 24));
}

function isExpiringSoon(license: LicenseData | null) {
  const remainingDays = daysUntilExpiration(license);
  return remainingDays > 0 && remainingDays <= LICENSE_EXPIRING_DAYS_THRESHOLD;
}

function displayPlan(plan: string | undefined) {
  if (!plan) {
    return "";
  }

  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function planBadgeState(workspace: Workspace, lang: Lang): PlanBadgeState {
  const license = parseLicense(workspace.license);
  const plan = license?.plan;
  const isSaasFreePlan = getRuntimeEnv().hostingMode === HOSTING_MODE_SAAS && plan === PLAN_FREE;

  if (isSaasFreePlan) {
    return {
      labelKey: "layout.plan.free",
      plan: "layout.plan.upgradeNow",
      warning: false,
      href: localizedPath(lang, "/workspace/billing")
    };
  }

  if (license && plan) {
    if (isExpired(license)) {
      return {
        labelKey: "layout.plan.expired",
        plan: displayPlan(plan),
        warning: true,
        href: localizedPath(lang, "/workspace/license")
      };
    }

    if (isExpiringSoon(license)) {
      return {
        labelKey: "layout.plan.expiringSoon",
        plan: displayPlan(plan),
        warning: true,
        href: localizedPath(lang, "/workspace/license")
      };
    }

    return {
      labelKey: "layout.plan.current",
      plan: displayPlan(plan),
      warning: false,
      href: localizedPath(lang, "/workspace/license")
    };
  }

  return {
    labelKey: "layout.plan.upgradeNow",
    plan: "layout.plan.getEnterprise",
    warning: false,
    href: localizedPath(lang, "/workspace/license")
  };
}

function apiOrigin() {
  return getRuntimeEnv().apiUrl || "http://localhost:5000";
}

let refreshTokenPromise: Promise<string> | null = null;

function unwrapApiResponse<T>(body: T | ApiEnvelope<T>): T {
  if (body && typeof body === "object" && "data" in body) {
    const envelope = body as ApiEnvelope<T>;
    if (envelope.success === false) {
      throw new Error(envelope.errors?.[0] || "Request failed");
    }

    return envelope.data as T;
  }

  return body as T;
}

function authHeaders(token: string | null) {
  const currentWorkspace = getCurrentWorkspace();
  const currentOrganization = getCurrentOrganization();

  return {
    Authorization: `Bearer ${token ?? ""}`,
    Organization: currentOrganization.id ?? "",
    Workspace: currentWorkspace.id ?? ""
  };
}

async function refreshIdentityToken() {
  const response = await fetch(`${apiOrigin()}/api/v1/identity/refresh-token`, {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(response.statusText || "Failed to refresh token");
  }

  const body = (await response.json()) as ApiEnvelope<{ token?: string }>;
  const data = unwrapApiResponse(body);
  const token = data.token;

  if (!token) {
    throw new Error("Refresh response did not include a token");
  }

  localStorage.setItem(IDENTITY_TOKEN_STORAGE_KEY, token);
  return token;
}

async function getRefreshedToken() {
  refreshTokenPromise ??= refreshIdentityToken().finally(() => {
    refreshTokenPromise = null;
  });

  return refreshTokenPromise;
}

async function fetchApi<T>(path: string, token = getIdentityToken(), retryOnUnauthorized = true): Promise<T> {
  const response = await fetch(`${apiOrigin()}${path}`, {
    credentials: "include",
    headers: authHeaders(token)
  });

  if (response.status === 401 && retryOnUnauthorized) {
    const refreshedToken = await getRefreshedToken();
    return fetchApi<T>(path, refreshedToken, false);
  }

  if (!response.ok) {
    throw new Error(response.statusText || "Request failed");
  }

  const body = (await response.json()) as T | ApiEnvelope<T>;
  return unwrapApiResponse<T>(body);
}

export async function fetchWorkspaces() {
  return fetchApi<Workspace[]>("/api/v1/user/workspaces");
}

export async function fetchOrganizations() {
  return fetchApi<Organization[]>("/api/v1/organizations?isSsoFirstLogin=false");
}

export async function fetchProjects() {
  const projects = await fetchApi<Project[]>("/api/v1/projects");
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

export function inferEnvironmentType(environment: Pick<Environment, "name" | "key">): Environment["type"] {
  const value = `${environment.name} ${environment.key ?? ""}`.toLowerCase();
  if (value.includes("prod") || value.includes("生产")) {
    return "prod";
  }

  if (value.includes("stag") || value.includes("qa") || value.includes("预发")) {
    return "staging";
  }

  return "dev";
}

export function normalizeProjects(projects: Project[]) {
  return projects.map((project) => ({
    ...project,
    environments: project.environments.map((environment) => ({
      ...environment,
      type: environment.type ?? inferEnvironmentType(environment)
    }))
  }));
}

function projectEnvFromSelection(project: Project, environment: Environment): ProjectEnv {
  return {
    projectId: project.id,
    projectName: project.name,
    projectKey: project.key,
    envId: environment.id,
    envKey: environment.key ?? "",
    envName: environment.name,
    envSecrets: environment.secrets ?? [],
    envSettings: environment.settings ?? {}
  };
}

export function chooseWorkspace(workspaces: Workspace[]) {
  const currentWorkspace = getCurrentWorkspace();
  return workspaces.find((workspace) => workspace.id === currentWorkspace.id) ?? workspaces[0] ?? currentWorkspace;
}

export function chooseOrganization(organizations: Organization[]) {
  const currentOrganization = getCurrentOrganization();
  return organizations.find((organization) => organization.id === currentOrganization.id) ?? organizations[0] ?? currentOrganization;
}

export function chooseProjectEnv(projects: Project[]) {
  const currentProjectEnv = getCurrentProjectEnv();
  const currentProject = projects.find((project) => project.id === currentProjectEnv.projectId);
  const currentEnvironment = currentProject?.environments.find((environment) => environment.id === currentProjectEnv.envId);

  if (currentProject && currentEnvironment) {
    return projectEnvFromSelection(currentProject, currentEnvironment);
  }

  const firstProject = projects[0];
  const firstEnvironment = firstProject?.environments[0];
  if (firstProject && firstEnvironment) {
    return projectEnvFromSelection(firstProject, firstEnvironment);
  }

  return currentProjectEnv;
}

export function persistCurrentWorkspace(workspace: Workspace) {
  saveCurrentWorkspace(workspace);
}

export function persistCurrentOrganization(organization: Organization) {
  saveCurrentOrganization(organization);
}

export function PlanBadge({ lang, workspace }: { lang: Lang; workspace: Workspace }) {
  const { t } = useTranslation();
  const badge = planBadgeState(workspace, lang);
  const plan = badge.plan.startsWith("layout.") ? t(badge.plan) : badge.plan;
  const label = badge.labelKey === "layout.plan.expiringSoon"
    ? t(badge.labelKey, { days: daysUntilExpiration(parseLicense(workspace.license)) })
    : t(badge.labelKey);

  return (
    <Link
      to={badge.href}
      className="flex h-[46px] min-w-[11.5rem] items-center gap-3 rounded-md border border-border bg-card px-3 text-left shadow-sm transition-colors hover:bg-accent"
      aria-label={t("layout.plan.aria", { label, plan })}
    >
      <Award className={cn("h-5 w-5", badge.warning ? "text-amber-600" : "text-blue-600")} />
      <span className="min-w-0 flex-1 space-y-0.5 leading-tight">
        <span
          className={cn(
            "block text-[0.625rem] font-medium uppercase tracking-normal text-muted-foreground",
            badge.warning && "text-amber-700 dark:text-amber-400"
          )}
        >
          {label}
        </span>
        <span className="block text-[0.8125rem] font-bold leading-snug text-foreground">{plan}</span>
      </span>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );
}

export function ContextBar({
  organization,
  currentProjectEnv,
  projects,
  setCurrentProjectEnv
}: {
  workspace: Workspace;
  organization: Organization;
  currentProjectEnv: ProjectEnv;
  projects: Project[];
  setCurrentProjectEnv: (projectEnv: ProjectEnv) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const groupedEnvironments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return projects
      .map((project) => ({
        ...project,
        environments: project.environments.filter((environment) => {
          const haystack = `${project.name} ${project.key} ${environment.name} ${environment.key ?? ""}`.toLowerCase();
          return haystack.includes(normalizedSearch);
        })
      }))
      .filter((project) => project.environments.length > 0);
  }, [projects, search]);

  function selectEnvironment(project: Project, environment: Environment) {
    const projectEnv = projectEnvFromSelection(project, environment);
    saveCurrentProjectEnv(projectEnv);
    setCurrentProjectEnv(projectEnv);
    void queryClient.invalidateQueries({ predicate: (query) => {
      const key = JSON.stringify(query.queryKey);
      return key.includes("projectId") || key.includes("envId") || key.includes(project.id) || key.includes(environment.id);
    } });
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
      <span className="truncate font-medium">{organization.name}</span>
      <span className="text-muted-foreground">/</span>
      <span className="truncate font-medium">{currentProjectEnv.projectName}</span>
      <span className="text-muted-foreground">/</span>
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" className="h-8 gap-2 px-2">
            {currentProjectEnv.envName}
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80 p-2">
          <div className="flex h-9 items-center gap-2 rounded-md border border-input px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              value={search}
              placeholder={t("layout.context.searchEnvironments")}
              onKeyDown={(event) => event.stopPropagation()}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="mt-2 max-h-72 overflow-y-auto">
            {groupedEnvironments.map((project) => (
              <div key={project.id} className="py-1">
                <DropdownMenuLabel className="flex items-center gap-1.5 px-2 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                  {project.name}
                </DropdownMenuLabel>
                {project.environments.map((environment) => (
                  <DropdownMenuItem
                    key={`${project.id}:${environment.id}`}
                    className="cursor-pointer justify-between pl-5"
                    onSelect={() => selectEnvironment(project, environment)}
                  >
                    <span className="flex min-w-0 items-center">
                      <span className="truncate">{environment.name}</span>
                    </span>
                    {environment.id === currentProjectEnv.envId && project.id === currentProjectEnv.projectId ? (
                      <Check className="h-4 w-4" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="#manage-environments" className="text-muted-foreground">
              {t("layout.context.manageEnvironments")}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
