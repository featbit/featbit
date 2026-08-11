import type { TFunction } from "i18next"
import { Star } from "lucide-react"
import { Link } from "react-router-dom"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import { policyResourceName, type GroupPolicy } from "../../group-api"
import { ResourceLine, RowActions } from "./relationship-column-parts"

export function createPolicyColumns({
  t,
  lang,
  onCopyResource,
  onRemove,
}: {
  t: TFunction
  lang: Lang
  onCopyResource: (value: string) => void
  onRemove: (policy: GroupPolicy) => void
}): ColumnDef<GroupPolicy>[] {
  return [
    {
      accessorKey: "name",
      header: t("iam.groups.name"),
      size: 350,
      cell: ({ row }) => {
        const rn = policyResourceName(row.original)
        return (
          <div className="min-w-0 space-y-1">
            <Link
              to={localizedPath(
                lang,
                `/iam/policies/${encodeURIComponent(row.original.id)}/permission`
              )}
              target="_blank"
              className="block truncate font-semibold text-foreground hover:underline"
            >
              {row.original.name}
            </Link>
            <ResourceLine
              value={rn}
              copyLabel={t("iam.groups.copyResourceName")}
              onCopy={() => onCopyResource(rn)}
            />
          </div>
        )
      },
    },
    {
      accessorKey: "type",
      header: t("iam.groups.type"),
      size: 210,
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {row.original.type === "SysManaged" ? (
            <Star className="size-3.5 text-muted-foreground" />
          ) : null}
          {row.original.type === "SysManaged"
            ? t("iam.groups.systemManaged")
            : row.original.type === "CustomerManaged"
              ? t("iam.groups.customerManaged")
              : "-"}
        </span>
      ),
    },
    {
      accessorKey: "description",
      header: t("iam.groups.description"),
      size: 420,
      cell: ({ row }) => (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="block min-w-0 truncate text-muted-foreground" />
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
      header: t("iam.groups.actions"),
      size: 220,
      cell: ({ row }) => (
        <RowActions
          detailsHref={localizedPath(
            lang,
            `/iam/policies/${encodeURIComponent(row.original.id)}/permission`
          )}
          detailsLabel={t("iam.groups.details")}
          removeLabel={t("iam.groups.remove")}
          onRemove={() => onRemove(row.original)}
        />
      ),
    },
  ]
}
