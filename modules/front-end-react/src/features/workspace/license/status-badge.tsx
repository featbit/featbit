import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LicenseStatus } from "./license-types";

export function StatusBadge({ status }: { status: LicenseStatus }) {
  const { t } = useTranslation();
  const active = status === "active";

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-7 w-fit gap-1.5 text-sm font-medium",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-border bg-muted text-muted-foreground"
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", active ? "bg-emerald-500" : "bg-muted-foreground")} />
      {t(`workspace.license.status.${status}`)}
    </Badge>
  );
}
