import { Flag, Globe2, TrendingUp, Users } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

function DotGrid({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-6 gap-3", className)} aria-hidden="true">
      {Array.from({ length: 30 }).map((_, index) => (
        <span
          key={index}
          className="size-0.5 rounded-full bg-muted-foreground/35"
        />
      ))}
    </div>
  )
}

function RolloutCard({
  className,
  percent,
  label,
  status,
  tone,
}: {
  className: string
  percent: string
  label: string
  status: string
  tone: "green" | "orange" | "slate" | "blue"
}) {
  const toneClass = {
    green: "text-emerald-500",
    orange: "text-orange-500",
    slate: "text-muted-foreground",
    blue: "text-blue-500",
  }[tone]

  return (
    <div
      className={cn(
        "absolute w-60 rounded-lg border bg-background/60 p-3 shadow-sm backdrop-blur-sm",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Users className="size-5" />
        <span className={cn("text-xl font-semibold", toneClass)}>
          {percent}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
        <span className="whitespace-nowrap">{label}</span>
        <span className={cn("flex items-center gap-2 whitespace-nowrap", toneClass)}>
          <span className="size-1.5 rounded-full bg-current" />
          {status}
        </span>
      </div>
    </div>
  )
}

function RolloutVisual() {
  return (
    <div className="relative left-1/2 mt-10 h-[450px] w-[820px] max-w-[calc(100vw-2rem)] origin-top -translate-x-1/2 overflow-visible [@media(max-height:800px)]:h-[386px] [@media(max-height:800px)]:scale-[0.86] [@media(min-height:1100px)]:h-[540px] [@media(min-height:1100px)]:scale-[1.2]">
      <DotGrid className="absolute left-0 top-15" />
      <DotGrid className="absolute left-[58%] top-[-10px]" />
      <span className="absolute left-[15%] top-[100px] size-2.5 rounded-full bg-orange-500" />
      <span className="absolute left-[18%] top-[250px] size-2.5 rounded-full bg-blue-500" />
      <span className="absolute bottom-24 left-[30%] size-3 rounded-full border-4 border-blue-300 dark:border-blue-500" />
      <span className="absolute left-0 top-[440px] size-2.5 rounded-full bg-red-300" />
      <span className="absolute left-[40%] top-[450px] size-2.5 rounded-full bg-green-300" />

      <div className="absolute left-0 top-[168px] flex w-48 flex-col rounded-lg border bg-background/60 px-4 py-3 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3 text-sm font-medium">
          <Flag className="size-5 fill-current" />
          <span>New checkout flow</span>
        </div>
        <p className="mt-3 text-sm">
          Rule <span className="mx-2 inline-block size-2 rounded-full bg-emerald-600" />
          <span className="text-emerald-600">On</span>
        </p>
      </div>

      <div className="absolute left-0 top-[300px] rounded-lg border bg-background/60 px-4 py-3 shadow-sm backdrop-blur-sm">
        <p className="text-sm">
          <span className="mr-3 inline-block size-2.5 rounded-full bg-emerald-500" />
          Rollout status
        </p>
        <p className="mt-2 pl-7 text-base font-medium text-emerald-600">
          Healthy
        </p>
      </div>

      <svg
        className="absolute left-[180px] top-[70px] h-[340px] w-[380px] overflow-visible"
        aria-hidden="true"
      >
        <path
          d="M30 140 C88 140 50 0 118 0 L330 0"
          fill="none"
          stroke="#16a34a"
          strokeWidth="1.4"
        />
        <path
          d="M30 140 L330 140"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.4"
        />
        <path
          d="M30 140 C92 140 82 236 132 236 L330 236"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.2"
        />
        <path
          d="M30 140 C66 140 50 338 126 338 L330 338"
          fill="none"
          stroke="#2563eb"
          strokeWidth="1.4"
        />
      </svg>

      <span className="absolute left-[198px] top-[198px] size-6 rounded-full border-[6px] border-emerald-700 bg-background" />
      <div className="absolute left-[280px] top-[47px] flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm shadow-sm dark:border-emerald-600/50 dark:bg-emerald-950">
        <Users className="size-4" />
        Beta users
      </div>
      <span className="absolute left-[505px] top-[65px] size-2.5 rounded-full bg-emerald-700" />
      <div className="absolute left-[280px] top-[186px] flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm shadow-sm dark:border-orange-500/50 dark:bg-orange-950">
        <TrendingUp className="size-4" />
        Gradual rollout
      </div>
      <span className="absolute left-[505px] top-[205px] size-2.5 rounded-full bg-orange-500" />
      <span className="absolute left-[505px] top-[301px] size-2.5 rounded-full bg-slate-500" />
      <div className="absolute left-[280px] top-[384px] flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm shadow-sm dark:border-blue-500/50 dark:bg-blue-950">
        <Globe2 className="size-4" />
        Internal team
      </div>
      <span className="absolute left-[505px] top-[403px] size-2.5 rounded-full bg-blue-500" />

      <RolloutCard className="left-[525px] top-[30px]" percent="50%" label="Users in group A" status="Ready" tone="green" />
      <RolloutCard className="left-[525px] top-[156px]" percent="30%" label="Users in group B" status="Monitoring" tone="orange" />
      <RolloutCard className="left-[525px] top-[262px]" percent="20%" label="Everyone else" status="Off" tone="slate" />
      <RolloutCard className="left-[525px] top-[376px]" percent="100%" label="Team only" status="Stable" tone="blue" />
    </div>
  )
}

export function LeftPanel() {
  const { t } = useTranslation()

  return (
    <section className="relative hidden min-h-[calc(100vh-4rem)] min-w-0 flex-col justify-start overflow-hidden pb-8 pl-16 pr-4 pt-[clamp(2rem,6vh,7rem)] xl:pl-20 xl:pr-6 2xl:flex">
      <h1 className="max-w-none whitespace-nowrap text-5xl font-semibold leading-tight tracking-tight text-foreground">
        {t("auth.hero.title")}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        {t("auth.hero.subtitle")}
      </p>
      <RolloutVisual />
    </section>
  )
}
