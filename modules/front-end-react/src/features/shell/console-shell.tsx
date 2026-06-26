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
import { getStoredUserProfile, signOut } from "@/features/auth/auth-api";
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
  projectName: string;
  name: string;
  i18nKey: string;
  type: "prod" | "staging" | "dev";
};

const SIDEBAR_STORAGE_KEY = "featbit:sidebar-collapsed";
const PROJECT_STORAGE_KEY = "featbit:current-project-id";
const ENVIRONMENT_STORAGE_KEY = "featbit:current-environment-id";

const environments: Environment[] = [
  { id: "prod", projectId: "growth", projectName: "Growth Platform", name: "Production", i18nKey: "shell.environment.production", type: "prod" },
  { id: "staging", projectId: "growth", projectName: "Growth Platform", name: "Staging", i18nKey: "shell.environment.staging", type: "staging" },
  { id: "dev", projectId: "growth", projectName: "Growth Platform", name: "Development", i18nKey: "shell.environment.development", type: "dev" },
  { id: "commerce-prod", projectId: "commerce", projectName: "Commerce Apps", name: "Production", i18nKey: "shell.environment.production", type: "prod" },
  { id: "commerce-dev", projectId: "commerce", projectName: "Commerce Apps", name: "Development", i18nKey: "shell.environment.development", type: "dev" }
];

const navigationGroups: NavGroup[] = [
  {
    label: "Get Started",
    i18nKey: "shell.nav.groups.getStarted",
    items: [{ label: "Get Started", i18nKey: "shell.nav.items.getStarted", href: "/app", icon: Rocket, active: true }]
  },
  {
    label: "Release",
    i18nKey: "shell.nav.groups.release",
    items: [
      { label: "Feature Flags", i18nKey: "shell.nav.items.featureFlags", href: "/app/feature-flags", icon: Flag },
      { label: "Segments", i18nKey: "shell.nav.items.segments", href: "/app/segments", icon: Layers3 },
      { label: "End Users", i18nKey: "shell.nav.items.endUsers", href: "/app/end-users", icon: UsersRound }
    ]
  },
  {
    label: "Governance",
    i18nKey: "shell.nav.groups.governance",
    items: [
      { label: "Audit Logs", i18nKey: "shell.nav.items.auditLogs", href: "/app/audit-logs", icon: Logs },
      { label: "Change Requests", i18nKey: "shell.nav.items.changeRequests", href: "/app/change-requests", icon: GitPullRequest }
    ]
  },
  {
    label: "Experimentation",
    i18nKey: "shell.nav.groups.experimentation",
    items: [
      { label: "Experiments", i18nKey: "shell.nav.items.experiments", href: "/app/experiments", icon: FlaskConical },
      { label: "Metrics", i18nKey: "shell.nav.items.metrics", href: "/app/metrics", icon: BarChart3 }
    ]
  },
  {
    label: "Integrations",
    i18nKey: "shell.nav.groups.integrations",
    items: [
      { label: "Relay Proxies", i18nKey: "shell.nav.items.relayProxies", href: "/app/relay-proxies", icon: Waypoints },
      { label: "WebHooks", i18nKey: "shell.nav.items.webhooks", href: "/app/webhooks", icon: Webhook },
      { label: "Access Tokens", i18nKey: "shell.nav.items.accessTokens", href: "/app/access-tokens", icon: KeyRound }
    ]
  },
  {
    label: "Admin",
    i18nKey: "shell.nav.groups.admin",
    items: [
      { label: "Workspace", i18nKey: "shell.nav.items.workspace", href: "/app/workspace", icon: Building2 },
      { label: "Organization", i18nKey: "shell.nav.items.organization", href: "/app/organization", icon: Boxes },
      {
        label: "IAM",
        i18nKey: "shell.nav.items.iam",
        href: "/app/iam",
        icon: ShieldCheck,
        children: [
          { label: "Teams", i18nKey: "shell.nav.items.teams", href: "/app/iam/teams", icon: UserRound },
          { label: "Groups", i18nKey: "shell.nav.items.groups", href: "/app/iam/groups", icon: UsersRound },
          { label: "Policies", i18nKey: "shell.nav.items.policies", href: "/app/iam/policies", icon: UserRoundKey }
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
            aria-label={t("shell.sidebar.collapse")}
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
            aria-label={t("shell.sidebar.expand")}
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

function PlanBadge() {
  const { t } = useTranslation();

  return (
    <Link
      to="#billing"
      className="flex h-11 items-center gap-3 rounded-md border border-border bg-card px-3 text-left shadow-sm transition-colors hover:bg-accent"
      aria-label={t("shell.plan.aria", { plan: "Pro" })}
    >
      <Award className="h-5 w-5 text-blue-600" />
      <span className="leading-tight">
        <span className="block text-xs font-medium text-foreground">{t("shell.plan.current")}</span>
        <span className="block text-[0.68rem] font-semibold text-foreground">Pro</span>
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

function ContextBar({ selectedEnvironment, setSelectedEnvironment }: {
  selectedEnvironment: Environment;
  setSelectedEnvironment: (environment: Environment) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const groupedEnvironments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = environments.filter((environment) => {
      const haystack = `${environment.projectName} ${environment.name}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });

    return filtered.reduce<Record<string, Environment[]>>((groups, environment) => {
      groups[environment.projectName] = [...(groups[environment.projectName] ?? []), environment];
      return groups;
    }, {});
  }, [search]);

  function selectEnvironment(environment: Environment) {
    localStorage.setItem(PROJECT_STORAGE_KEY, environment.projectId);
    localStorage.setItem(ENVIRONMENT_STORAGE_KEY, environment.id);
    setSelectedEnvironment(environment);
    void queryClient.invalidateQueries({ predicate: (query) => {
      const key = JSON.stringify(query.queryKey);
      return key.includes("projectId") || key.includes("envId") || key.includes(environment.projectId) || key.includes(environment.id);
    } });
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate font-medium">Acme Corp</span>
      <span className="text-muted-foreground">/</span>
      <span className="truncate font-medium">{selectedEnvironment.projectName}</span>
      <span className="text-muted-foreground">/</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" className="h-8 gap-2 px-2">
            <EnvironmentDot type={selectedEnvironment.type} />
            {t(selectedEnvironment.i18nKey)}
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80 p-2">
          <div className="flex h-9 items-center gap-2 rounded-md border border-input px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              value={search}
              placeholder={t("shell.context.searchEnvironments")}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="mt-2 max-h-72 overflow-y-auto">
            {Object.entries(groupedEnvironments).map(([projectName, projectEnvironments]) => (
              <div key={projectName} className="py-1">
                <DropdownMenuLabel>{projectName}</DropdownMenuLabel>
                {projectEnvironments.map((environment) => (
                  <DropdownMenuItem
                    key={`${environment.projectId}:${environment.id}`}
                    className="justify-between"
                    onSelect={() => selectEnvironment(environment)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <EnvironmentDot type={environment.type} />
                      <span className="truncate">{t(environment.i18nKey)}</span>
                    </span>
                    {environment.id === selectedEnvironment.id && environment.projectId === selectedEnvironment.projectId ? (
                      <Check className="h-4 w-4" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="#manage-environments" className="text-muted-foreground">
              {t("shell.context.manageEnvironments")}
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
  const themeLabel = resolvedTheme === "dark" ? t("shell.account.theme.dark") : t("shell.account.theme.light");

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
      aria-label={t("shell.account.account")}
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
            <TooltipContent side="right">{t("shell.account.account")}</TooltipContent>
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
            <DropdownMenuItem className="h-8 gap-3 rounded-md px-2 text-sm font-medium">
              <User className="h-4 w-4 text-muted-foreground" />
              {t("shell.account.profile")}
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="h-8 gap-3 rounded-md px-2 text-sm font-medium">
              <a href="https://support.featbit.ai" target="_blank" rel="noreferrer">
                <LifeBuoy className="h-4 w-4 text-muted-foreground" />
                {t("shell.account.support")}
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="h-8 gap-3 rounded-md px-2 text-sm font-medium">
              <a href="https://docs.featbit.co" target="_blank" rel="noreferrer">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                {t("shell.account.documentation")}
              </a>
            </DropdownMenuItem>
          </div>
          <DropdownMenuSeparator className="mx-3 my-0" />
          <div className="p-2">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-8 gap-3 rounded-md px-2 text-sm font-medium">
                <Globe2 className="h-4 w-4 text-muted-foreground" />
                <span>{t("shell.account.language")}</span>
                <span className="ml-auto text-xs font-medium text-muted-foreground">{languageLabel}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-36 rounded-lg">
                <DropdownMenuRadioGroup value={lang} onValueChange={(value) => changeLanguage(resolveLang(value))}>
                  <DropdownMenuRadioItem value="en">{t("shell.account.english")}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="zh">{t("shell.account.chinese")}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-8 gap-3 rounded-md px-2 text-sm font-medium">
                {resolvedTheme === "dark" ? (
                  <Moon className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Sun className="h-4 w-4 text-muted-foreground" />
                )}
                <span>{t("shell.account.theme.label")}</span>
                <span className="ml-auto text-xs font-medium text-muted-foreground">{themeLabel}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-36 rounded-lg">
                <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as "light" | "dark" | "system")}>
                  <DropdownMenuRadioItem value="light">{t("shell.account.theme.light")}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">{t("shell.account.theme.dark")}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">{t("shell.account.theme.system")}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </div>
          <DropdownMenuSeparator className="mx-3 my-0" />
          <div className="p-2">
            <DropdownMenuItem asChild className="h-8 justify-between rounded-md px-2 text-sm font-medium">
              <a href="https://github.com/featbit/featbit" target="_blank" rel="noreferrer">
                <span className="flex items-center gap-3">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  {t("shell.account.version", { version })}
                </span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            </DropdownMenuItem>
          </div>
          <DropdownMenuSeparator className="mx-3 my-0" />
          <div className="p-2">
            <DropdownMenuItem className="h-8 gap-3 rounded-md px-2 text-sm font-semibold text-destructive focus:text-destructive" onSelect={handleSignOut}>
              <LogOut className="h-4 w-4" />
              {t("shell.account.signOut")}
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
        {t("shell.placeholder")}
      </div>
    </section>
  );
}

export function ConsoleShell() {
  const params = useParams();
  const lang = resolveLang(params.lang);
  const { i18n } = useTranslation();
  const [collapsed, setCollapsedState] = useState(() => localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
  const [selectedEnvironment, setSelectedEnvironment] = useState(() => {
    const projectId = localStorage.getItem(PROJECT_STORAGE_KEY);
    const environmentId = localStorage.getItem(ENVIRONMENT_STORAGE_KEY);
    return (
      environments.find((environment) => environment.projectId === projectId && environment.id === environmentId) ??
      environments[0]
    );
  });

  function setCollapsed(nextCollapsed: boolean) {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextCollapsed));
    setCollapsedState(nextCollapsed);
  }

  useEffect(() => {
    void i18n.changeLanguage(lang);
  }, [i18n, lang]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar lang={lang} collapsed={collapsed} setCollapsed={setCollapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background px-5">
            <ContextBar selectedEnvironment={selectedEnvironment} setSelectedEnvironment={setSelectedEnvironment} />
            <PlanBadge />
          </header>
          <main className="min-h-0 flex-1 bg-muted/30 p-5">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

export function ConsoleShellPlaceholder() {
  return <EmptyWorkspace />;
}
