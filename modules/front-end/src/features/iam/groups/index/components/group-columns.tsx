import type { TFunction } from "i18next"
import { Copy } from "lucide-react"
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
import { groupResourceName, type Group } from "../../group-api"

export function createGroupColumns({
  t,
  lang,
  onCopyResource,
  onRemove,
}: {
  t: TFunction
  lang: Lang
  onCopyResource: (group: Group) => void
  onRemove: (group: Group) => void
}): ColumnDef<Group>[] {
  return [
    {
      accessorKey: "name",
      header: t("iam.groups.name"),
      size: 390,
      cell: ({ row }) => {
        const resourceName = groupResourceName(row.original)
        return (
          <div className="min-w-0 space-y-1">
            <Link
              to={localizedPath(
                lang,
                `/iam/groups/${encodeURIComponent(row.original.id)}/team`
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
                      aria-label={t("iam.groups.copyResourceName")}
                      onClick={() => onCopyResource(row.original)}
                    />
                  }
                >
                  <Copy className="size-3" />
                </TooltipTrigger>
                <TooltipContent>
                  {t("iam.groups.copyResourceName")}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="block min-w-0 truncate font-mono text-[0.72rem]" />
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
      accessorKey: "description",
      header: t("iam.groups.description"),
      size: 610,
      cell: ({ row }) => (
        <span className="block truncate text-muted-foreground">
          {row.original.description || "-"}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("iam.groups.actions"),
      size: 220,
      cell: ({ row }) => (
        <div className="flex items-center gap-1 whitespace-nowrap">
          <Link
            to={localizedPath(
              lang,
              `/iam/groups/${encodeURIComponent(row.original.id)}/team`
            )}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "font-medium"
            )}
          >
            {t("iam.groups.details")}
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/5 hover:text-destructive"
            onClick={() => onRemove(row.original)}
          >
            {t("iam.groups.remove")}
          </Button>
        </div>
      ),
    },
  ]
}
