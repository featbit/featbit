import { GitBranch, Globe2, TrendingUp, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

function DotGrid({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-6 gap-3", className)} aria-hidden="true">
      {Array.from({ length: 30 }).map((_, index) => (
        <span key={index} className="h-0.5 w-0.5 rounded-full bg-slate-400/60 dark:bg-slate-500/70" />
      ))}
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

function RolloutVisual() {
  return (
    <div className="relative left-1/2 mt-10 h-[450px] w-[820px] max-w-[calc(100vw-2rem)] origin-top -translate-x-1/2 overflow-visible [@media(min-height:1100px)]:h-[540px] [@media(min-height:1100px)]:scale-[1.2] [@media(max-height:800px)]:h-[386px] [@media(max-height:800px)]:scale-[0.86]">
      <DotGrid className="absolute left-0 top-15" />
      <DotGrid className="absolute left-[58%] top-[-10px]" />
      <span className="absolute left-[15%] top-[100px] h-2.5 w-2.5 rounded-full bg-orange-500" />
      <span className="absolute left-[18%] top-[250px] h-2.5 w-2.5 rounded-full bg-blue-500" />
      <span className="absolute bottom-24 left-[30%] h-3 w-3 rounded-full border-4 border-blue-300 dark:border-blue-500" />
      <span className="absolute bottom-36 left-0 top-[440px] h-2.5 w-2.5 rounded-full bg-red-300" />
      <span className="absolute bottom-36 left-[40%] top-[450px] h-2.5 w-2.5 rounded-full bg-green-300" />

      <div className="absolute left-0 top-[168px] flex h-20 w-48 flex-col justify-center rounded-lg border border-border bg-background/60 px-4 shadow-sm backdrop-blur-sm dark:bg-background/40">
        <div className="flex items-center gap-3 text-sm font-medium">
          <GitBranch className="h-5 w-5 fill-current" />
          <span>New checkout flow</span>
        </div>
        <p className="mt-3 text-sm">
          Rule <span className="mx-2 inline-block h-2 w-2 rounded-full bg-emerald-600" />{" "}
          <span className="text-emerald-600">On</span>
        </p>
      </div>

      <div className="absolute left-0 top-[300px] rounded-lg border border-border bg-background/60 p-4 shadow-sm backdrop-blur-sm dark:bg-background/40">
        <p className="text-sm">
          <span className="mr-3 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Rollout status
        </p>
        <p className="mt-2 pl-7 text-base font-medium text-emerald-600">Healthy</p>
      </div>

      <svg className="absolute left-[180px] top-[70px] h-[340px] w-[380px] overflow-visible" aria-hidden="true">
        <path d="M30 140 C88 140 50 0 118 0 L330 0" fill="none" stroke="#16a34a" strokeWidth="1.4" />
        <path d="M30 140 L330 140" fill="none" stroke="#f59e0b" strokeWidth="1.4" />
        <path d="M30 140 C92 140 82 220 132 220 L330 220" fill="none" stroke="#94a3b8" strokeWidth="1.2" />
        <path d="M30 140 C66 140 50 328 126 328 L330 328" fill="none" stroke="#2563eb" strokeWidth="1.4" />
      </svg>

      <span className="absolute left-[198px] top-[198px] h-6 w-6 rounded-full border-[6px] border-emerald-700 bg-background dark:bg-slate-950" />

      <div className="absolute left-[280px] top-[47px] flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm shadow-sm dark:border-emerald-600/50 dark:bg-emerald-950">
        <Users className="h-4 w-4" />
        Beta users
      </div>
      <span className="absolute left-[505px] top-[65px] h-2.5 w-2.5 rounded-full bg-emerald-700" aria-hidden="true" />
      <div className="absolute left-[280px] top-[186px] flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm shadow-sm dark:border-orange-500/50 dark:bg-orange-950">
        <TrendingUp className="h-4 w-4" />
        Gradual rollout
      </div>
      <span className="absolute left-[505px] top-[205px] h-2.5 w-2.5 rounded-full bg-orange-500" aria-hidden="true" />
      <span className="absolute left-[505px] top-[285px] h-2.5 w-2.5 rounded-full bg-slate-500" aria-hidden="true" />
      <div className="absolute left-[280px] top-[374px] flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm shadow-sm dark:border-blue-500/50 dark:bg-blue-950">
        <Globe2 className="h-4 w-4" />
        Internal team
      </div>
      <span className="absolute left-[505px] top-[393px] h-2.5 w-2.5 rounded-full bg-blue-500" aria-hidden="true" />

      <RolloutCard className="left-[525px] top-[30px]" percent="50%" label="Users in group A" status="Ready" tone="green" />
      <RolloutCard className="left-[525px] top-[156px]" percent="30%" label="Users in group B" status="Monitoring" tone="orange" />
      <RolloutCard className="left-[525px] top-[246px]" percent="20%" label="Everyone else" status="Off" tone="slate" />
      <RolloutCard className="left-[525px] top-[366px]" percent="100%" label="Team only" status="Stable" tone="blue" />
    </div>
  );
}

export function LeftPanel() {
  const { t } = useTranslation();

  return (
    <section className="relative hidden min-h-[calc(100vh-4rem)] min-w-0 flex-col justify-start overflow-hidden pb-8 pl-16 pr-4 pt-[clamp(2rem,6vh,7rem)] lg:flex xl:pl-20 xl:pr-6">
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
