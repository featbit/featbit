import {
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { AccountMenu } from "@/features/layout/components/account-menu"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang, NavItem } from "@/features/layout/layout-types"
import { navigationGroups } from "@/features/layout/navigation"
import { cn } from "@/lib/utils"

function FeatBitBrand({ lang, collapsed }: { lang: Lang; collapsed: boolean }) {
  return (
    <Link
      to={localizedPath(lang, "")}
      className={cn(
        "flex h-12 items-center gap-3 rounded-md px-2 text-foreground",
        collapsed && "justify-center px-0"
      )}
      aria-label="FeatBit"
    >
      <img
        className="size-9 shrink-0 dark:hidden"
        src="/assets/featbit-logo.svg"
        alt=""
      />
      <img
        className="hidden size-9 shrink-0 dark:block"
        src="/assets/featbit-logo-dark.svg"
        alt=""
      />
      {!collapsed ? (
        <span className="text-xl font-semibold tracking-tight">FeatBit</span>
      ) : null}
    </Link>
  )
}

function isActivePath(pathname: string, href: string, lang: Lang) {
  const localizedHref = localizedPath(lang, href)
  if (href === "") {
    return pathname === localizedHref
  }

  return pathname === localizedHref || pathname.startsWith(`${localizedHref}/`)
}

function hasActiveChild(pathname: string, item: NavItem, lang: Lang) {
  return item.children?.some((child) => isActivePath(pathname, child.href, lang))
}

function SidebarNavLink({
  item,
  lang,
  collapsed,
  secondary = false,
}: {
  item: NavItem
  lang: Lang
  collapsed: boolean
  secondary?: boolean
}) {
  const { t } = useTranslation()
  const location = useLocation()
  const Icon = item.icon
  const label = t(item.labelKey)
  const active = isActivePath(location.pathname, item.href, lang)

  return (
    <Link
      to={localizedPath(lang, item.href)}
      title={collapsed ? label : undefined}
      className={cn(
        "flex h-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        secondary && "h-8 pl-9 text-xs",
        active && "bg-accent text-foreground",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  )
}

function SidebarNavItem({
  item,
  lang,
  collapsed,
  expanded,
  onToggle,
}: {
  item: NavItem
  lang: Lang
  collapsed: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const location = useLocation()
  const Icon = item.icon
  const label = t(item.labelKey)
  const childActive = hasActiveChild(location.pathname, item, lang)
  const open = expanded || childActive

  if (!item.children?.length) {
    return <SidebarNavLink item={item} lang={lang} collapsed={collapsed} />
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "h-9 w-full justify-start gap-3 px-3 text-sm font-normal text-muted-foreground hover:text-foreground",
          "hover:bg-transparent active:translate-y-0 active:bg-transparent aria-expanded:bg-transparent aria-expanded:text-muted-foreground",
          childActive && "text-foreground",
          collapsed && "justify-center px-0"
        )}
        title={collapsed ? label : undefined}
        aria-expanded={open}
        onClick={onToggle}
      >
        <Icon className="size-4 shrink-0" />
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
            {open ? (
              <ChevronUp className="size-3.5 shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 shrink-0" />
            )}
          </>
        ) : null}
      </Button>
      {!collapsed && open ? (
        <div className="space-y-1">
          {item.children.map((child) => (
            <SidebarNavLink
              key={child.href}
              item={child}
              lang={lang}
              collapsed={false}
              secondary
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function Sidebar({
  lang,
  collapsed,
  setCollapsed,
}: {
  lang: Lang
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}) {
  const { t } = useTranslation()
  const [expandedNav, setExpandedNav] = useState<Record<string, boolean>>({})

  function toggleNavItem(labelKey: string) {
    setExpandedNav((current) => ({
      ...current,
      [labelKey]: !current[labelKey],
    }))
  }

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col overflow-visible border-r bg-card transition-[width] duration-200",
        collapsed ? "w-[4.5rem]" : "w-64"
      )}
    >
      <div className="flex h-16 items-center justify-between px-3">
        <FeatBitBrand lang={lang} collapsed={collapsed} />
        {!collapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("layout.sidebar.collapse")}
            onClick={() => setCollapsed(true)}
          >
            <PanelLeftClose className="size-4" />
          </Button>
        ) : null}
      </div>

      {collapsed ? (
        <div className="flex justify-center px-3 pb-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("layout.sidebar.expand")}
            onClick={() => setCollapsed(false)}
          >
            <PanelLeftOpen className="size-4" />
          </Button>
        </div>
      ) : null}

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-5">
          {navigationGroups.map((group) => (
            <section key={group.labelKey} className="space-y-1">
              {!collapsed ? (
                <h2 className="px-3 pb-1 text-xs font-medium text-muted-foreground uppercase">
                  {t(group.labelKey)}
                </h2>
              ) : null}
              {group.items.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  item={item}
                  lang={lang}
                  collapsed={collapsed}
                  expanded={Boolean(expandedNav[item.labelKey])}
                  onToggle={() => toggleNavItem(item.labelKey)}
                />
              ))}
            </section>
          ))}
        </div>
      </nav>

      <AccountMenu lang={lang} collapsed={collapsed} />
    </aside>
  )
}
