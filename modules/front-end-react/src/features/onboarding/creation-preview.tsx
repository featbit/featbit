import { Building2, CircleDot, Folder, SquareCode } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type CreationPreviewProps = {
  organizationName: string;
  projectName: string;
  projectKey: string;
};

export function CreationPreview({ organizationName, projectName, projectKey }: CreationPreviewProps) {
  const { t } = useTranslation();

  return (
    <aside className="flex h-full flex-col rounded-md border border-slate-300 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">{t("onboarding.preview.title")}</h2>

      <div className="mt-6 flex flex-1 flex-col items-center">
        <PreviewNode
          icon={<Building2 className="h-10 w-10" />}
          label={organizationName}
          meta={t("onboarding.organization.section")}
          iconClassName="border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <VerticalLine height="4.5rem" />
        <PreviewNode
          icon={<Folder className="h-11 w-11" />}
          label={projectName}
          meta={t("onboarding.project.section")}
          badge={projectKey}
          iconClassName="border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />

        <div className="relative mt-24 h-52 w-full max-w-[26rem]">
          <BranchLines />
          <EnvironmentPreview name="Dev" tone="green" className="absolute left-[5%] top-1 -translate-x-1/2" />
          <EnvironmentPreview name="Prod" tone="blue" className="absolute left-[75%] top-1 -translate-x-1/2" />
        </div>
      </div>

      <div className="rounded-md border border-amber-300 bg-amber-50 px-5 py-4 dark:border-amber-900 dark:bg-amber-950/30">
        <div className="flex gap-4">
          <CircleDot className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">{t("onboarding.environments.helper")}</p>
        </div>
      </div>
    </aside>
  );
}

function PreviewNode({
  icon,
  label,
  meta,
  badge,
  iconClassName
}: {
  icon: ReactNode;
  label: string;
  meta: string;
  badge?: string;
  iconClassName: string;
}) {
  return (
    <div className="grid w-full max-w-[20rem] grid-cols-[6.25rem_minmax(0,1fr)] items-center gap-5 py-1">
      <span className={cn("flex h-24 w-24 items-center justify-center rounded-md border", iconClassName)}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold text-slate-950 dark:text-slate-50">{label}</span>
        <span className="mt-1 block text-base text-slate-500 dark:text-slate-400">{meta}</span>
        {badge ? (
          <span className="mt-4 inline-flex h-9 max-w-full items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 font-mono text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <SquareCode className="h-4 w-4 shrink-0" />
            <span className="truncate">{badge}</span>
          </span>
        ) : null}
      </span>
    </div>
  );
}

function VerticalLine({ height }: { height: string }) {
  return (
    <div className="w-full max-w-[20rem]">
      <svg
        className="ml-12 w-0.5 text-slate-200 dark:text-slate-800"
        style={{ height }}
        viewBox="0 0 2 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M1 0 V100" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function BranchLines() {
  return (
    <svg
      className="pointer-events-none absolute -top-24 left-0 h-24 w-full overflow-visible text-slate-200 dark:text-slate-800"
      viewBox="0 0 100 96"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M23.08 0 V48 M5 48 H75 M75 48 V96"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M5 48 V96"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function EnvironmentPreview({ name, tone, className }: { name: string; tone: "green" | "blue"; className?: string }) {
  const { t } = useTranslation();

  return (
    <div className={cn("flex w-44 min-w-0 flex-col items-center", className)}>
      <div className="flex h-18 w-18 items-center justify-center rounded-md border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950">
        <span className={cn("h-4 w-4 rounded-full", tone === "green" ? "bg-emerald-600" : "bg-blue-600")} />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-slate-50">{name}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("onboarding.preview.sdkSecret")}</p>
      <div className="mt-2 flex h-10 min-w-0 items-center justify-between gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 font-mono text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <span className="truncate">****************</span>
      </div>
    </div>
  );
}
