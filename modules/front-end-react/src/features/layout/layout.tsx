import {
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Award,
  ExternalLink,
  Flag,
  FlaskConical,
  GitPullRequest,
  Globe2,
  Info,
  KeyRound,
  Layers3,
  LifeBuoy,
  LogOut,
  Logs,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  Search,
  ShieldCheck,
  Sun,
  User,
  UserRound,
  UserRoundKey,
  UsersRound,
  Waypoints,
  Webhook
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import { Link, Outlet, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getIdentityToken, getStoredUserProfile, signOut } from "@/features/auth/auth-api";
import { getRuntimeEnv } from "@/lib/env/runtime-env";
import { useTheme } from "@/lib/theme/theme-provider";
import { cn } from "@/lib/utils";

type Lang = "en" | "zh";
type Icon = ComponentType<SVGProps<SVGSVGElement>>;

type NavItem = {
  label: string;
  i18nKey: string;
  href: string;
  icon: Icon;
  active?: boolean;
  children?: NavItem[];
};

type NavGroup = {
  label: string;
  i18nKey: string;
  items: NavItem[];
};

type Environment = {
  id: string;
  projectId: string;
  name: string;
  key?: string;
  secrets?: Secret[];
  settings?: EnvironmentSetting;
  type: "prod" | "staging" | "dev";
};

type Secret = {
  id?: string;
  name: string;
  type: string;
  value: string;
};

type EnvironmentSetting = {
  requireChangeComment?: boolean;
};

type Project = {
  id: string;
  name: string;
  key: string;
  environments: Environment[];
};

type ProjectEnv = {
  projectId: string;
  projectName: string;
  projectKey: string;
  envId: string;
  envKey: string;
  envName: string;
  envSecrets?: Secret[];
  envSettings?: EnvironmentSetting;
};

type Workspace = {
  id: string;
  name: string;
  key: string;
  license?: string;
};

type Organization = {
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

const SIDEBAR_STORAGE_KEY = "featbit:sidebar-collapsed";
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
const fallbackProjects: Project[] = [
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

const navigationGroups: NavGroup[] = [
  {
    label: "Get Started",
    i18nKey: "layout.nav.groups.getStarted",
    items: [{ label: "Get Started", i18nKey: "layout.nav.items.getStarted", href: "/app", icon: Rocket, active: true }]
  },
  {
    label: "Release",
    i18nKey: "layout.nav.groups.release",
    items: [
      { label: "Feature Flags", i18nKey: "layout.nav.items.featureFlags", href: "/app/feature-flags", icon: Flag },
      { label: "Segments", i18nKey: "layout.nav.items.segments", href: "/app/segments", icon: Layers3 },
      { label: "End Users", i18nKey: "layout.nav.items.endUsers", href: "/app/end-users", icon: UsersRound }
    ]
  },
  {
    label: "Governance",
    i18nKey: "layout.nav.groups.governance",
    items: [
      { label: "Audit Logs", i18nKey: "layout.nav.items.auditLogs", href: "/app/audit-logs", icon: Logs },
      { label: "Change Requests", i18nKey: "layout.nav.items.changeRequests", href: "/app/change-requests", icon: GitPullRequest }
    ]
  },
  {
    label: "Experimentation",
    i18nKey: "layout.nav.groups.experimentation",
    items: [
      { label: "Experiments", i18nKey: "layout.nav.items.experiments", href: "/app/experiments", icon: FlaskConical },
      { label: "Metrics", i18nKey: "layout.nav.items.metrics", href: "/app/metrics", icon: BarChart3 }
    ]
  },
  {
    label: "Integrations",
    i18nKey: "layout.nav.groups.integrations",
    items: [
      { label: "Relay Proxies", i18nKey: "layout.nav.items.relayProxies", href: "/app/relay-proxies", icon: Waypoints },
      { label: "WebHooks", i18nKey: "layout.nav.items.webhooks", href: "/app/webhooks", icon: Webhook },
      { label: "Access Tokens", i18nKey: "layout.nav.items.accessTokens", href: "/app/access-tokens", icon: KeyRound }
    ]
  },
  {
    label: "Admin",
    i18nKey: "layout.nav.groups.admin",
    items: [
      { label: "Workspace", i18nKey: "layout.nav.items.workspace", href: "/app/workspace", icon: Building2 },
      { label: "Organization", i18nKey: "layout.nav.items.organization", href: "/app/organization", icon: Boxes },
      {
        label: "IAM",
        i18nKey: "layout.nav.items.iam",
        href: "/app/iam",
        icon: ShieldCheck,
        children: [
          { label: "Teams", i18nKey: "layout.nav.items.teams", href: "/app/iam/teams", icon: UserRound },
          { label: "Groups", i18nKey: "layout.nav.items.groups", href: "/app/iam/groups", icon: UsersRound },
          { label: "Policies", i18nKey: "layout.nav.items.policies", href: "/app/iam/policies", icon: UserRoundKey }
        ]
      }
    ]
  }
];

function resolveLang(value: string | undefined): Lang {
  return value === "zh" ? "zh" : "en";
}

function localizedPath(lang: Lang, href: string) {
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

function getCurrentWorkspace() {
  return readStorageObject<Workspace>(scopedStorageKey("current-workspace")) ?? fallbackWorkspace;
}

function getCurrentOrganization() {
  return readStorageObject<Organization>(scopedStorageKey("current-organization")) ?? fallbackOrganization;
}

function getCurrentProjectEnv() {
  return readStorageObject<ProjectEnv>(scopedStorageKey("current-project")) ?? fallbackProjectEnv;
}

function saveCurrentProjectEnv(projectEnv: ProjectEnv) {
  localStorage.setItem(scopedStorageKey("current-project"), JSON.stringify(projectEnv));
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
      href: localizedPath(lang, "/app/workspace/billing")
    };
  }

  if (license && plan) {
    if (isExpired(license)) {
      return {
        labelKey: "layout.plan.expired",
        plan: displayPlan(plan),
        warning: true,
        href: localizedPath(lang, "/app/workspace/license")
      };
    }

    if (isExpiringSoon(license)) {
      return {
        labelKey: "layout.plan.expiringSoon",
        plan: displayPlan(plan),
        warning: true,
        href: localizedPath(lang, "/app/workspace/license")
      };
    }

    return {
      labelKey: "layout.plan.current",
      plan: displayPlan(plan),
      warning: false,
      href: localizedPath(lang, "/app/workspace/license")
    };
  }

  return {
    labelKey: "layout.plan.upgradeNow",
    plan: "layout.plan.getEnterprise",
    warning: false,
    href: localizedPath(lang, "/app/workspace/license")
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

async function fetchWorkspaces() {
  return fetchApi<Workspace[]>("/api/v1/user/workspaces");
}

async function fetchOrganizations() {
  return fetchApi<Organization[]>("/api/v1/organizations?isSsoFirstLogin=false");
}

async function fetchProjects() {
  const projects = await fetchApi<Project[]>("/api/v1/projects");
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

function inferEnvironmentType(environment: Pick<Environment, "name" | "key">): Environment["type"] {
  const value = `${environment.name} ${environment.key ?? ""}`.toLowerCase();
  if (value.includes("prod") || value.includes("生产")) {
    return "prod";
  }

  if (value.includes("stag") || value.includes("qa") || value.includes("预发")) {
    return "staging";
  }

  return "dev";
}

function normalizeProjects(projects: Project[]) {
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

function chooseWorkspace(workspaces: Workspace[]) {
  const currentWorkspace = getCurrentWorkspace();
  return workspaces.find((workspace) => workspace.id === currentWorkspace.id) ?? workspaces[0] ?? currentWorkspace;
}

function chooseOrganization(organizations: Organization[]) {
  const currentOrganization = getCurrentOrganization();
  return organizations.find((organization) => organization.id === currentOrganization.id) ?? organizations[0] ?? currentOrganization;
}

function chooseProjectEnv(projects: Project[]) {
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

function FeatBitBrand({ collapsed }: { collapsed: boolean }) {
  const { resolvedTheme } = useTheme();
  const logoSrc = resolvedTheme === "dark" ? "/assets/featbit-logo-dark.svg" : "/assets/featbit-logo.svg";

  return (
    <Link
      to="/"
      className={cn("flex h-12 items-center gap-3 rounded-md px-2 text-foreground", collapsed && "justify-center px-0")}
      aria-label="FeatBit"
    >
      <img className="h-9 w-10 shrink-0" src={logoSrc} alt="" />
      {!collapsed ? <span className="text-xl font-semibold tracking-tight">FeatBit</span> : null}
    </Link>
  );
}

function SidebarNavLink({
  item,
  lang,
  collapsed,
  secondary = false,
  t
}: {
  item: NavItem;
  lang: Lang;
  collapsed: boolean;
  secondary?: boolean;
  t: (key: string) => string;
}) {
  const Icon = item.icon;
  const label = t(item.i18nKey);
  const content = (
    <Link
      to={localizedPath(lang, item.href)}
      className={cn(
        "flex h-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        secondary && "h-8 pl-9 text-xs",
        item.active && "bg-accent text-foreground",
        collapsed && "justify-center px-0"
      )}
      aria-label={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );

  if (!collapsed) {
    return content;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function SidebarNavItem({
  item,
  lang,
  collapsed,
  expanded,
  onToggle,
  t
}: {
  item: NavItem;
  lang: Lang;
  collapsed: boolean;
  expanded: boolean;
  onToggle: () => void;
  t: (key: string) => string;
}) {
  const Icon = item.icon;
  const label = t(item.i18nKey);

  if (!item.children?.length) {
    return <SidebarNavLink item={item} lang={lang} collapsed={collapsed} t={t} />;
  }

  const parentButton = (
    <button
      type="button"
      className={cn(
        "flex h-9 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        collapsed && "justify-center px-0"
      )}
      aria-expanded={expanded}
      aria-label={collapsed ? label : undefined}
      onClick={onToggle}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed ? <span className="min-w-0 flex-1 truncate text-left">{label}</span> : null}
      {!collapsed ? (
        expanded ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        )
      ) : null}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{parentButton}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="space-y-1">
      {parentButton}
      {expanded ? (
        <div className="space-y-1">
          {item.children.map((child) => (
            <SidebarNavLink key={child.label} item={child} lang={lang} collapsed={false} secondary t={t} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Sidebar({
  lang,
  collapsed,
  setCollapsed
}: {
  lang: Lang;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}) {
  const { t } = useTranslation();
  const [expandedNav, setExpandedNav] = useState<Record<string, boolean>>({
    Integrations: true
  });

  function toggleNavItem(label: string) {
    setExpandedNav((current) => ({
      ...current,
      [label]: !current[label]
    }));
  }

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200",
        collapsed ? "w-[4.5rem]" : "w-64"
      )}
    >
      <div className="flex h-16 items-center justify-between px-3">
        <FeatBitBrand collapsed={collapsed} />
        {!collapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={t("layout.sidebar.collapse")}
            onClick={() => setCollapsed(true)}
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {collapsed ? (
        <div className="flex justify-center px-3 pb-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={t("layout.sidebar.expand")}
            onClick={() => setCollapsed(false)}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-5">
          {navigationGroups.map((group) => (
            <section key={group.label} className="space-y-1">
              {!collapsed ? (
                <h2 className="px-3 pb-1 text-[0.68rem] font-medium uppercase tracking-normal text-muted-foreground">
                  {t(group.i18nKey)}
                </h2>
              ) : null}
              {group.items.map((item) => (
                <SidebarNavItem
                  key={item.label}
                  item={item}
                  lang={lang}
                  collapsed={collapsed}
                  expanded={Boolean(expandedNav[item.label])}
                  onToggle={() => toggleNavItem(item.label)}
                  t={t}
                />
              ))}
            </section>
          ))}
        </div>
      </nav>

      <AccountMenu lang={lang} collapsed={collapsed} />
    </aside>
  );
}

function PlanBadge({ lang, workspace }: { lang: Lang; workspace: Workspace }) {
  const { t } = useTranslation();
  const badge = planBadgeState(workspace, lang);
  const plan = badge.plan.startsWith("layout.") ? t(badge.plan) : badge.plan;
  const label = badge.labelKey === "layout.plan.expiringSoon"
    ? t(badge.labelKey, { days: daysUntilExpiration(parseLicense(workspace.license)) })
    : t(badge.labelKey);

  return (
    <Link
      to={badge.href}
      className="flex h-[50px] min-w-[11.5rem] items-center gap-3 rounded-md border border-border bg-card px-3 text-left shadow-sm transition-colors hover:bg-accent"
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

function EnvironmentDot({ type }: { type: Environment["type"] }) {
  const className = {
    prod: "bg-emerald-500",
    staging: "bg-amber-500",
    dev: "bg-sky-500"
  }[type];

  return <span className={cn("h-2 w-2 rounded-full", className)} />;
}

function ContextBar({
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
      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate font-medium">{organization.name}</span>
      <span className="text-muted-foreground">/</span>
      <span className="truncate font-medium">{currentProjectEnv.projectName}</span>
      <span className="text-muted-foreground">/</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" className="h-8 gap-2 px-2">
            <EnvironmentDot type={inferEnvironmentType({ name: currentProjectEnv.envName, key: currentProjectEnv.envKey })} />
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
                <DropdownMenuLabel>{project.name}</DropdownMenuLabel>
                {project.environments.map((environment) => (
                  <DropdownMenuItem
                    key={`${project.id}:${environment.id}`}
                    className="cursor-pointer justify-between"
                    onSelect={() => selectEnvironment(project, environment)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <EnvironmentDot type={environment.type} />
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

function AccountMenu({ lang, collapsed }: { lang: Lang; collapsed: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const profile = getStoredUserProfile();
  const name = profile.name || "Test User";
  const email = profile.email || "test@featbit.com";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
  const version = getRuntimeEnv().version;
  const languageLabel = lang === "zh" ? "ZH" : "EN";
  const themeLabel = resolvedTheme === "dark" ? t("layout.account.theme.dark") : t("layout.account.theme.light");

  function changeLanguage(nextLang: Lang) {
    const nextPath = window.location.pathname.replace(/^\/(en|zh)/, `/${nextLang}`);
    navigate(`${nextPath}${window.location.search}`);
  }

  function handleSignOut() {
    signOut();
    navigate(`/${lang}/login`, { replace: true });
  }

  const trigger = (
    <button
      type="button"
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent",
        collapsed && "justify-center"
      )}
      aria-label={t("layout.account.account")}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium">
        {initials}
      </span>
      {!collapsed ? (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">{email}</span>
        </span>
      ) : null}
      {!collapsed ? (
        accountMenuOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )
      ) : null}
    </button>
  );

  return (
    <div className="border-t border-border p-3">
      <DropdownMenu open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">{t("layout.account.account")}</TooltipContent>
          </Tooltip>
        ) : (
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        )}
        <DropdownMenuContent
          align="start"
          side="right"
          sideOffset={10}
          className="w-[226px] rounded-lg border-border/80 bg-popover p-0 text-popover-foreground shadow-lg"
        >
          <div className="p-3 pb-2">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                {initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-5 text-foreground">{name}</span>
                <span className="block truncate text-xs leading-4 text-muted-foreground">{email}</span>
              </span>
            </div>
          </div>
          <DropdownMenuSeparator className="mx-3 my-0" />
          <div className="p-2">
            <DropdownMenuItem className="h-8 cursor-pointer gap-3 rounded-md px-2 text-sm font-medium">
              <User className="h-4 w-4 text-muted-foreground" />
              {t("layout.account.profile")}
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="h-8 cursor-pointer gap-3 rounded-md px-2 text-sm font-medium">
              <a href="https://support.featbit.ai" target="_blank" rel="noreferrer">
                <LifeBuoy className="h-4 w-4 text-muted-foreground" />
                {t("layout.account.support")}
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="h-8 cursor-pointer gap-3 rounded-md px-2 text-sm font-medium">
              <a href="https://docs.featbit.co" target="_blank" rel="noreferrer">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                {t("layout.account.documentation")}
              </a>
            </DropdownMenuItem>
          </div>
          <DropdownMenuSeparator className="mx-3 my-0" />
          <div className="p-2">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-8 cursor-pointer gap-3 rounded-md px-2 text-sm font-medium">
                <Globe2 className="h-4 w-4 text-muted-foreground" />
                <span>{t("layout.account.language")}</span>
                <span className="ml-auto text-xs font-medium text-muted-foreground">{languageLabel}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-36 rounded-lg">
                <DropdownMenuRadioGroup value={lang} onValueChange={(value) => changeLanguage(resolveLang(value))}>
                  <DropdownMenuRadioItem value="en" className="cursor-pointer">{t("layout.account.english")}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="zh" className="cursor-pointer">{t("layout.account.chinese")}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-8 cursor-pointer gap-3 rounded-md px-2 text-sm font-medium">
                {resolvedTheme === "dark" ? (
                  <Moon className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Sun className="h-4 w-4 text-muted-foreground" />
                )}
                <span>{t("layout.account.theme.label")}</span>
                <span className="ml-auto text-xs font-medium text-muted-foreground">{themeLabel}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-36 rounded-lg">
                <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as "light" | "dark" | "system")}>
                  <DropdownMenuRadioItem value="light" className="cursor-pointer">{t("layout.account.theme.light")}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark" className="cursor-pointer">{t("layout.account.theme.dark")}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system" className="cursor-pointer">{t("layout.account.theme.system")}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </div>
          <DropdownMenuSeparator className="mx-3 my-0" />
          <div className="p-2">
            <DropdownMenuItem asChild className="h-8 cursor-pointer justify-between rounded-md px-2 text-sm font-medium">
              <a href="https://github.com/featbit/featbit" target="_blank" rel="noreferrer">
                <span className="flex items-center gap-3">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  {t("layout.account.version", { version })}
                </span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            </DropdownMenuItem>
          </div>
          <DropdownMenuSeparator className="mx-3 my-0" />
          <div className="p-2">
            <DropdownMenuItem className="h-8 cursor-pointer gap-3 rounded-md px-2 text-sm font-semibold text-destructive focus:text-destructive" onSelect={handleSignOut}>
              <LogOut className="h-4 w-4" />
              {t("layout.account.signOut")}
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function EmptyWorkspace() {
  const { t } = useTranslation();

  return (
    <section className="h-full rounded-md border border-dashed border-border bg-card/50 p-6">
      <div className="flex h-full min-h-[24rem] items-center justify-center text-sm text-muted-foreground">
        {t("layout.placeholder")}
      </div>
    </section>
  );
}

export function Layout() {
  const params = useParams();
  const lang = resolveLang(params.lang);
  const { i18n } = useTranslation();
  const [collapsed, setCollapsedState] = useState(() => localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
  const [workspace, setWorkspace] = useState(() => getCurrentWorkspace());
  const [organization, setOrganization] = useState(() => getCurrentOrganization());
  const [currentProjectEnv, setCurrentProjectEnv] = useState(() => getCurrentProjectEnv());
  const [projects, setProjects] = useState<Project[]>(() => normalizeProjects(fallbackProjects));

  function setCollapsed(nextCollapsed: boolean) {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextCollapsed));
    setCollapsedState(nextCollapsed);
  }

  useEffect(() => {
    void i18n.changeLanguage(lang);
  }, [i18n, lang]);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      try {
        const loadedWorkspaces = await fetchWorkspaces();
        if (cancelled) {
          return;
        }

        if (loadedWorkspaces.length > 0) {
          const nextWorkspace = chooseWorkspace(loadedWorkspaces);
          localStorage.setItem(scopedStorageKey("current-workspace"), JSON.stringify(nextWorkspace));
          setWorkspace(nextWorkspace);
        }

        const loadedOrganizations = await fetchOrganizations();
        if (cancelled) {
          return;
        }

        if (loadedOrganizations.length > 0) {
          const nextOrganization = chooseOrganization(loadedOrganizations);
          localStorage.setItem(scopedStorageKey("current-organization"), JSON.stringify(nextOrganization));
          setOrganization(nextOrganization);
        }

        const loadedProjects = await fetchProjects();
        if (cancelled) {
          return;
        }

        if (loadedProjects.length > 0) {
          const normalizedProjects = normalizeProjects(loadedProjects);
          const nextProjectEnv = chooseProjectEnv(normalizedProjects);
          saveCurrentProjectEnv(nextProjectEnv);
          setProjects(normalizedProjects);
          setCurrentProjectEnv(nextProjectEnv);
        }
      } catch {
        if (!cancelled) {
          setProjects(normalizeProjects(fallbackProjects));
        }
      }
    }

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar lang={lang} collapsed={collapsed} setCollapsed={setCollapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background px-5">
            <ContextBar
              workspace={workspace}
              organization={organization}
              currentProjectEnv={currentProjectEnv}
              projects={projects}
              setCurrentProjectEnv={setCurrentProjectEnv}
            />
            <PlanBadge lang={lang} workspace={workspace} />
          </header>
          <main className="min-h-0 flex-1 bg-muted/30 p-5">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

export function LayoutPlaceholder() {
  return <EmptyWorkspace />;
}
