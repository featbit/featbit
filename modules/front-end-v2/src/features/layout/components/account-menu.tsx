import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe2,
  Info,
  LifeBuoy,
  LogOut,
  Moon,
  Sun,
  User,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  getStoredUserProfile,
  signOut,
} from "@/features/auth/auth-api"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import { PROFILE_CHANGED_EVENT } from "@/features/profile/profile-api"
import { getRuntimeEnv } from "@/lib/env/runtime-env"
import { cn } from "@/lib/utils"

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  )
}

export function AccountMenu({
  lang,
  collapsed,
}: {
  lang: Lang
  collapsed: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [profile, setProfile] = useState(() => getStoredUserProfile())
  const name = profile.name || "Test User"
  const email = profile.email || "test@featbit.com"
  const initials = getInitials(name)
  const version = getRuntimeEnv().version
  const languageLabel = lang === "zh" ? "ZH" : "EN"
  const themeLabel = t(`layout.account.theme.${theme}`)

  function changeLanguage(nextLang: Lang) {
    const nextPath = window.location.pathname.replace(
      /^\/(en|zh)/,
      `/${nextLang}`
    )
    navigate(`${nextPath}${window.location.search}`)
  }

  function handleSignOut() {
    signOut()
    navigate(localizedPath(lang, "/login"), { replace: true })
  }

  function handleProfileClick() {
    setAccountMenuOpen(false)
    navigate(localizedPath(lang, "/account/profile"))
  }

  useEffect(() => {
    function syncProfile() {
      setProfile(getStoredUserProfile())
    }

    window.addEventListener(PROFILE_CHANGED_EVENT, syncProfile)
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, syncProfile)
  }, [])

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-auto w-full justify-start gap-3 p-2 text-left font-normal",
        collapsed && "justify-center"
      )}
      title={collapsed ? t("layout.account.account") : undefined}
      aria-label={t("layout.account.account")}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium text-secondary-foreground">
        {initials}
      </span>
      {!collapsed ? (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {email}
          </span>
        </span>
      ) : null}
      {!collapsed ? (
        accountMenuOpen ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )
      ) : null}
    </Button>
  )

  return (
    <div className="shrink-0 border-t border-border p-1">
      <DropdownMenu open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
        <DropdownMenuTrigger render={trigger} />
        <DropdownMenuContent
          align="start"
          side="right"
          sideOffset={10}
          className="w-[226px] rounded-lg border-border/80 bg-popover p-0 text-popover-foreground shadow-lg"
        >
          <div className="p-3 pb-2">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                {initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-5 text-foreground">
                  {name}
                </span>
                <span className="block truncate text-xs leading-4 text-muted-foreground">
                  {email}
                </span>
              </span>
            </div>
          </div>
          <DropdownMenuSeparator className="mx-3 my-0" />
          <div className="p-2">
            <DropdownMenuItem
              className="h-8 cursor-pointer gap-3 rounded-md px-2 text-sm font-medium"
              onClick={handleProfileClick}
            >
              <User className="size-4 text-muted-foreground" />
              {t("layout.account.profile")}
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <a
                  href="https://support.featbit.ai"
                  target="_blank"
                  rel="noreferrer"
                />
              }
              className="h-8 cursor-pointer gap-3 rounded-md px-2 text-sm font-medium"
            >
              <LifeBuoy className="size-4 text-muted-foreground" />
              {t("layout.account.support")}
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <a
                  href="https://docs.featbit.co"
                  target="_blank"
                  rel="noreferrer"
                />
              }
              className="h-8 cursor-pointer gap-3 rounded-md px-2 text-sm font-medium"
            >
              <BookOpen className="size-4 text-muted-foreground" />
              {t("layout.account.documentation")}
            </DropdownMenuItem>
          </div>
          <DropdownMenuSeparator className="mx-3 my-0" />
          <div className="p-2">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-8 cursor-pointer gap-3 rounded-md px-2 text-sm font-medium">
                <Globe2 className="size-4 text-muted-foreground" />
                <span>{t("layout.account.language")}</span>
                <span className="ml-auto text-xs font-medium text-muted-foreground">
                  {languageLabel}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-36 rounded-lg">
                <DropdownMenuRadioGroup
                  value={lang}
                  onValueChange={(value) => changeLanguage(value as Lang)}
                >
                  <DropdownMenuRadioItem value="en" className="cursor-pointer">
                    {t("layout.account.english")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="zh" className="cursor-pointer">
                    {t("layout.account.chinese")}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-8 cursor-pointer gap-3 rounded-md px-2 text-sm font-medium">
                {theme === "dark" ? (
                  <Moon className="size-4 text-muted-foreground" />
                ) : (
                  <Sun className="size-4 text-muted-foreground" />
                )}
                <span>{t("layout.account.theme.label")}</span>
                <span className="ml-auto text-xs font-medium text-muted-foreground">
                  {themeLabel}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-36 rounded-lg">
                <DropdownMenuRadioGroup
                  value={theme}
                  onValueChange={(value) =>
                    setTheme(value as "light" | "dark" | "system")
                  }
                >
                  <DropdownMenuRadioItem
                    value="light"
                    className="cursor-pointer"
                  >
                    {t("layout.account.theme.light")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark" className="cursor-pointer">
                    {t("layout.account.theme.dark")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="system"
                    className="cursor-pointer"
                  >
                    {t("layout.account.theme.system")}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </div>
          <DropdownMenuSeparator className="mx-3 my-0" />
          <div className="p-2">
            <DropdownMenuItem
              render={
                <a
                  href="https://github.com/featbit/featbit"
                  target="_blank"
                  rel="noreferrer"
                />
              }
              className="h-8 cursor-pointer justify-between rounded-md px-2 text-sm font-medium"
            >
              <span className="flex items-center gap-3">
                <Info className="size-4 text-muted-foreground" />
                {t("layout.account.version", { version })}
              </span>
              <ExternalLink className="size-4 text-muted-foreground" />
            </DropdownMenuItem>
          </div>
          <DropdownMenuSeparator className="mx-3 my-0" />
          <div className="p-2">
            <DropdownMenuItem
              className="h-8 cursor-pointer gap-3 rounded-md px-2 text-sm font-semibold text-destructive data-[highlighted]:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="size-4" />
              {t("layout.account.signOut")}
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
