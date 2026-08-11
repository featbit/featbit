import type { TFunction } from "i18next"
import { Link } from "react-router-dom"
import type { ColumnDef } from "@tanstack/react-table"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import type { MemberDirectPolicy } from "../../team-api"
import {
  DescriptionCell,
  PolicyTypeCell,
  ResourceLine,
  RowActions,
} from "./relationship-column-parts"

export function createDirectPolicyColumns({
  t,
  lang,
  onCopyResource,
  onRemove,
}: {
  t: TFunction
  lang: Lang
  onCopyResource: (value: string) => void
  onRemove: (policy: MemberDirectPolicy) => void
}): ColumnDef<MemberDirectPolicy>[] {
  return [
    {
      accessorKey: "name",
      header: t("iam.team.details.name"),
      size: 300,
      cell: ({ row }) => {
        const resourceName = `policy/${row.original.key || row.original.id}`
        const href = localizedPath(
          lang,
          `/iam/policies/${encodeURIComponent(row.original.id)}/permission`
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
      accessorKey: "type",
      header: t("iam.team.details.type"),
      size: 180,
      cell: ({ row }) => (
        <PolicyTypeCell
          type={row.original.type}
          systemManagedLabel={t("iam.team.details.systemManaged")}
          customerManagedLabel={t("iam.team.details.customerManaged")}
        />
      ),
    },
    {
      accessorKey: "description",
      header: t("iam.team.details.description"),
      size: 420,
      cell: ({ row }) => (
        <DescriptionCell description={row.original.description} />
      ),
    },
    {
      id: "actions",
      header: t("iam.team.details.actions"),
      size: 200,
      cell: ({ row }) => (
        <RowActions
          detailsHref={localizedPath(
            lang,
            `/iam/policies/${encodeURIComponent(row.original.id)}/permission`
          )}
          detailsLabel={t("iam.team.details.details")}
          removeLabel={t("iam.team.details.remove")}
          onRemove={() => onRemove(row.original)}
        />
      ),
    },
  ]
}
