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
        <span
          className={cn("flex items-center gap-2 whitespace-nowrap", toneClass)}
        >
          <span className="size-1.5 rounded-full bg-current" />
          {status}
        </span>
      </div>
    </div>
  )
}

function RolloutVisual() {
  const { t } = useTranslation()

  return (
    <div className="relative left-1/2 mt-10 h-[450px] w-[820px] max-w-[calc(100vw-2rem)] origin-top -translate-x-1/2 overflow-visible [@media(max-height:800px)]:h-[386px] [@media(max-height:800px)]:scale-[0.86] [@media(min-height:1100px)]:h-[540px] [@media(min-height:1100px)]:scale-[1.2]">
      <DotGrid className="absolute top-15 left-0" />
      <DotGrid className="absolute top-[-10px] left-[58%]" />
      <span className="absolute top-[100px] left-[15%] size-2.5 rounded-full bg-orange-500" />
      <span className="absolute top-[250px] left-[18%] size-2.5 rounded-full bg-blue-500" />
      <span className="absolute bottom-24 left-[30%] size-3 rounded-full border-4 border-blue-300 dark:border-blue-500" />
      <span className="absolute top-[440px] left-0 size-2.5 rounded-full bg-red-300" />
      <span className="absolute top-[450px] left-[40%] size-2.5 rounded-full bg-green-300" />

      <div className="absolute top-[168px] left-0 flex w-48 flex-col rounded-lg border bg-background/60 px-4 py-3 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3 text-sm font-medium">
          <Flag className="size-5 fill-current" />
          <span>{t("auth.rollout.featureName")}</span>
        </div>
        <p className="mt-3 text-sm">
          {t("auth.rollout.rule")}{" "}
          <span className="mx-2 inline-block size-2 rounded-full bg-emerald-600" />
          <span className="text-emerald-600">{t("auth.rollout.on")}</span>
        </p>
      </div>

      <div className="absolute top-[300px] left-0 rounded-lg border bg-background/60 px-4 py-3 shadow-sm backdrop-blur-sm">
        <p className="text-sm">
          <span className="mr-3 inline-block size-2.5 rounded-full bg-emerald-500" />
          {t("auth.rollout.rolloutStatus")}
        </p>
        <p className="mt-2 pl-7 text-base font-medium text-emerald-600">
          {t("auth.rollout.healthy")}
        </p>
      </div>

      <svg
        className="absolute top-[70px] left-[180px] h-[340px] w-[380px] overflow-visible"
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

      <span className="absolute top-[198px] left-[198px] size-6 rounded-full border-[6px] border-emerald-700 bg-background" />
      <div className="absolute top-[47px] left-[280px] flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm shadow-sm dark:border-emerald-600/50 dark:bg-emerald-950">
        <Users className="size-4" />
        {t("auth.rollout.betaUsers")}
      </div>
      <span className="absolute top-[65px] left-[505px] size-2.5 rounded-full bg-emerald-700" />
      <div className="absolute top-[186px] left-[280px] flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm shadow-sm dark:border-orange-500/50 dark:bg-orange-950">
        <TrendingUp className="size-4" />
        {t("auth.rollout.gradualRollout")}
      </div>
      <span className="absolute top-[205px] left-[505px] size-2.5 rounded-full bg-orange-500" />
      <span className="absolute top-[301px] left-[505px] size-2.5 rounded-full bg-slate-500" />
      <div className="absolute top-[384px] left-[280px] flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm shadow-sm dark:border-blue-500/50 dark:bg-blue-950">
        <Globe2 className="size-4" />
        {t("auth.rollout.internalTeam")}
      </div>
      <span className="absolute top-[403px] left-[505px] size-2.5 rounded-full bg-blue-500" />

      <RolloutCard
        className="top-[30px] left-[525px]"
        percent="50%"
        label={t("auth.rollout.groupA")}
        status={t("auth.rollout.ready")}
        tone="green"
      />
      <RolloutCard
        className="top-[156px] left-[525px]"
        percent="30%"
        label={t("auth.rollout.groupB")}
        status={t("auth.rollout.monitoring")}
        tone="orange"
      />
      <RolloutCard
        className="top-[262px] left-[525px]"
        percent="20%"
        label={t("auth.rollout.everyoneElse")}
        status={t("auth.rollout.off")}
        tone="slate"
      />
      <RolloutCard
        className="top-[376px] left-[525px]"
        percent="100%"
        label={t("auth.rollout.teamOnly")}
        status={t("auth.rollout.stable")}
        tone="blue"
      />
    </div>
  )
}

export function LeftPanel() {
  const { t } = useTranslation()

  return (
    <section className="relative hidden min-h-[calc(100dvh-4rem)] min-w-0 flex-col justify-start overflow-hidden pt-[clamp(2rem,6vh,7rem)] pr-4 pb-8 pl-16 xl:pr-6 xl:pl-20 2xl:flex">
      <h1 className="max-w-none text-5xl leading-tight font-semibold tracking-tight whitespace-nowrap text-foreground">
        {t("auth.hero.title")}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        {t("auth.hero.subtitle")}
      </p>
      <RolloutVisual />
    </section>
  )
}
