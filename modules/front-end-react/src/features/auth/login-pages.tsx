import { ArrowLeft, Building2, Eye, GitBranch, Globe2, Lock, Mail, Moon, Sun, TrendingUp, Users } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme/theme-provider";

type AuthMode = "login" | "sso";
type Lang = "en" | "zh";

function resolveLang(value: string | undefined): Lang {
  return value === "zh" ? "zh" : "en";
}

function FeatBitLogo() {
  return (
    <Link to="/" className="flex items-center gap-3 text-foreground" aria-label="FeatBit">
      <img className="h-9 w-10 shrink-0" src="/assets/featbit-logo.svg" alt="" />
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
    const suffix = window.location.pathname.endsWith("/sso") ? "/login/sso" : "/login";
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

function AuthHeader({ lang }: { lang: Lang }) {
  return (
    <header className="flex h-24 shrink-0 items-center justify-between border-b border-border px-8 sm:px-10">
      <FeatBitLogo />
      <div className="flex items-center gap-7">
        <ThemeToggle />
        <LanguageSwitcher lang={lang} />
      </div>
    </header>
  );
}

function DotGrid({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-6 gap-3", className)} aria-hidden="true">
      {Array.from({ length: 30 }).map((_, index) => (
        <span key={index} className="h-0.5 w-0.5 rounded-full bg-slate-400/60 dark:bg-slate-500/70" />
      ))}
    </div>
  );
}

function RolloutVisual() {
  return (
    <div className="relative left-1/2 mt-10 -ml-7 h-[450px] w-[820px] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden">
      <DotGrid className="absolute left-0 top-10" />
      <DotGrid className="absolute left-[58%] top-[-10px]" />
      <div className="absolute bottom-[-220px] left-[18%] h-[430px] w-[430px] rounded-full border border-slate-200/70 dark:border-slate-700/50" />
      <div className="absolute bottom-[-200px] left-[20%] h-[390px] w-[390px] rounded-full border border-slate-200/70 dark:border-slate-700/50" />
      <span className="absolute left-[18%] top-[250px] h-2.5 w-2.5 rounded-full bg-blue-500" />
      <span className="absolute bottom-24 left-[30%] h-3 w-3 rounded-full border-4 border-blue-300 dark:border-blue-500" />
      <span className="absolute bottom-36 left-0 h-2.5 w-2.5 rounded-full bg-emerald-300" />

      <div className="absolute left-0 top-[128px] flex h-20 w-48 flex-col justify-center rounded-lg border border-border bg-background/60 px-4 shadow-sm backdrop-blur-sm dark:bg-background/40">
        <div className="flex items-center gap-3 text-sm font-medium">
          <GitBranch className="h-5 w-5 fill-current" />
          <span>New checkout flow</span>
        </div>
        <p className="mt-3 text-sm">
          Rule <span className="mx-2 inline-block h-2 w-2 rounded-full bg-emerald-600" />{" "}
          <span className="text-emerald-600">On</span>
        </p>
      </div>

      <div className="absolute left-2 top-[300px] rounded-lg border border-border bg-background/60 p-4 shadow-sm backdrop-blur-sm dark:bg-background/40">
        <p className="text-sm">
          <span className="mr-3 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Rollout status
        </p>
        <p className="mt-2 pl-7 text-base font-medium text-emerald-600">Healthy</p>
      </div>

      <svg className="absolute left-[176px] top-[70px] h-[310px] w-[500px] overflow-visible" aria-hidden="true">
        <path d="M50 140 C112 140 80 0 175 0 L360 0" fill="none" stroke="#16a34a" strokeWidth="1.4" />
        <path d="M50 140 C112 140 98 140 175 140 L360 140" fill="none" stroke="#f59e0b" strokeDasharray="7 6" strokeWidth="1.4" />
        <path d="M50 140 C112 140 98 250 175 250 L360 250" fill="none" stroke="#2563eb" strokeWidth="1.4" />
        <path d="M50 140 C112 140 104 220 175 220 L360 220" fill="none" stroke="#94a3b8" strokeWidth="1.2" />
      </svg>

      <span className="absolute left-[240px] top-[158px] h-6 w-6 rounded-full border-[6px] border-emerald-700 bg-background dark:bg-slate-950" />

      <div className="absolute left-[372px] top-[16px] flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm shadow-sm dark:border-emerald-600/50 dark:bg-emerald-950/40">
        <Users className="h-4 w-4" />
        Beta users
      </div>
      <div className="absolute left-[372px] top-[154px] flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm shadow-sm dark:border-orange-500/50 dark:bg-orange-950/30">
        <TrendingUp className="h-4 w-4" />
        Gradual rollout
      </div>
      <div className="absolute left-[370px] top-[374px] flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm shadow-sm dark:border-blue-500/50 dark:bg-blue-950/30">
        <Globe2 className="h-4 w-4" />
        Internal team
      </div>

      <RolloutCard className="left-[576px] top-[2px]" percent="50%" label="Users in group A" status="Ready" tone="green" />
      <RolloutCard className="left-[576px] top-[124px]" percent="30%" label="Users in group B" status="Monitoring" tone="orange" />
      <RolloutCard className="left-[576px] top-[246px]" percent="20%" label="Everyone else" status="Off" tone="slate" />
      <RolloutCard className="left-[576px] top-[366px]" percent="100%" label="Team only" status="Stable" tone="blue" />
    </div>
  );
}

function RolloutCard({
  className,
  percent,
  label,
  status,
  tone
}: {
  className: string;
  percent: string;
  label: string;
  status: string;
  tone: "green" | "orange" | "slate" | "blue";
}) {
  const toneClass = {
    green: "text-emerald-500",
    orange: "text-orange-500",
    slate: "text-slate-500 dark:text-slate-400",
    blue: "text-blue-500"
  }[tone];

  return (
    <div className={cn("absolute w-56 rounded-lg border border-border bg-background/60 p-3 shadow-sm backdrop-blur-sm dark:bg-background/40", className)}>
      <div className="flex items-center gap-3">
        <Users className="h-5 w-5" />
        <span className={cn("text-xl font-semibold", toneClass)}>{percent}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className={cn("flex items-center gap-2", toneClass)}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {status}
        </span>
      </div>
    </div>
  );
}

function LeftPanel() {
  const { t } = useTranslation();

  return (
    <section className="relative hidden min-h-[calc(100vh-6rem)] min-w-0 flex-col justify-start pb-8 pl-16 pr-4 pt-[clamp(4rem,8vh,7rem)] lg:flex xl:pl-20 xl:pr-6">
      <div>
        <h1 className="max-w-none whitespace-nowrap text-5xl font-semibold leading-tight tracking-tight text-foreground">
          {t("auth.hero.title")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{t("auth.hero.subtitle")}</p>
        <RolloutVisual />
      </div>
    </section>
  );
}

function Field({
  label,
  type = "text",
  placeholder,
  icon,
  trailing
}: {
  label: string;
  type?: string;
  placeholder: string;
  icon: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-base font-medium text-foreground">{label}</span>
      <span className="mt-2 flex h-12 items-center gap-4 rounded-md border border-input bg-background px-4 text-muted-foreground shadow-sm transition-colors focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:bg-transparent">
        {icon}
        <input
          className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
          type={type}
          placeholder={placeholder}
        />
        {trailing}
      </span>
    </label>
  );
}

function DividerLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-7 text-sm text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      <span>{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.14c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18A10.9 10.9 0 0 1 12 6.03c.98 0 1.96.13 2.88.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.09 0 4.42-2.69 5.38-5.25 5.67.42.36.78 1.07.78 2.16v3.14c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"
      />
    </svg>
  );
}

function LoginForm({ lang }: { lang: Lang }) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col justify-start px-8 pb-8 pt-[clamp(4rem,8vh,7rem)] sm:px-12 lg:px-0">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">{t("auth.login.title")}</h2>
        <p className="mt-3 text-base text-muted-foreground">{t("auth.login.subtitle")}</p>
      </div>

      <form className="mt-7 space-y-6">
        <Field label={t("auth.email")} type="email" placeholder="name@company.com" icon={<Mail className="h-5 w-5" />} />
        <Field
          label={t("auth.password")}
          type="password"
          placeholder={t("auth.passwordPlaceholder")}
          icon={<Lock className="h-5 w-5" />}
          trailing={<Eye className="h-5 w-5" />}
        />

        <div className="flex items-center justify-between text-base">
          <label className="flex items-center gap-3">
            <input className="h-5 w-5 rounded border-input bg-background" type="checkbox" />
            {t("auth.remember")}
          </label>
          <a className="text-blue-600 hover:underline" href="#forgot-password">
            {t("auth.forgot")}
          </a>
        </div>

        <Button className="h-12 w-full bg-blue-600 text-base text-white shadow-sm hover:bg-blue-700" type="button">
          {t("auth.signIn")}
        </Button>
      </form>

      <div className="mt-8 space-y-6">
        <DividerLabel>{t("auth.continueWith")}</DividerLabel>
        <div className="grid grid-cols-2 gap-5">
          <Button type="button" variant="outline" className="h-12 gap-3 bg-transparent text-base shadow-none">
            <GoogleIcon />
            Google
          </Button>
          <Button type="button" variant="outline" className="h-12 gap-3 bg-transparent text-base shadow-none">
            <GitHubIcon />
            GitHub
          </Button>
        </div>

        <DividerLabel>{t("auth.enterprise")}</DividerLabel>
        <Button asChild type="button" variant="outline" className="h-12 w-full gap-3 bg-transparent text-base shadow-none">
          <Link to={`/${lang}/login/sso`}>
            <Building2 className="h-6 w-6" />
            {t("auth.ssoButton")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function SsoForm({ lang }: { lang: Lang }) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col justify-start px-8 pb-8 pt-[clamp(4rem,8vh,7rem)] sm:px-12 lg:px-0">
      <Button asChild variant="link" className="mb-14 h-auto justify-start gap-3 p-0 text-base text-blue-600">
        <Link to={`/${lang}/login`}>
          <ArrowLeft className="h-5 w-5" />
          {t("auth.backToSignIn")}
        </Link>
      </Button>

      <div>
        <h2 className="text-3xl font-semibold tracking-tight">{t("auth.sso.title")}</h2>
        <p className="mt-3 text-base text-muted-foreground">{t("auth.sso.subtitle")}</p>
      </div>

      <form className="mt-14 space-y-8">
        <Field
          label={t("auth.workspaceKey")}
          placeholder="acme-prod"
          icon={<Building2 className="h-6 w-6" />}
        />
        <Button className="h-14 w-full gap-3 bg-blue-600 text-lg text-white shadow-sm hover:bg-blue-700" type="button">
          <Building2 className="h-6 w-6" />
          {t("auth.continueSso")}
        </Button>
      </form>
    </div>
  );
}

function AuthFooter() {
  return (
    <footer className="flex justify-center gap-7 pb-6 text-sm text-muted-foreground">
      <a className="hover:text-foreground" href="#privacy">
        Privacy
      </a>
      <span>•</span>
      <a className="hover:text-foreground" href="#help">
        Help
      </a>
    </footer>
  );
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const params = useParams();
  const lang = resolveLang(params.lang);
  const { i18n } = useTranslation();

  useEffect(() => {
    void i18n.changeLanguage(lang);
  }, [i18n, lang]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AuthHeader lang={lang} />
      <div className="grid min-h-[calc(100vh-6rem)] lg:grid-cols-[1.3fr_1fr]">
        <LeftPanel />
        <section className="grid min-h-[calc(100vh-6rem)] grid-rows-[1fr_auto] border-border lg:border-l">
          {mode === "login" ? <LoginForm lang={lang} /> : <SsoForm lang={lang} />}
          <AuthFooter />
        </section>
      </div>
    </main>
  );
}
