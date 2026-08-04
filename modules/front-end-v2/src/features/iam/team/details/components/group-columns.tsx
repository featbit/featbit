import type { TFunction } from "i18next"
import { Link } from "react-router-dom"
import type { ColumnDef } from "@tanstack/react-table"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import type { MemberDetailGroup } from "../../team-api"
import { ResourceLine, RowActions } from "./relationship-column-parts"

export function createGroupColumns({
  t,
  lang,
  onCopyResource,
  onRemove,
}: {
  t: TFunction
  lang: Lang
  onCopyResource: (value: string) => void
  onRemove: (group: MemberDetailGroup) => void
}): ColumnDef<MemberDetailGroup>[] {
  return [
    {
      accessorKey: "name",
      header: t("iam.team.details.name"),
      size: 320,
      cell: ({ row }) => {
        const resourceName = `group/${row.original.name}`
        const href = localizedPath(
          lang,
          `/iam/groups/${encodeURIComponent(row.original.id)}/team`
        )

        return (
          <div className="min-w-0 space-y-1">
            <Link
              to={href}
              target="_blank"
              className="block truncate font-semibold text-foreground hover:underline"
            >
              {row.original.name}
            </Link>
            <ResourceLine
              value={resourceName}
              copyLabel={t("iam.team.details.copyResourceName")}
              onCopy={() => onCopyResource(resourceName)}
            />
          </div>
        )
      },
    },
    {
      accessorKey: "description",
      header: t("iam.team.details.description"),
      size: 500,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.description || "-"}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("iam.team.details.actions"),
      size: 220,
      cell: ({ row }) => (
        <RowActions
          detailsHref={localizedPath(
            lang,
            `/iam/groups/${encodeURIComponent(row.original.id)}/team`
          )}
          detailsLabel={t("iam.team.details.details")}
          removeLabel={t("iam.team.details.remove")}
          onRemove={() => onRemove(row.original)}
        />
      ),
    },
  ]
}
