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
import type { MemberInheritedPolicy } from "../../team-api"
import {
  DescriptionCell,
  DetailsLink,
  PolicyTypeCell,
  ResourceLine,
} from "./relationship-column-parts"

export function createInheritedPolicyColumns({
  t,
  lang,
  onCopyResource,
}: {
  t: TFunction
  lang: Lang
  onCopyResource: (value: string) => void
}): ColumnDef<MemberInheritedPolicy>[] {
  return [
    {
      accessorKey: "name",
      header: t("iam.team.details.name"),
      size: 280,
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
      accessorKey: "groupName",
      header: t("iam.team.details.group"),
      size: 180,
      cell: ({ row }) => (
        <Tooltip>
          <TooltipTrigger render={<span className="block min-w-0 truncate" />}>
            {row.original.groupName}
          </TooltipTrigger>
          <TooltipContent>{row.original.groupName}</TooltipContent>
        </Tooltip>
      ),
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
      size: 380,
      cell: ({ row }) => (
        <DescriptionCell description={row.original.description} />
      ),
    },
    {
      id: "actions",
      header: t("iam.team.details.actions"),
      size: 160,
      cell: ({ row }) => (
        <DetailsLink
          href={localizedPath(
            lang,
            `/iam/policies/${encodeURIComponent(row.original.id)}/permission`
          )}
          label={t("iam.team.details.details")}
        />
      ),
    },
  ]
}
