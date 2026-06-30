import { Moon, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme/theme-provider";
import { cn } from "@/lib/utils";
import type { Lang } from "@/features/auth/auth-page-types";

function FeatBitLogo() {
  const { resolvedTheme } = useTheme();
  const logoSrc = resolvedTheme === "dark" ? "/assets/featbit-logo-dark.svg" : "/assets/featbit-logo.svg";

  return (
    <Link to="/" className="flex items-center gap-3 text-foreground" aria-label="FeatBit">
      <img className="h-9 w-10 shrink-0" src={logoSrc} alt="" />
      <span className="text-3xl font-semibold tracking-tight">FeatBit</span>
    </Link>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-10 w-10 cursor-pointer rounded-md border-slate-300 bg-transparent text-slate-700 shadow-none hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}

function LanguageSwitcher({ lang }: { lang: Lang }) {
  const nextPath = (nextLang: Lang) => {
    const [, currentLang, ...rest] = window.location.pathname.split("/");
    const suffix = currentLang === "en" || currentLang === "zh" ? `/${rest.join("/")}` : "/login";
    return `/${nextLang}${suffix}`;
  };

  return (
    <nav className="flex items-center gap-4 text-base text-muted-foreground" aria-label="Language">
      <Link
        className={cn(
          "border-b-2 pb-1.5 transition-colors",
          lang === "en" ? "border-blue-600 text-blue-600" : "border-transparent hover:text-foreground"
        )}
        to={nextPath("en")}
      >
        English
      </Link>
      <span>/</span>
      <Link
        className={cn(
          "border-b-2 pb-1.5 transition-colors",
          lang === "zh" ? "border-blue-600 text-blue-600" : "border-transparent hover:text-foreground"
        )}
        to={nextPath("zh")}
      >
        中文
      </Link>
    </nav>
  );
}

export function AuthHeader({ lang }: { lang: Lang }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-8 sm:px-10">
      <FeatBitLogo />
      <div className="flex items-center gap-7">
        <ThemeToggle />
        <LanguageSwitcher lang={lang} />
      </div>
    </header>
  );
}
