import { Moon, Sun } from "lucide-react"
import { Link } from "react-router-dom"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Lang } from "@/features/auth/auth-page-types"

function FeatBitLogo() {
  return (
    <Link to="/" className="flex items-center gap-3" aria-label="FeatBit">
      <img
        className="size-10 dark:hidden"
        src="/assets/featbit-logo.svg"
        alt=""
      />
      <img
        className="hidden size-10 dark:block"
        src="/assets/featbit-logo-dark.svg"
        alt=""
      />
      <span className="text-3xl font-semibold tracking-tight">FeatBit</span>
    </Link>
  )
}

function LanguageSwitcher({ lang }: { lang: Lang }) {
  const currentSuffix =
    window.location.pathname.replace(/^\/(en|zh)/, "") || "/login"

  return (
    <nav className="flex items-center gap-4 text-base text-muted-foreground" aria-label="Language">
      <Link
        className={cn(
          "border-b-2 pb-1.5 transition-colors",
          lang === "en"
            ? "border-blue-600 text-blue-600"
            : "border-transparent hover:text-foreground"
        )}
        to={`/en${currentSuffix}`}
      >
        English
      </Link>
      <span>/</span>
      <Link
        className={cn(
          "border-b-2 pb-1.5 transition-colors",
          lang === "zh"
            ? "border-blue-600 text-blue-600"
            : "border-transparent hover:text-foreground"
        )}
        to={`/zh${currentSuffix}`}
      >
        中文
      </Link>
    </nav>
  )
}

export function AuthHeader({ lang }: { lang: Lang }) {
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark"

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b px-8 sm:px-10">
      <FeatBitLogo />
      <div className="flex items-center gap-7">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          {isDark ? <Sun /> : <Moon />}
        </Button>
        <LanguageSwitcher lang={lang} />
      </div>
    </header>
  )
}
