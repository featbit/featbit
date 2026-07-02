import { useEffect } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { WorkspaceDetails } from "./workspace-api";
import { WorkspaceTabs } from "./workspace-tabs";

type StatusToastVariant = "success" | "error";

function StatusToast({ message, variant }: { message: string | null; variant: StatusToastVariant }) {
  useEffect(() => {
    if (!message) {
      return;
    }

    const options = { id: "workspace-status", duration: 2400 };
    if (variant === "error") {
      toast.error(message, options);
      return;
    }

    toast.success(message, options);
  }, [message, variant]);

  return null;
}

export function WorkspaceLayout({
  workspace,
  lang,
  activeTab,
  statusMessage,
  statusVariant = "success",
  children
}: {
  workspace: WorkspaceDetails;
  lang: "en" | "zh";
  activeTab: string;
  statusMessage?: string | null;
  statusVariant?: StatusToastVariant;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="-m-5 min-h-[calc(100vh-4rem)] bg-background px-8 py-6">
      <StatusToast message={statusMessage ?? null} variant={statusVariant} />
      <header className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">{t("workspace.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {workspace.name} - {workspace.key}
        </p>
      </header>

      <WorkspaceTabs lang={lang} activeTab={activeTab} />

      {children}
    </div>
  );
}
