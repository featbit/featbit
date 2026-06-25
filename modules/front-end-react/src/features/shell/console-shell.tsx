import {
  Activity,
  BarChart3,
  BellRing,
  BookOpen,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  CircleDollarSign,
  ExternalLink,
  Flag,
  Gauge,
  GitPullRequest,
  Globe2,
  Info,
  KeyRound,
  Layers3,
  LifeBuoy,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Puzzle,
  Search,
  ShieldCheck,
  Sun,
  User,
  UsersRound
} from "lucide-react";
import { useMemo, useState, type ComponentType, type SVGProps } from "react";
import { Link, Outlet, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
  href: string;
  icon: Icon;
  active?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

type Environment = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  type: "prod" | "staging" | "dev";
};

const SIDEBAR_STORAGE_KEY = "featbit:sidebar-collapsed";
const PROJECT_STORAGE_KEY = "featbit:current-project-id";
const ENVIRONMENT_STORAGE_KEY = "featbit:current-environment-id";

const environments: Environment[] = [
  { id: "prod", projectId: "growth", projectName: "Growth Platform", name: "Production", type: "prod" },
  { id: "staging", projectId: "growth", projectName: "Growth Platform", name: "Staging", type: "staging" },
  { id: "dev", projectId: "growth", projectName: "Growth Platform", name: "Development", type: "dev" },
  { id: "commerce-prod", projectId: "commerce", projectName: "Commerce Apps", name: "Production", type: "prod" },
  { id: "commerce-dev", projectId: "commerce", projectName: "Commerce Apps", name: "Development", type: "dev" }
];

const navigationGroups: NavGroup[] = [
  {
    label: "Get Started",
    items: [{ label: "Overview", href: "/app", icon: Gauge, active: true }]
  },
  {
    label: "Release",
    items: [
      { label: "Feature Flags", href: "/app/feature-flags", icon: Flag },
      { label: "Segments", href: "/app/segments", icon: Layers3 },
      { label: "End Users", href: "/app/end-users", icon: UsersRound }
    ]
  },
  {
    label: "Experimentation",
    items: [
      { label: "Experiments", href: "/app/experiments", icon: Activity },
      { label: "Metrics", href: "/app/metrics", icon: BarChart3 }
    ]
  },
  {
    label: "Governance",
    items: [
      { label: "Audit Logs", href: "/app/audit-logs", icon: ShieldCheck },
      { label: "Change Requests", href: "/app/change-requests", icon: GitPullRequest }
    ]
  },
  {
    label: "Admin",
    items: [
      { label: "Workspace", href: "/app/workspace", icon: Building2 },
      { label: "Organization", href: "/app/organization", icon: Boxes },
      { label: "IAM", href: "/app/iam", icon: KeyRound },
      { label: "Relay Proxies", href: "/app/relay-proxies", icon: BellRing },
      { label: "Integrations", href: "/app/integrations", icon: Puzzle }
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
  return (
    <Link
      to="/"
      className={cn("flex h-12 items-center gap-3 rounded-md px-2 text-foreground", collapsed && "justify-center px-0")}
      aria-label="FeatBit"
    >
      <img className="h-9 w-10 shrink-0" src="/assets/featbit-logo.svg" alt="" />
      {!collapsed ? <span className="text-xl font-semibold tracking-tight">FeatBit</span> : null}
    </Link>
  );
}

function SidebarNavItem({ item, lang, collapsed }: { item: NavItem; lang: Lang; collapsed: boolean }) {
  const Icon = item.icon;
  const content = (
    <Link
      to={localizedPath(lang, item.href)}
      className={cn(
        "flex h-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        item.active && "bg-accent text-foreground",
        collapsed && "justify-center px-0"
      )}
      aria-label={collapsed ? item.label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );

  if (!collapsed) {
    return content;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
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
            aria-label="Collapse sidebar"
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
            aria-label="Expand sidebar"
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
                  {group.label}
                </h2>
              ) : null}
              {group.items.map((item) => (
                <SidebarNavItem key={item.label} item={item} lang={lang} collapsed={collapsed} />
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
  return (
    <Link
      to="#billing"
      className="flex h-11 items-center gap-3 rounded-md border border-border bg-card px-3 text-left shadow-sm transition-colors hover:bg-accent"
      aria-label="Free Plan, Upgrade Now"
    >
      <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
      <span className="leading-tight">
        <span className="block text-xs font-medium text-foreground">Free Plan</span>
        <span className="block text-[0.68rem] text-muted-foreground">Upgrade Now</span>
      </span>
      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
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
            {selectedEnvironment.name}
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80 p-2">
          <div className="flex h-9 items-center gap-2 rounded-md border border-input px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              value={search}
              placeholder="Search environments"
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
                      <span className="truncate">{environment.name}</span>
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
              Manage environments
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function AccountMenu({ lang, collapsed }: { lang: Lang; collapsed: boolean }) {
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
  const themeLabel = resolvedTheme === "dark" ? "Dark" : "Light";

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
        "flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent",
        collapsed && "justify-center"
      )}
      aria-label="Account"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-sm font-medium">
        {collapsed ? initials : <User className="h-4 w-4" />}
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
            <TooltipContent side="right">Account</TooltipContent>
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
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="h-8 gap-3 rounded-md px-2 text-sm font-medium">
              <a href="https://github.com/featbit/featbit/issues" target="_blank" rel="noreferrer">
                <LifeBuoy className="h-4 w-4 text-muted-foreground" />
                Support
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="h-8 gap-3 rounded-md px-2 text-sm font-medium">
              <a href="https://docs.featbit.co" target="_blank" rel="noreferrer">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                Documentation
              </a>
            </DropdownMenuItem>
          </div>
          <DropdownMenuSeparator className="mx-3 my-0" />
          <div className="p-2">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-8 gap-3 rounded-md px-2 text-sm font-medium">
                <Globe2 className="h-4 w-4 text-muted-foreground" />
                <span>Language</span>
                <span className="ml-auto text-xs font-medium text-muted-foreground">{languageLabel}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-36 rounded-lg">
                <DropdownMenuRadioGroup value={lang} onValueChange={(value) => changeLanguage(resolveLang(value))}>
                  <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="zh">Chinese</DropdownMenuRadioItem>
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
                <span>Theme</span>
                <span className="ml-auto text-xs font-medium text-muted-foreground">{themeLabel}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-36 rounded-lg">
                <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as "light" | "dark" | "system")}>
                  <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
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
                  Version: {version}
                </span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            </DropdownMenuItem>
          </div>
          <DropdownMenuSeparator className="mx-3 my-0" />
          <div className="p-2">
            <DropdownMenuItem className="h-8 gap-3 rounded-md px-2 text-sm font-semibold text-destructive focus:text-destructive" onSelect={handleSignOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function EmptyWorkspace() {
  return (
    <section className="h-full rounded-md border border-dashed border-border bg-card/50 p-6">
      <div className="flex h-full min-h-[24rem] items-center justify-center text-sm text-muted-foreground">
        Console content will be added in the next migration steps.
      </div>
    </section>
  );
}

export function ConsoleShell() {
  const params = useParams();
  const lang = resolveLang(params.lang);
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
