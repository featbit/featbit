import { CheckCircle2, Copy, Info, LockKeyhole, MinusCircle, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getCurrentWorkspace } from "@/features/layout/context";
import { getRuntimeEnv } from "@/lib/env/runtime-env";
import { cn } from "@/lib/utils";
import { fetchWorkspaceDetails, updateWorkspaceLicense, type WorkspaceDetails } from "../workspace-api";
import { WorkspaceLayout } from "../workspace-layout";
import type { LicensePayload } from "../general/workspace-types";

type LicenseStatus = "active" | "expired" | "expiring" | "missing";

type LicenseFeature = {
  id: string;
  labelKey: string;
  descriptionKey: string;
};

type DecodedLicense = LicensePayload & {
  plan?: string;
  sub?: string;
  wsId?: string;
  iat?: number;
  exp?: number;
  issuer?: string;
};

const HOSTING_MODE_SAAS = "saas";
const LICENSE_EXPIRING_DAYS_THRESHOLD = 30;
const FOREVER_LICENSE_DAYS_THRESHOLD = 366;

const featureCatalog: LicenseFeature[] = [
  {
    id: "sso",
    labelKey: "workspace.license.features.sso.title",
    descriptionKey: "workspace.license.features.sso.description"
  },
  {
    id: "schedule",
    labelKey: "workspace.license.features.schedule.title",
    descriptionKey: "workspace.license.features.schedule.description"
  },
  {
    id: "change-request",
    labelKey: "workspace.license.features.changeRequest.title",
    descriptionKey: "workspace.license.features.changeRequest.description"
  },
  {
    id: "multi-organization",
    labelKey: "workspace.license.features.multiOrganization.title",
    descriptionKey: "workspace.license.features.multiOrganization.description"
  },
  {
    id: "global-user",
    labelKey: "workspace.license.features.globalUsers.title",
    descriptionKey: "workspace.license.features.globalUsers.description"
  },
  {
    id: "shareable-segment",
    labelKey: "workspace.license.features.shareableSegment.title",
    descriptionKey: "workspace.license.features.shareableSegment.description"
  },
  {
    id: "auto-agents",
    labelKey: "workspace.license.features.autoAgents.title",
    descriptionKey: "workspace.license.features.autoAgents.description"
  },
  {
    id: "fine-grained-ac",
    labelKey: "workspace.license.features.fineGrainedAccessControl.title",
    descriptionKey: "workspace.license.features.fineGrainedAccessControl.description"
  },
  {
    id: "flag-comparison",
    labelKey: "workspace.license.features.flagComparison.title",
    descriptionKey: "workspace.license.features.flagComparison.description"
  }
];

function decodeBase64UrlJson<T>(value: string): T | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(paddedBase64)) as T;
  } catch {
    return null;
  }
}

function parseLicense(license: string | undefined) {
  const payload = license?.split(".")[1];
  return payload ? decodeBase64UrlJson<DecodedLicense>(payload) : null;
}

function toDate(value: number | undefined) {
  if (!value) {
    return null;
  }

  return new Date(value < 10_000_000_000 ? value * 1000 : value);
}

function formatDate(value: number | undefined, lang: "en" | "zh") {
  const date = toDate(value);
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(date);
}

function daysUntilExpiration(license: DecodedLicense | null) {
  const expiresAt = toDate(license?.exp)?.getTime();
  if (!expiresAt) {
    return -1;
  }

  return Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
}

function displayPlan(plan: string | undefined) {
  if (!plan) {
    return "-";
  }

  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function getLicenseStatus(license: DecodedLicense | null): LicenseStatus {
  if (!license || !toDate(license.exp)) {
    return "missing";
  }

  const remainingDays = daysUntilExpiration(license);
  if (remainingDays <= 0) {
    return "expired";
  }

  return remainingDays <= LICENSE_EXPIRING_DAYS_THRESHOLD ? "expiring" : "active";
}

function ExpirationValue({ license, lang, status }: { license: DecodedLicense | null; lang: "en" | "zh"; status: LicenseStatus }) {
  const { t } = useTranslation();
  const daysUntilExpiry = daysUntilExpiration(license);
  const isForever = daysUntilExpiry > FOREVER_LICENSE_DAYS_THRESHOLD;

  if (!license?.exp || daysUntilExpiry < 0) {
    return <>{formatDate(license?.exp, lang)}</>;
  }

  if (isForever) {
    return <>{t("workspace.license.forever")}</>;
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <span>{formatDate(license.exp, lang)}</span>
      {status === "expiring" ? (
        <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
          {t("workspace.license.daysRemaining", { days: daysUntilExpiry })}
        </span>
      ) : null}
    </span>
  );
}

function isFeatureGranted(feature: LicenseFeature, license: DecodedLicense | null, status: LicenseStatus) {
  if (!license || status === "expired" || status === "missing") {
    return false;
  }

  const features = license.features ?? [];
  return features.includes("*") || features.includes(feature.id);
}

function StatusBadge({ status }: { status: LicenseStatus }) {
  const { t } = useTranslation();
  const active = status === "active";

  return (
    <span
      className={cn(
        "inline-flex h-7 w-fit items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-border bg-muted text-muted-foreground"
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", active ? "bg-emerald-500" : "bg-muted-foreground")} />
      {t(`workspace.license.status.${status}`)}
    </span>
  );
}

function SummaryRow({
  isSaas,
  license,
  status,
  lang
}: {
  isSaas: boolean;
  license: DecodedLicense | null;
  status: LicenseStatus;
  lang: "en" | "zh";
}) {
  const { t } = useTranslation();
  const items = [
    {
      label: isSaas ? t("workspace.license.source") : t("workspace.license.currentPlan"),
      value: isSaas ? t("workspace.license.saasSource") : displayPlan(license?.plan)
    },
    { label: t("workspace.license.statusLabel"), value: <StatusBadge status={status} /> },
    { label: t("workspace.license.issuedAt"), value: formatDate(license?.iat, lang) },
    { label: t("workspace.license.expires"), value: <ExpirationValue license={license} lang={lang} status={status} /> }
  ];

  return (
    <div className="grid overflow-hidden rounded-md border border-border bg-card shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <div key={item.label} className={cn("px-6 py-4", index > 0 && "border-t border-border sm:border-l sm:border-t-0")}>
          <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
          <div className="mt-2 min-h-6 text-lg font-semibold text-foreground">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function WorkspaceIdSection({ workspace, onCopied }: { workspace: WorkspaceDetails; onCopied: () => void }) {
  const { t } = useTranslation();

  async function copyWorkspaceId() {
    await navigator.clipboard.writeText(workspace.id);
    onCopied();
  }

  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("workspace.license.workspaceId")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("workspace.license.workspaceIdHelper")}</p>
        </div>
      </div>
      <div className="flex min-h-10 items-center gap-3 rounded-md border border-input bg-muted/50 px-3 py-2 dark:bg-muted/30">
        <LockKeyhole className="h-4 w-4 shrink-0 text-muted-foreground" />
        <code className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{workspace.id}</code>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2 bg-background" onClick={copyWorkspaceId}>
                <Copy className="h-4 w-4" />
                {t("workspace.license.copy")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("workspace.license.copyWorkspaceId")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

function LicenseKeySection({
  value,
  setValue,
  canUpdate,
  isUpdating,
  onSubmit,
  currentLicense
}: {
  value: string;
  setValue: (value: string) => void;
  canUpdate: boolean;
  isUpdating: boolean;
  onSubmit: () => void;
  currentLicense?: string;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(!currentLicense);
  const hasCurrentLicense = Boolean(currentLicense);

  function maskLicense(license: string) {
    if (license.length <= 18) {
      return license;
    }

    return `${license.slice(0, 10)}...${license.slice(-8)}`;
  }

  function startEditing() {
    setValue("");
    setEditing(true);
  }

  function cancelEditing() {
    setValue(currentLicense ?? "");
    setEditing(false);
  }

  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex min-h-10 items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("workspace.license.licenseKey")}</h2>
          {hasCurrentLicense && !editing ? null : (
            <p className="mt-1 text-xs text-muted-foreground">{t("workspace.license.licenseKeyHelper")}</p>
          )}
        </div>
      </div>
      {hasCurrentLicense && !editing ? (
        <div className="flex min-h-10 items-center gap-3 rounded-md border border-input bg-muted/40 px-3 py-2 dark:bg-muted/20">
          <LockKeyhole className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <code className="block truncate text-sm font-semibold text-foreground">{maskLicense(currentLicense ?? "")}</code>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0 bg-background" disabled={!canUpdate || isUpdating} onClick={startEditing}>
            {t("workspace.license.replace")}
          </Button>
        </div>
      ) : (
        <>
          <textarea
            className="min-h-16 w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            value={value}
            disabled={!canUpdate || isUpdating}
            placeholder={t("workspace.license.licensePlaceholder")}
            onChange={(event) => setValue(event.target.value)}
          />
          <div className="mt-3 flex justify-end">
            <div className="flex gap-2">
              {hasCurrentLicense ? (
                <Button type="button" variant="outline" disabled={isUpdating} onClick={cancelEditing}>
                  {t("workspace.license.cancel")}
                </Button>
              ) : null}
              <Button
                type="button"
                className="gap-2 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                disabled={!canUpdate || isUpdating || !value.trim()}
                onClick={onSubmit}
              >
                <Upload className="h-4 w-4" />
                {isUpdating ? t("workspace.license.updating") : t("workspace.license.update")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LicenseAccessSection({
  workspace,
  licenseValue,
  setLicenseValue,
  canUpdateLicense,
  isUpdating,
  onCopied,
  onUpdateLicense
}: {
  workspace: WorkspaceDetails;
  licenseValue: string;
  setLicenseValue: (value: string) => void;
  canUpdateLicense: boolean;
  isUpdating: boolean;
  onCopied: () => void;
  onUpdateLicense: () => void;
}) {
  return (
    <section className="grid gap-4 pt-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <WorkspaceIdSection workspace={workspace} onCopied={onCopied} />
      <LicenseKeySection
        value={licenseValue}
        setValue={setLicenseValue}
        canUpdate={canUpdateLicense}
        isUpdating={isUpdating}
        onSubmit={onUpdateLicense}
        currentLicense={workspace.license}
      />
    </section>
  );
}

function EmptyLicenseNotice() {
  const { t } = useTranslation();

  return (
    <div className="mt-4 flex gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
      <div>
        <div className="font-semibold">{t("workspace.license.noLicense")}</div>
        <p className="mt-1 text-blue-900/80 dark:text-blue-100/80">
          {t("workspace.license.noLicenseDescription")}{" "}
          <a className="font-medium underline underline-offset-4" href="https://dashboard.featbit.co/account" target="_blank" rel="noreferrer">
            https://dashboard.featbit.co/account
          </a>
        </p>
      </div>
    </div>
  );
}

function FeatureGrid({ license, status }: { license: DecodedLicense | null; status: LicenseStatus }) {
  const { t } = useTranslation();

  return (
    <section className="pt-6">
      <h2 className="text-lg font-semibold text-foreground">{t("workspace.license.licensedFeatures")}</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {featureCatalog.map((feature) => {
          const granted = isFeatureGranted(feature, license, status);
          const FeatureIcon = granted ? CheckCircle2 : MinusCircle;

          return (
            <div
              key={feature.id}
              className={cn(
                "flex min-h-20 items-center gap-4 rounded-md border bg-card px-5 py-4 shadow-sm",
                granted
                  ? "border-border"
                  : "border-dashed border-border/80 bg-muted/30 text-muted-foreground shadow-none dark:bg-muted/15"
              )}
            >
              <FeatureIcon className={cn("h-6 w-6 shrink-0", granted ? "text-emerald-500" : "text-muted-foreground/70")} />
              <div className="min-w-0 flex-1">
                <h3 className={cn("text-base font-semibold", granted ? "text-foreground" : "text-muted-foreground")}>{t(feature.labelKey)}</h3>
                <p className="mt-1 truncate text-sm text-muted-foreground">{t(feature.descriptionKey)}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-md border px-2.5 py-1 text-sm font-medium",
                  granted
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : "border-border bg-background text-muted-foreground dark:bg-muted/20"
                )}
              >
                {granted ? t("workspace.license.granted") : t("workspace.license.notIncluded")}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LicenseSkeleton() {
  return (
    <div className="space-y-6 py-7">
      <div className="h-16 animate-pulse rounded-md bg-muted" />
      <div className="h-24 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="h-20 animate-pulse rounded-md bg-muted" />
        <div className="h-20 animate-pulse rounded-md bg-muted" />
        <div className="h-20 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}

export function LicensePage({ lang }: { lang: "en" | "zh" }) {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useState<WorkspaceDetails>(() => getCurrentWorkspace());
  const [licenseValue, setLicenseValue] = useState(workspace.license ?? "");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const isSaas = getRuntimeEnv().hostingMode === HOSTING_MODE_SAAS;
  const canUpdateLicense = true;

  const license = useMemo(() => parseLicense(workspace.license), [workspace.license]);
  const status = getLicenseStatus(license);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      setIsLoading(true);
      try {
        const currentWorkspace = getCurrentWorkspace();
        const loadedWorkspace = await fetchWorkspaceDetails();
        if (cancelled) {
          return;
        }

        const nextWorkspace = { ...loadedWorkspace, license: loadedWorkspace.license ?? currentWorkspace.license };
        setWorkspace(nextWorkspace);
        setLicenseValue(nextWorkspace.license ?? "");
      } catch (error) {
        if (!cancelled) {
          setToastMessage(error instanceof Error ? error.message : t("workspace.requestFailed"));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setToastMessage(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  async function onUpdateLicense() {
    if (!canUpdateLicense || !licenseValue.trim()) {
      return;
    }

    setIsUpdating(true);
    try {
      const updatedWorkspace = await updateWorkspaceLicense(licenseValue.trim());
      setWorkspace(updatedWorkspace);
      setLicenseValue(updatedWorkspace.license ?? licenseValue.trim());
      setToastMessage(t("workspace.license.updateSucceeded"));
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : t("workspace.license.invalidLicense"));
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <WorkspaceLayout workspace={workspace} lang={lang} activeTab="license" statusMessage={toastMessage}>
      {isLoading ? (
        <LicenseSkeleton />
      ) : (
        <div className="pb-8">
          {!isSaas ? (
            <LicenseAccessSection
              workspace={workspace}
              licenseValue={licenseValue}
              setLicenseValue={setLicenseValue}
              canUpdateLicense={canUpdateLicense}
              isUpdating={isUpdating}
              onCopied={() => setToastMessage(t("workspace.license.copied"))}
              onUpdateLicense={onUpdateLicense}
            />
          ) : null}

          <section className={cn(isSaas ? "pt-7" : "pt-7")}>
            <h2 className="text-lg font-semibold text-foreground">{t("workspace.license.licenseStatus")}</h2>
            {license ? (
              <>
                <div className="mt-3">
                  <SummaryRow isSaas={isSaas} license={license} status={status} lang={lang} />
                </div>
              </>
            ) : (
              <EmptyLicenseNotice />
            )}
          </section>

          <FeatureGrid license={license} status={status} />
        </div>
      )}
    </WorkspaceLayout>
  );
}
