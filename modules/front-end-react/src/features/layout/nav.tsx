import {
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  ChevronDown,
  ChevronUp,
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
  ShieldCheck,
  Sun,
  User,
  UserRound,
  UserRoundKey,
  UsersRound,
  Waypoints,
  Webhook
} from "lucide-react";
import { useState, type ComponentType, type SVGProps } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getStoredUserProfile, signOut } from "@/features/auth/auth-api";
import { getRuntimeEnv } from "@/lib/env/runtime-env";
import { useTheme } from "@/lib/theme/theme-provider";
import { cn } from "@/lib/utils";
import { localizedPath, resolveLang, type Lang } from "./context";

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

const navigationGroups: NavGroup[] = [
  {
    label: "Get Started",
    i18nKey: "layout.nav.groups.getStarted",
    items: [{ label: "Get Started", i18nKey: "layout.nav.items.getStarted", href: "/", icon: Rocket, active: true }]
  },
  {
    label: "Release",
    i18nKey: "layout.nav.groups.release",
    items: [
      { label: "Feature Flags", i18nKey: "layout.nav.items.featureFlags", href: "/feature-flags", icon: Flag },
      { label: "Segments", i18nKey: "layout.nav.items.segments", href: "/segments", icon: Layers3 },
      { label: "End Users", i18nKey: "layout.nav.items.endUsers", href: "/end-users", icon: UsersRound }
    ]
  },
  {
    label: "Governance",
    i18nKey: "layout.nav.groups.governance",
    items: [
      { label: "Audit Logs", i18nKey: "layout.nav.items.auditLogs", href: "/audit-logs", icon: Logs },
      { label: "Change Requests", i18nKey: "layout.nav.items.changeRequests", href: "/change-requests", icon: GitPullRequest }
    ]
  },
  {
    label: "Experimentation",
    i18nKey: "layout.nav.groups.experimentation",
    items: [
      { label: "Experiments", i18nKey: "layout.nav.items.experiments", href: "/experiments", icon: FlaskConical },
      { label: "Metrics", i18nKey: "layout.nav.items.metrics", href: "/metrics", icon: BarChart3 }
    ]
  },
  {
    label: "Integrations",
    i18nKey: "layout.nav.groups.integrations",
    items: [
      { label: "Relay Proxies", i18nKey: "layout.nav.items.relayProxies", href: "/relay-proxies", icon: Waypoints },
      { label: "WebHooks", i18nKey: "layout.nav.items.webhooks", href: "/webhooks", icon: Webhook },
      { label: "Access Tokens", i18nKey: "layout.nav.items.accessTokens", href: "/access-tokens", icon: KeyRound }
    ]
  },
  {
    label: "Admin",
    i18nKey: "layout.nav.groups.admin",
    items: [
      { label: "Workspace", i18nKey: "layout.nav.items.workspace", href: "/workspace", icon: Building2 },
      { label: "Organization", i18nKey: "layout.nav.items.organization", href: "/organization", icon: Boxes },
      {
        label: "IAM",
        i18nKey: "layout.nav.items.iam",
        href: "/iam",
        icon: ShieldCheck,
        children: [
          { label: "Teams", i18nKey: "layout.nav.items.teams", href: "/iam/teams", icon: UserRound },
          { label: "Groups", i18nKey: "layout.nav.items.groups", href: "/iam/groups", icon: UsersRound },
          { label: "Policies", i18nKey: "layout.nav.items.policies", href: "/iam/policies", icon: UserRoundKey }
        ]
      }
    ]
  }
];

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
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-9 w-full justify-start gap-3 px-3 text-sm font-normal text-muted-foreground hover:text-foreground",
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
    </Button>
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

export function Sidebar({
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
        "flex h-screen shrink-0 flex-col overflow-hidden border-r border-border bg-card transition-[width] duration-200",
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
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-auto w-full justify-start gap-3 p-2 text-left font-normal",
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
    </Button>
  );

  return (
    <div className="shrink-0 border-t border-border p-1">
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
