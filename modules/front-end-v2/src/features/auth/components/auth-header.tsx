import { Moon, Sun } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Lang } from "@/features/auth/auth-page-types"

function FeatBitLogo({ lang }: { lang: Lang }) {
  return (
    <Link
      to={`/${lang}/login`}
      className="flex min-w-0 items-center gap-2 sm:gap-3"
      aria-label="FeatBit"
    >
      <img
        className="size-8 shrink-0 sm:size-10 dark:hidden"
        src="/assets/featbit-logo.svg"
        alt=""
      />
      <img
        className="hidden size-8 shrink-0 sm:size-10 dark:block"
        src="/assets/featbit-logo-dark.svg"
        alt=""
      />
      <span className="hidden text-2xl font-semibold tracking-tight min-[360px]:inline sm:text-3xl">
        FeatBit
      </span>
    </Link>
  )
}

function LanguageSwitcher({ lang }: { lang: Lang }) {
  const { t } = useTranslation()
  const location = useLocation()
  const currentSuffix = location.pathname.replace(/^\/(en|zh)/, "") || "/login"

  function languageTarget(nextLang: Lang) {
    return {
      pathname: `/${nextLang}${currentSuffix}`,
      search: location.search,
      hash: location.hash,
    }
  }

  return (
    <nav
      className="flex shrink-0 items-center gap-2 text-sm whitespace-nowrap text-muted-foreground sm:gap-3 sm:text-base"
      aria-label={t("auth.header.language")}
    >
      <Link
        className={cn(
          "border-b-2 pb-1.5 transition-colors",
          lang === "en"
            ? "border-blue-600 text-blue-600"
            : "border-transparent hover:text-foreground"
        )}
        to={languageTarget("en")}
        aria-current={lang === "en" ? "page" : undefined}
      >
        <span className="sm:hidden">{t("auth.header.englishShort")}</span>
        <span className="hidden sm:inline">{t("auth.header.english")}</span>
      </Link>
      <span aria-hidden="true">/</span>
      <Link
        className={cn(
          "border-b-2 pb-1.5 transition-colors",
          lang === "zh"
            ? "border-blue-600 text-blue-600"
            : "border-transparent hover:text-foreground"
        )}
        to={languageTarget("zh")}
        aria-current={lang === "zh" ? "page" : undefined}
      >
        {t("auth.header.chinese")}
      </Link>
    </nav>
  )
}

export function AuthHeader({ lang }: { lang: Lang }) {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const isDark =
    theme === "dark" ||
    (theme === "system" && document.documentElement.classList.contains("dark"))

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4 sm:px-8 lg:px-10">
      <FeatBitLogo lang={lang} />
      <div className="flex shrink-0 items-center gap-2 sm:gap-5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={
            isDark
              ? t("auth.header.switchToLightTheme")
              : t("auth.header.switchToDarkTheme")
          }
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          {isDark ? <Sun /> : <Moon />}
        </Button>
        <LanguageSwitcher lang={lang} />
      </div>
    </header>
  )
}
