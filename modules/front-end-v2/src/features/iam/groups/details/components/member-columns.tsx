import type { TFunction } from "i18next"
import { Link } from "react-router-dom"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import { memberResourceName, type GroupMember } from "../../group-api"
import { ResourceLine, RowActions } from "./relationship-column-parts"

export function createMemberColumns({
  t,
  lang,
  onCopyResource,
  onRemove,
}: {
  t: TFunction
  lang: Lang
  onCopyResource: (value: string) => void
  onRemove: (member: GroupMember) => void
}): ColumnDef<GroupMember>[] {
  return [
    {
      accessorKey: "name",
      header: t("iam.groups.name"),
      size: 440,
      cell: ({ row }) => {
        const rn = memberResourceName(row.original)
        const name =
          row.original.name || row.original.email || t("iam.groups.noName")
        return (
          <div className="min-w-0 space-y-1">
            <Link
              to={localizedPath(
                lang,
                `/iam/team/${encodeURIComponent(row.original.id)}/groups`
              )}
              target="_blank"
              className="block truncate font-semibold text-foreground hover:underline"
            >
              {name}
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
      accessorKey: "email",
      header: t("iam.groups.email"),
      size: 480,
      cell: ({ row }) => (
        <Tooltip>
          <TooltipTrigger render={<span className="block truncate" />}>
            {row.original.email || "-"}
          </TooltipTrigger>
          {row.original.email ? (
            <TooltipContent>{row.original.email}</TooltipContent>
          ) : null}
        </Tooltip>
      ),
    },
    {
      id: "actions",
      header: t("iam.groups.actions"),
      size: 240,
      cell: ({ row }) => (
        <RowActions
          detailsHref={localizedPath(
            lang,
            `/iam/team/${encodeURIComponent(row.original.id)}/groups`
          )}
          detailsLabel={t("iam.groups.details")}
          removeLabel={t("iam.groups.remove")}
          onRemove={() => onRemove(row.original)}
        />
      ),
    },
  ]
}
