import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { WorkspaceDetails } from "./workspace-api";
import { WorkspaceTabs } from "./workspace-tabs";

function StatusToast({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <div role="status" className="fixed right-5 top-20 z-50 flex items-center gap-2 rounded-md border border-border bg-popover px-3 py-2 text-sm font-medium text-popover-foreground shadow-lg">
      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      {message}
    </div>
  );
}

export function WorkspaceLayout({
  workspace,
  lang,
  activeTab,
  statusMessage,
  children
}: {
  workspace: WorkspaceDetails;
  lang: "en" | "zh";
  activeTab: string;
  statusMessage?: string | null;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="-m-5 min-h-[calc(100vh-4rem)] bg-background px-8 py-8">
      <StatusToast message={statusMessage ?? null} />
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-normal text-foreground">{t("workspace.title")}</h1>
        <p className="text-base text-muted-foreground">
          {workspace.name} - {workspace.key}
        </p>
      </header>

      <WorkspaceTabs lang={lang} activeTab={activeTab} />

      {children}
    </div>
  );
}
