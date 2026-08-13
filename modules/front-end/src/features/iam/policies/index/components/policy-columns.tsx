import type { TFunction } from "i18next"
import { Copy, Star } from "lucide-react"
import { Link } from "react-router-dom"
import type { ColumnDef } from "@tanstack/react-table"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import { cn } from "@/lib/utils"
import { policyResourceName, type Policy } from "../../policy-api"

export function createPolicyColumns({
  t,
  lang,
  onCopyResource,
  onRemove,
}: {
  t: TFunction
  lang: Lang
  onCopyResource: (policy: Policy) => void
  onRemove: (policy: Policy) => void
}): ColumnDef<Policy>[] {
  return [
    {
      accessorKey: "name",
      header: t("iam.policies.name"),
      size: 360,
      cell: ({ row }) => {
        const resourceName = policyResourceName(row.original)
        return (
          <div className="min-w-0 space-y-1">
            <Link
              to={localizedPath(
                lang,
                `/iam/policies/${encodeURIComponent(row.original.id)}/permission`
              )}
              className="block truncate font-semibold text-foreground hover:underline"
            >
              {row.original.name}
            </Link>
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="size-5 shrink-0 text-muted-foreground"
                      aria-label={t("iam.policies.copyResourceName")}
                      onClick={() => onCopyResource(row.original)}
                    />
                  }
                >
                  <Copy className="size-3" />
                </TooltipTrigger>
                <TooltipContent>
                  {t("iam.policies.copyResourceName")}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="block min-w-0 truncate font-mono text-xs" />
                  }
                >
                  {resourceName}
                </TooltipTrigger>
                <TooltipContent>{resourceName}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "type",
      header: t("iam.policies.type"),
      size: 220,
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {row.original.type === "SysManaged" ? (
            <Star className="size-3.5 text-muted-foreground" />
          ) : null}
          {row.original.type === "SysManaged"
            ? t("iam.policies.systemManaged")
            : row.original.type === "CustomerManaged"
              ? t("iam.policies.customerManaged")
              : "-"}
        </span>
      ),
    },
    {
      accessorKey: "description",
      header: t("iam.policies.description"),
      size: 440,
      cell: ({ row }) => (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-block max-w-full truncate align-middle text-muted-foreground" />
            }
          >
            {row.original.description || "-"}
          </TooltipTrigger>
          {row.original.description ? (
            <TooltipContent className="max-w-80">
              {row.original.description}
            </TooltipContent>
          ) : null}
        </Tooltip>
      ),
    },
    {
      id: "actions",
      header: t("iam.policies.actions"),
      size: 200,
      cell: ({ row }) => (
        <div className="flex items-center gap-1 whitespace-nowrap">
          <Link
            to={localizedPath(
              lang,
              `/iam/policies/${encodeURIComponent(row.original.id)}/permission`
            )}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "font-medium"
            )}
          >
            {t("iam.policies.details")}
          </Link>
          {row.original.type !== "SysManaged" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/5 hover:text-destructive"
              onClick={() => onRemove(row.original)}
            >
              {t("iam.policies.remove")}
            </Button>
          ) : null}
        </div>
      ),
    },
  ]
}
